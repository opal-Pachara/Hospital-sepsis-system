import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import { maskHN } from '../utils/hnMask';
import { showToast } from '../components/common/Toast';

export interface DailySummaryItem {
  date: string;
  total_cases: number;
  high_risk_cases: number;
  treated_completed: number;
  ruled_out: number;
  active_treating?: number;
  compliance_rate: number;
}

export interface TreatedCaseItem {
  id: string;
  masked_hn: string;
  gender: string;
  age: number;
  news_score: number;
  risk_level: string;
  has_single_alert?: boolean;
  arrival_date: string;
  arrival_time: string;
  is_treated: boolean;
  treatment_completed: boolean;
  sepsis_ruled_out: boolean;
  treatment_completed_at: string | null;
  treated_by: string;
  outcome_label: string;
  chief_complaint?: string;
  vitals?: {
    sbp: number | null;
    dbp: number | null;
    heart_rate: number | null;
    resp_rate: number | null;
    temperature: number | null;
    spo2: number | null;
    gcs: number | null;
  };
}

interface TreatedDashboardProps {
  onBackToClinical?: () => void;
  onSelectPatientTimeline?: (patientId: string) => void;
}

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default memo(function TreatedDashboard({
  onBackToClinical,
  onSelectPatientTimeline,
}: TreatedDashboardProps) {
  const setActiveTab = useRTSASStore((s) => s.setActiveTab);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dailyHistory, setDailyHistory] = useState<DailySummaryItem[]>([]);
  const [cases, setCases] = useState<TreatedCaseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'ruled_out'>('all');

  // In-dashboard Timeline Modal state
  const [selectedTimelineCase, setSelectedTimelineCase] = useState<TreatedCaseItem | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);

  // Format Thai date
  const formatThaiDate = (dStr: string) => {
    if (!dStr) return '-';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dStr;
    }
  };

  // Fetch daily stats from backend API or fallback to store (silent on background updates)
  const fetchStats = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch('/api/dashboard/daily-stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const datesList: string[] = data.dates || [];
      const historyList: DailySummaryItem[] = data.daily_history || [];

      setAvailableDates(datesList);
      setDailyHistory(historyList);

      const initialDate = datesList[0] || '';
      setSelectedDate((prev) => (prev && datesList.includes(prev) ? prev : initialDate));
    } catch (err) {
      console.warn('[TreatedDashboard] Backend stats API error, using store fallback:', err);
      // Fallback: build from Zustand state ONLY if there are actually treated patients
      const { patients, patientData } = useRTSASStore.getState();
      let treatedDone = 0;
      let ruledOut = 0;

      patients.forEach((p) => {
        const pData = patientData[p.id];
        if (pData?.treatmentCompleted) treatedDone++;
        if (pData?.sepsisRuledOut) ruledOut++;
      });

      if (treatedDone + ruledOut > 0) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const fallbackHistory: DailySummaryItem[] = [
          {
            date: todayStr,
            total_cases: treatedDone + ruledOut,
            high_risk_cases: treatedDone + ruledOut,
            treated_completed: treatedDone,
            ruled_out: ruledOut,
            compliance_rate: 100,
          },
        ];
        setAvailableDates([todayStr]);
        setDailyHistory(fallbackHistory);
        setSelectedDate(todayStr);
      } else {
        setAvailableDates([]);
        setDailyHistory([]);
        setSelectedDate('');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch cases for a specific date
  const fetchCasesForDate = useCallback(
    async (dateStr: string) => {
      if (!dateStr) {
        setCases([]);
        return;
      }
      try {
        let res = await fetch(`/api/dashboard/treated-cases?date=${dateStr}&treated_only=true`);
        if (!res.ok) {
          res = await fetch(`/api/dashboard/treated-cases?date=${dateStr}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCases(data.cases || []);
      } catch (err) {
        console.warn('[TreatedDashboard] Backend cases API error, using store fallback:', err);
        // Fallback: only include patients who were actually treated
        const { patients, patientData } = useRTSASStore.getState();
        const matched = patients.filter(
          (p) => !p.arrivalTime || p.arrivalTime.slice(0, 10) === dateStr
        );
        const treatedPatients = matched.filter((p) => {
          const pData = patientData[p.id];
          return (pData?.treatmentCompleted ?? false) ||
            (p.treatmentStatus?.treatment_completed ?? false) ||
            (pData?.sepsisRuledOut ?? false) ||
            (p.treatmentStatus?.sepsis_ruled_out ?? false);
        });

        const fallbackCases: TreatedCaseItem[] = treatedPatients.map((p) => {
          const pData = patientData[p.id];
          const isCompleted = (pData?.treatmentCompleted ?? false) || (p.treatmentStatus?.treatment_completed ?? false);
          const isRuledOut = (pData?.sepsisRuledOut ?? false) || (p.treatmentStatus?.sepsis_ruled_out ?? false);

          let outcome = 'ปกติ';
          if (isCompleted) outcome = '✅ Sepsis Bundle สำเร็จ';
          else if (isRuledOut) outcome = '🟢 Rule Out Sepsis';

          return {
            id: p.id,
            masked_hn: maskHN(p.hn),
            gender: p.gender === 'male' ? 'ชาย' : p.gender === 'female' ? 'หญิง' : 'ไม่ระบุ',
            age: p.age || 0,
            news_score: p.latestNewsScore,
            risk_level: p.currentRiskLevel,
            has_single_alert: p.hasSepsisAlert,
            arrival_date: p.arrivalTime ? p.arrivalTime.slice(0, 10) : dateStr,
            arrival_time: p.arrivalTime
              ? new Date(p.arrivalTime).toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
              })
              : '--:--',
            is_treated: true,
            treatment_completed: isCompleted,
            sepsis_ruled_out: isRuledOut,
            treatment_completed_at: pData?.treatmentCompletedAt || null,
            treated_by: 'ทีมแพทย์/พยาบาล ER',
            outcome_label: outcome,
          };
        });
        setCases(fallbackCases);
      }
    },
    []
  );

  useEffect(() => {
    fetchStats(true);
  }, [fetchStats]);

  useEffect(() => {
    if (selectedDate) {
      fetchCasesForDate(selectedDate);
    } else {
      setCases([]);
    }
  }, [selectedDate, fetchCasesForDate]);

  // Current selected day statistics
  const currentDayStats = useMemo(() => {
    return (
      dailyHistory.find((h) => h.date === selectedDate) || {
        date: selectedDate || new Date().toISOString().slice(0, 10),
        total_cases: 0,
        high_risk_cases: 0,
        treated_completed: 0,
        ruled_out: 0,
        compliance_rate: 0,
      }
    );
  }, [dailyHistory, selectedDate]);

  // Filtered cases based on filter tab
  const filteredCases = useMemo(() => {
    if (filterType === 'completed') {
      return cases.filter((c) => c.treatment_completed);
    }
    if (filterType === 'ruled_out') {
      return cases.filter((c) => c.sepsis_ruled_out);
    }
    return cases;
  }, [cases, filterType]);

  // Handle click on clinical timeline (opens in-dashboard modal with option to go to bedside)
  const handleOpenTimeline = async (c: TreatedCaseItem) => {
    setSelectedTimelineCase(c);
    setLoadingTimeline(true);
    setTimelineEvents([]);

    // Check if patient is already in store memory with timeline
    const { patients, patientData } = useRTSASStore.getState();
    const matched = patients.find((p) => p.id === c.id || p.hn === c.id);
    const inStoreData = matched ? patientData[matched.id] : null;

    if (inStoreData && inStoreData.timeline && inStoreData.timeline.length > 0) {
      setTimelineEvents(inStoreData.timeline);
      setLoadingTimeline(false);
      return;
    }

    try {
      const res = await fetch(`/api/patients/${c.id}/timeline`);
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          setTimelineEvents(data.events);
          setLoadingTimeline(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch server timeline:', err);
    }

    // Fallback: construct baseline clinical events
    const fallbackEvents: Array<{
      id: string;
      timestamp: string;
      actionText: string;
      color: 'blue' | 'green' | 'orange' | 'red' | 'gray';
      actor?: string;
    }> = [
        {
          id: `triage_${c.id}`,
          timestamp: `${c.arrival_date}T${c.arrival_time}:00`,
          actionText: `📥 เข้ารับการตรวจที่ห้องฉุกเฉิน (ER) — ผลประเมินแรกรับ NEWS ${c.news_score} คะแนน (${c.risk_level.toUpperCase()})`,
          color: 'blue',
          actor: 'พยาบาลคัดกรอง ER',
        },
      ];

    if (c.treatment_completed) {
      fallbackEvents.push({
        id: `done_${c.id}`,
        timestamp: c.treatment_completed_at || `${c.arrival_date}T${c.arrival_time}:00`,
        actionText: `✅ สิ้นสุดกระบวนการรักษา (Complete 1-Hour Sepsis Bundle)`,
        color: 'green' as const,
        actor: c.treated_by || 'ทีมแพทย์/พยาบาล ER',
      });
    } else if (c.sepsis_ruled_out) {
      fallbackEvents.push({
        id: `ro_${c.id}`,
        timestamp: `${c.arrival_date}T${c.arrival_time}:00`,
        actionText: `🟢 แพทย์ประเมินซ้ำ ไม่ใช่ภาวะ Sepsis (Rule Out Sepsis)`,
        color: 'green' as const,
        actor: 'แพทย์เวร ER',
      });
    }

    setTimelineEvents(fallbackEvents);
    setLoadingTimeline(false);
  };

  const handleNavigateToBedside = async (patientId: string) => {
    setSelectedTimelineCase(null);
    showToast('🔒 เปิดแฟ้มประวัติในโหมดอ่านอย่างเดียว (Read-Only) — ล็อคการแก้ไขเพื่อรักษาความเป็นกลางของข้อมูล', 'info', 4000);
    if (onSelectPatientTimeline) {
      onSelectPatientTimeline(patientId);
    } else {
      await useRTSASStore.getState().selectPatientAsync(patientId, true);
      setActiveTab('timeline');
      onBackToClinical?.();
    }
  };

  const handleCopyModalTimeline = () => {
    if (!selectedTimelineCase) return;
    const header = `บันทึกขั้นตอนการรักษา (Clinical Treatment Steps) — HN: ${selectedTimelineCase.masked_hn}\n`;
    const sep = '='.repeat(60) + '\n';
    const meta = `วันที่รับบริการ: ${formatThaiDate(selectedTimelineCase.arrival_date)} เวลา ${selectedTimelineCase.arrival_time} น.\n` +
      `คะแนน NEWS: ${selectedTimelineCase.news_score} (${selectedTimelineCase.risk_level.toUpperCase()}) | อาการสำคัญ: ${selectedTimelineCase.chief_complaint || 'ไม่ระบุ'}\n` +
      `ผลลัพธ์: ${selectedTimelineCase.outcome_label} | ผู้ปฏิบัติ: \n` + sep;

    const lines = timelineEvents.map((ev, i) => {
      const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
      let cleanAction = (ev.actionText || '')
        .replace(/\s*\[ผู้ปฏิบัติ:\s*[^\]]*\]/gi, '')
        .replace(/\s*\(ผู้ปฏิบัติ:\s*[^)]*\)/gi, '')
        .replace(/\s*ผู้ปฏิบัติ:\s*.*$/gi, '')
        .replace(/\s*—\s*โดย\s+.*$/gi, '')
        .replace(/\s*\(โดย\s+[^)]+\)/gi, '')
        .trim();
      if (cleanAction.includes('แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด')) {
        const match = cleanAction.match(/^(.*?\([^)]*น\.\))/);
        if (match) {
          cleanAction = match[1];
        } else {
          cleanAction = '✓ แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด';
        }
      }
      return `[${timeStr}] ขั้นตอนที่ ${i + 1}: ${cleanAction} [ผู้ปฏิบัติ: ]`;
    });

    const fullText = header + meta + lines.join('\n') + '\n' + sep + `รวมดำเนินการ: ${timelineEvents.length} ขั้นตอน`;
    navigator.clipboard.writeText(fullText)
      .then(() => showToast('คัดลอกขั้นตอนการรักษาสำเร็จ — พร้อมวางใน HIS', 'success'))
      .catch(() => showToast('ไม่สามารถคัดลอกได้', 'error'));
  };

  // CSV Export handler
  const handleExportCSV = () => {
    const summaryRows = [
      ['=== สรุปสถิติผู้ป่วยที่รักษาแล้ว (RTSAS Treated Patients Dashboard) ==='],
      ['โรงพยาบาลบางคล้า จังหวัดฉะเชิงเทรา'],
      [`วันที่ข้อมูล: ${formatThaiDate(selectedDate)} (${selectedDate})`],
      [`วันที่ส่งออกไฟล์: ${new Date().toLocaleString('th-TH')}`],
      [],
      ['--- สรุปตัวเลขสถิติของวันที่เลือก ---'],
      ['ผู้ป่วยตรวจทั้งหมด (คน)', currentDayStats.total_cases],
      ['ผู้ป่วยเสี่ยง Sepsis (คน)', currentDayStats.high_risk_cases],
      ['รักษาสำเร็จ (Bundle Completed)', currentDayStats.treated_completed],
      ['แพทย์ Rule Out Sepsis', currentDayStats.ruled_out],
      ['อัตรา Bundle Compliance (%)', `${currentDayStats.compliance_rate}%`],
      [],
      ['--- ตารางเปรียบเทียบสถิติแยกตามวัน ---'],
      ['วันที่', 'ผู้ป่วยทั้งหมด (คน)', 'เสี่ยง Sepsis (คน)', 'รักษาสำเร็จ (คน)', 'Rule Out (คน)', 'Compliance Rate (%)'],
      ...dailyHistory.map((h) => [
        h.date,
        h.total_cases,
        h.high_risk_cases,
        h.treated_completed,
        h.ruled_out,
        `${h.compliance_rate}%`,
      ]),
      [],
      ['--- รายชื่อเคสผู้ป่วย (PDPA Masked - ไม่เปิดเผยชื่อ/เลขบัตร ปชช.) ---'],
      [
        'รหัสผู้ป่วย (HN Masked)',
        'เพศ',
        'อายุ (ปี)',
        'คะแนน NEWS',
        'ระดับความเสี่ยง',
        'เวลามาถึง ER',
        'เวลาที่รักษาเสร็จ',
        'ผลการรักษา',
        'ผู้ให้การรักษา',
      ],
      ...filteredCases.map((c) => [
        c.masked_hn,
        c.gender,
        c.age > 0 ? c.age : '',
        c.news_score,
        c.risk_level,
        c.arrival_time,
        c.treatment_completed_at
          ? new Date(c.treatment_completed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
          : '',
        c.outcome_label,
        c.treated_by,
      ]),
    ];

    const csvContent = '\uFEFF' + summaryRows.map((r) => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTSAS_Treated_Dashboard_${selectedDate}.csv`;
    link.click();
    showToast('ดาวน์โหลดไฟล์ CSV สรุปสถิติเรียบร้อย', 'success');
  };

  return (
    <div
      id="treated-patients-dashboard"
      className="flex-1 overflow-y-auto bg-surface-base"
      style={{ fontFamily: 'inherit', paddingBottom: '30px' }}
    >
      {/* ─── Top Sub-Header Bar (Light Theme matching Header.tsx & AdminPage.tsx) ─── */}
      <div
        className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 relative overflow-hidden"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
      >
        {/* Top gradient accent line (3px) */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #2563eb, #0891b2, #16a34a)' }}
        />

        {/* Left: Title + Hospital & Date details */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-xs flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
            }}
          >
            📊
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-800 tracking-tight">
                แผงควบคุมสรุปผู้ป่วยที่รักษาแล้ว
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              โรงพยาบาลบางคล้า · {selectedDate ? `ข้อมูลสรุปประจำวันที่ ${formatThaiDate(selectedDate)} (${selectedDate})` : 'ระบบพร้อมรองรับข้อมูลการรักษาจริง (Ready for Production)'}
            </div>
          </div>
        </div>

        {/* Right: Actions (CSV Export & Return to Live Monitoring) */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-export-dashboard-csv"
            onClick={handleExportCSV}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: '1px solid #bbf7d0',
              background: '#f0fdf4',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#dcfce7';
              e.currentTarget.style.borderColor = '#86efac';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f0fdf4';
              e.currentTarget.style.borderColor = '#bbf7d0';
            }}
            title="ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Microsoft Excel"
          >
            <span>📥</span>
            <span>ส่งออกรายงาน CSV</span>
          </button>

          {onBackToClinical && (
            <button
              type="button"
              id="btn-back-to-clinical"
              onClick={onBackToClinical}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: '1px solid #bfdbfe',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                transition: 'all 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#1d4ed8';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#2563eb';
              }}
              title="กลับสู่หน้าติดตามผู้ป่วยสด (Bedside Monitoring)"
            >
              <span>🔙</span>
              <span>ติดตามผู้ป่วยสด</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Main Content Container (styled identically to RTSAS layout columns) ─── */}
      <div style={{ padding: '14px 18px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* ─── Production Ready Notice when no data exists ─── */}
        {dailyHistory.length === 0 && cases.length === 0 && (
          <div
            className="bg-emerald-50/90 border border-emerald-200 rounded-xl relative overflow-hidden"
            style={{ padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#16a34a' }}
                >
                  ✨
                </div>
                <div>
                  <div className="text-sm font-black text-emerald-900 tracking-tight">
                    เคลียร์ข้อมูลตัวอย่างในหน้านี้ออกหมดเรียบร้อยแล้ว (Ready for Production Deployment)
                  </div>
                  <div className="text-xs text-emerald-700 font-medium mt-0.5">
                    หน้านี้ว่างเปล่าเพื่อรอรับข้อมูลผู้ป่วยจริง — เมื่อมีเคสที่รักษาตาม Sepsis Bundle สำเร็จ หรือ Rule Out ในห้องฉุกเฉิน รายการสรุปและสถิติจะบันทึกที่นี่โดยอัตโนมัติ
                  </div>
                </div>
              </div>
              {onBackToClinical && (
                <button
                  type="button"
                  onClick={onBackToClinical}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: '1px solid #86efac',
                    background: '#16a34a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#15803d';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = '#16a34a';
                  }}
                >
                  <span>🏥</span>
                  <span>ติดตามผู้ป่วยสดที่ห้องฉุกเฉิน (ER)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── Date Selection Bar (styled like Sidebar filter pills) ─── */}
        <div
          className="bg-white border border-[#dde3ed] rounded-xl relative overflow-hidden"
          style={{ padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                📅 เลือกวันที่ประเมิน:
              </span>
              {availableDates.length === 0 ? (
                <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                  ยังไม่มีประวัติวันที่บันทึกการรักษาในระบบ (ข้อมูลตัวอย่างถูกเคลียร์ออกแล้ว)
                </span>
              ) : (
                availableDates.slice(0, 7).map((d) => {
                  const isSelected = d === selectedDate;
                  const isToday = d === new Date().toISOString().slice(0, 10);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: isSelected ? 700 : 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                        background: isSelected ? '#2563eb' : '#f8fafc',
                        color: isSelected ? '#ffffff' : '#475569',
                        boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
                        transition: 'all 0.15s',
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#94a3b8';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }
                      }}
                    >
                      {formatThaiDate(d)} {isToday ? '(วันนี้)' : ''}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-2">
              <span style={{ fontSize: '11px', color: '#64748b' }}>หรือระบุวันที่:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#1e293b',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── 5 Executive KPI Metric Cards (styled like PatientInfoBar & VitalCards) ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {/* Card 1: Total Patients */}
          <div
            className="bg-white border border-[#dde3ed] rounded-xl relative overflow-hidden transition-all hover:shadow-md"
            style={{ padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[4px]"
              style={{ background: '#3b82f6', borderRadius: '12px 0 0 12px' }}
            />
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ผู้ป่วยตรวจทั้งหมด
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                👥 ER
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
              {loading ? '...' : currentDayStats.total_cases}
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginLeft: '4px' }}>ราย</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              ยอดตรวจสะสมประจำวัน
            </div>
          </div>

          {/* Card 2: Sepsis High Risk */}
          <div
            className="bg-white border border-[#fca5a5] rounded-xl relative overflow-hidden transition-all hover:shadow-md"
            style={{ padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[4px]"
              style={{ background: '#dc2626', borderRadius: '12px 0 0 12px' }}
            />
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                เสี่ยงติดเชื้อ SEPSIS
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                🔴 NEWS ≥ 5
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#dc2626', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
              {loading ? '...' : currentDayStats.high_risk_cases}
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#f87171', marginLeft: '4px' }}>ราย</span>
            </div>
            <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px' }}>
              คะแนน NEWS ≥ 5 หรือ Single Alert
            </div>
          </div>

          {/* Card 3: Treatment Completed */}
          <div
            className="bg-white border border-[#86efac] rounded-xl relative overflow-hidden transition-all hover:shadow-md"
            style={{ padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[4px]"
              style={{ background: '#16a34a', borderRadius: '12px 0 0 12px' }}
            />
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                รักษาสำเร็จ (BUNDLE DONE)
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}>
                ✓ 60 นาที
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
              {loading ? '...' : currentDayStats.treated_completed}
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#86efac', marginLeft: '4px' }}>ราย</span>
            </div>
            <div style={{ fontSize: '10px', color: '#15803d', marginTop: '2px' }}>
              ครบตามเกณฑ์ 1-Hour Protocol
            </div>
          </div>

          {/* Card 4: Ruled Out Sepsis */}
          <div
            className="bg-white border border-[#99f6e4] rounded-xl relative overflow-hidden transition-all hover:shadow-md"
            style={{ padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[4px]"
              style={{ background: '#0d9488', borderRadius: '12px 0 0 12px' }}
            />
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                RULE OUT SEPSIS
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4' }}>
                🟢 แพทย์ประเมิน
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#0f766e', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
              {loading ? '...' : currentDayStats.ruled_out}
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#5eead4', marginLeft: '4px' }}>ราย</span>
            </div>
            <div style={{ fontSize: '10px', color: '#0f766e', marginTop: '2px' }}>
              แพทย์วินิจฉัยไม่ใช่ Sepsis
            </div>
          </div>

          {/* Card 5: Bundle Compliance */}
          <div
            className="bg-white border border-[#ddd6fe] rounded-xl relative overflow-hidden transition-all hover:shadow-md"
            style={{ padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[4px]"
              style={{ background: '#8b5cf6', borderRadius: '12px 0 0 12px' }}
            />
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                BUNDLE COMPLIANCE
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#6d28d9', fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
              {loading ? '...' : `${currentDayStats.compliance_rate}%`}
            </div>
            {/* Progress bar matching ChecklistPanel */}
            <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: '3px',
                  width: `${Math.min(100, currentDayStats.compliance_rate)}%`,
                  background: 'linear-gradient(90deg, #8b5cf6, #6d28d9)',
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── Section 1: Daily Comparative Summary (using .section-card) ─── */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <span>📈</span> ตารางสรุปเปรียบเทียบสถิติแยกตามวัน (Daily Comparative Summary)
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              💡 คลิกเลือกแถววันที่เพื่อสลับดูข้อมูลผู้ป่วยและสถิติ
            </div>
          </div>

          <div className="overflow-x-auto">
            {dailyHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', fontSize: '11px', color: '#94a3b8' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📈</div>
                ยังไม่มีข้อมูลสรุปเปรียบเทียบสถิติแยกตามวัน — ข้อมูลตัวอย่างถูกเคลียร์ออกเรียบร้อยแล้วเพื่อรอการ Deployment ใช้งานจริง
              </div>
            ) : (
              <table className="w-full text-left border-collapse" style={{ fontSize: '11px' }}>
                <thead>
                  <tr
                    style={{
                      background: '#eff6ff',
                      borderBottom: '1px solid #bfdbfe',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#2563eb',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th className="py-2.5 px-3.5">วันที่ (DATE)</th>
                    <th className="py-2.5 px-3 text-center">ผู้ป่วยตรวจทั้งหมด</th>
                    <th className="py-2.5 px-3 text-center">เสี่ยงติดเชื้อ SEPSIS</th>
                    <th className="py-2.5 px-3 text-center">รักษาสำเร็จ</th>
                    <th className="py-2.5 px-3 text-center">RULE OUT</th>
                    <th className="py-2.5 px-3 text-center">COMPLIANCE RATE</th>
                    <th className="py-2.5 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyHistory.map((item) => {
                    const isCurrent = item.date === selectedDate;
                    return (
                      <tr
                        key={item.date}
                        onClick={() => setSelectedDate(item.date)}
                        className={`cursor-pointer transition-colors ${isCurrent ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
                          }`}
                        style={{
                          borderLeft: isCurrent ? '4px solid #2563eb' : '4px solid transparent',
                        }}
                      >
                        <td className="py-2.5 px-3.5 text-slate-800 flex items-center gap-2">
                          {isCurrent && <span style={{ color: '#2563eb' }}>👉</span>}
                          <span>{formatThaiDate(item.date)}</span>
                          <span className="font-mono text-[10px] text-slate-400">({item.date})</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                          {item.total_cases} ราย
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-red-600">
                          {item.high_risk_cases} ราย
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                          {item.treated_completed} ราย
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-teal-600">
                          {item.ruled_out} ราย
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background:
                                item.compliance_rate >= 80
                                  ? '#dcfce7'
                                  : item.compliance_rate >= 50
                                    ? '#fef9c3'
                                    : '#fee2e2',
                              color:
                                item.compliance_rate >= 80
                                  ? '#15803d'
                                  : item.compliance_rate >= 50
                                    ? '#854d0e'
                                    : '#b91c1c',
                              border: `1px solid ${item.compliance_rate >= 80
                                  ? '#86efac'
                                  : item.compliance_rate >= 50
                                    ? '#fde047'
                                    : '#fca5a5'
                                }`,
                            }}
                          >
                            {item.compliance_rate}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(item.date);
                            }}
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 10px',
                              borderRadius: '6px',
                              border: isCurrent ? '1px solid #2563eb' : '1px solid #cbd5e1',
                              background: isCurrent ? '#2563eb' : '#fff',
                              color: isCurrent ? '#fff' : '#475569',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isCurrent ? 'กำลังดู' : 'เลือก'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ─── Section 2: Patient Cases Table (using .section-card) ─── */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <span>📋</span> รายชื่อเคสผู้ป่วยที่รักษาแล้ว {selectedDate ? `(วันที่ ${formatThaiDate(selectedDate)})` : ''} (PDPA Compliant List)
            </div>

            {/* Filter Tabs matching Treated Categories */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid #2563eb`,
                  background: filterType === 'all' ? '#2563eb' : '#fff',
                  color: filterType === 'all' ? '#fff' : '#2563eb',
                  transition: 'all 0.15s',
                }}
              >
                ทั้งหมด ({cases.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('completed')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid #16a34a`,
                  background: filterType === 'completed' ? '#16a34a' : '#fff',
                  color: filterType === 'completed' ? '#fff' : '#16a34a',
                  transition: 'all 0.15s',
                }}
              >
                ✅ Sepsis Bundle สำเร็จ ({cases.filter((c) => c.treatment_completed).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('ruled_out')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid #0d9488`,
                  background: filterType === 'ruled_out' ? '#0d9488' : '#fff',
                  color: filterType === 'ruled_out' ? '#fff' : '#0d9488',
                  transition: 'all 0.15s',
                }}
              >
                🟢 Rule Out Sepsis ({cases.filter((c) => c.sepsis_ruled_out).length})
              </button>
            </div>
          </div>

          {/* Subheader info strip (matching ChecklistPanel standard) */}
          <div
            style={{
              padding: '6px 14px',
              background: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#1e40af',
              fontWeight: 600,
            }}
          >
            <span>🔒 ความปลอดภัยข้อมูล: แสดงเฉพาะ HN 4 หลักสุดท้าย, เพศ, อายุ, และ NEWS score ตามมาตรฐาน PDPA</span>
            <span>แสดงผล {filteredCases.length} ราย</span>
          </div>

          <div className="overflow-x-auto">
            {filteredCases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', fontSize: '11px', color: '#94a3b8' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                ยังไม่มีรายชื่อผู้ป่วยที่รักษาแล้วในระบบ — ข้อมูลตัวอย่างถูกเคลียร์ออกเรียบร้อยแล้วเพื่อรอการใช้งานจริง
              </div>
            ) : (
              <table className="w-full text-left border-collapse" style={{ fontSize: '11px' }}>
                <thead>
                  <tr
                    style={{
                      background: '#eff6ff',
                      borderBottom: '1px solid #bfdbfe',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#2563eb',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th className="py-2.5 px-3.5">รหัสผู้ป่วย (HN Masked)</th>
                    <th className="py-2.5 px-3 text-center">เพศ</th>
                    <th className="py-2.5 px-3 text-center">อายุ</th>
                    <th className="py-2.5 px-3 text-center">คะแนนเตือนภัย (NEWS)</th>
                    <th className="py-2.5 px-3 text-center">เวลามาถึง ER</th>
                    <th className="py-2.5 px-3 text-center">เวลาเสร็จสิ้น</th>
                    <th className="py-2.5 px-3 text-center">ผลการรักษา</th>
                    <th className="py-2.5 px-3 text-center">ผู้ให้การรักษา</th>
                    <th className="py-2.5 px-3 text-center">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCases.map((c) => {
                    const isHigh = c.news_score >= 5 || c.has_single_alert;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3.5 font-mono font-bold text-slate-800">
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', border: '1px solid #dde3ed' }}>
                            {c.masked_hn}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600">
                          {c.gender === 'ชาย' ? '♂ ชาย' : c.gender === 'หญิง' ? '♀ หญิง' : c.gender}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600">
                          {c.age > 0 ? `${c.age} ปี` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: isHigh ? '#fef2f2' : c.news_score >= 1 ? '#fff7ed' : '#f0fdf4',
                              color: isHigh ? '#dc2626' : c.news_score >= 1 ? '#c2410c' : '#16a34a',
                              border: `1px solid ${isHigh ? '#fca5a5' : c.news_score >= 1 ? '#fdba74' : '#86efac'}`,
                            }}
                          >
                            NEWS {c.news_score}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">
                          {c.arrival_time}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-500">
                          {c.treatment_completed_at
                            ? new Date(c.treatment_completed_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              background: c.treatment_completed
                                ? '#dcfce7'
                                : c.sepsis_ruled_out
                                  ? '#ccfbf1'
                                  : isHigh
                                    ? '#fee2e2'
                                    : '#f1f5f9',
                              color: c.treatment_completed
                                ? '#15803d'
                                : c.sepsis_ruled_out
                                  ? '#0f766e'
                                  : isHigh
                                    ? '#b91c1c'
                                    : '#475569',
                              border: `1px solid ${c.treatment_completed
                                  ? '#86efac'
                                  : c.sepsis_ruled_out
                                    ? '#5eead4'
                                    : isHigh
                                      ? '#fca5a5'
                                      : '#cbd5e1'
                                }`,
                            }}
                          >
                            {c.outcome_label}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600">
                          {c.treated_by}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenTimeline(c)}
                            style={{
                              padding: '4px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#2563eb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              boxShadow: '0 1px 2px rgba(37,99,235,0.06)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#2563eb';
                              e.currentTarget.style.color = '#ffffff';
                              e.currentTarget.style.borderColor = '#2563eb';
                              e.currentTarget.style.boxShadow = '0 2px 5px rgba(37,99,235,0.25)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#eff6ff';
                              e.currentTarget.style.color = '#2563eb';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(37,99,235,0.06)';
                            }}
                            title="ดูประวัติขั้นตอนการรักษาของผู้ป่วยรายนี้"
                          >
                            <span>⏱️</span>
                            <span>ประวัติการรักษา</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ─── In-Dashboard Clinical Timeline Modal (Matches RTSAS Modal System) ─── */}
      {selectedTimelineCase && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTimelineCase(null);
          }}
        >
          <div
            className="animate-slideUp"
            style={{
              width: '680px',
              maxWidth: '95vw',
              maxHeight: '92vh',
              background: '#ffffff',
              borderRadius: '20px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px -12px rgba(37, 99, 235, .25), 0 0 0 1px rgba(37, 99, 235, .1)',
            }}
          >
            {/* ─── Blue Top Accent Bar (Standard in AssessmentFormModal & ExportReportModal) ─── */}
            <div
              style={{
                height: '4px',
                background: 'linear-gradient(90deg, #2563eb, #0891b2, #2563eb)',
                flexShrink: 0,
              }}
            />

            {/* ─── Header ─── */}
            <div
              style={{
                padding: '18px 24px 14px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                borderBottom: '1px solid rgba(191, 219, 254, .6)',
                flexShrink: 0,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0,
                  boxShadow: '0 6px 20px rgba(37, 99, 235, .35)',
                }}
              >
                ⏱️
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '17px',
                    fontWeight: 900,
                    color: '#1e40af',
                    letterSpacing: '-0.3px',
                    lineHeight: 1.3,
                  }}
                >
                  ประวัติการรักษา (Clinical Treatment Timeline)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#059669',
                      background: '#ecfdf5',
                      border: '1px solid #6ee7b7',
                      borderRadius: '8px',
                      padding: '2px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>🔒</span> บันทึกถาวร (Read-Only)
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#2563eb',
                      background: '#fff',
                      border: '1.5px solid #93c5fd',
                      borderRadius: '8px',
                      padding: '2px 8px',
                    }}
                  >
                    {selectedTimelineCase.masked_hn.startsWith('HN')
                      ? selectedTimelineCase.masked_hn
                      : `HN ${selectedTimelineCase.masked_hn}`}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#475569',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '2px 8px',
                    }}
                  >
                    📅 รับบริการ {formatThaiDate(selectedTimelineCase.arrival_date)} · {selectedTimelineCase.arrival_time} น.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTimelineCase(null)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: '1px solid #93c5fd',
                  background: '#fff',
                  color: '#2563eb',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.color = '#2563eb';
                }}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            {/* ─── Patient Info Bar (matching AssessmentFormModal standard) ─── */}
            <div
              style={{
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                flexShrink: 0,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '16px' }}>👤</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                {selectedTimelineCase.masked_hn}
              </div>
              <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                เพศ {selectedTimelineCase.gender} · {selectedTimelineCase.age > 0 ? `อายุ ${selectedTimelineCase.age} ปี` : 'ไม่ระบุอายุ'}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: selectedTimelineCase.news_score >= 5 ? '#fef2f2' : selectedTimelineCase.news_score >= 1 ? '#fff7ed' : '#f0fdf4',
                    color: selectedTimelineCase.news_score >= 5 ? '#dc2626' : selectedTimelineCase.news_score >= 1 ? '#ea580c' : '#16a34a',
                    border: `1px solid ${selectedTimelineCase.news_score >= 5 ? '#fca5a5' : selectedTimelineCase.news_score >= 1 ? '#fed7aa' : '#86efac'}`,
                  }}
                >
                  NEWS {selectedTimelineCase.news_score} ({selectedTimelineCase.risk_level.toUpperCase()})
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: selectedTimelineCase.treatment_completed
                      ? '#dcfce7'
                      : selectedTimelineCase.sepsis_ruled_out
                        ? '#ccfbf1'
                        : '#eff6ff',
                    color: selectedTimelineCase.treatment_completed
                      ? '#15803d'
                      : selectedTimelineCase.sepsis_ruled_out
                        ? '#0f766e'
                        : '#1e40af',
                    border: `1px solid ${selectedTimelineCase.treatment_completed
                        ? '#86efac'
                        : selectedTimelineCase.sepsis_ruled_out
                          ? '#5eead4'
                          : '#bfdbfe'
                      }`,
                  }}
                >
                  {selectedTimelineCase.outcome_label}
                </span>
              </div>
            </div>

            {/* Impartiality / Medical Record Integrity Notice */}
            <div
              style={{
                padding: '6px 24px',
                background: '#fffbeb',
                borderBottom: '1px solid #fef3c7',
                fontSize: '10.5px',
                color: '#92400e',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚖️</span>
              <span>
                ความเป็นกลางของเวชระเบียน: แฟ้มประวัติการรักษาปิดสมบูรณ์แล้ว ข้อมูลถูกล็อคถาวรตามมาตรฐานความถูกต้อง ไม่สามารถแก้ไขหรือลบขั้นตอนย้อนหลังได้
              </span>
            </div>

            {/* ─── Modal Scrollable Body ─── */}
            <div
              style={{
                padding: '18px 24px 22px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Chief Complaint Box */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '12px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#1e40af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🩺</span> อาการสำคัญแรกรับ (Chief Complaint)
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '4px', lineHeight: 1.5 }}>
                  {selectedTimelineCase.chief_complaint || 'ไม่ระบุอาการแรกรับ'}
                </div>
              </div>

              {/* Initial Vitals Snapshot */}
              {selectedTimelineCase.vitals && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #dde3ed',
                    borderRadius: '12px',
                    padding: '12px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>📈</span> สัญญาณชีพแรกรับ (Initial Vital Signs)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
                    <div style={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '10px', padding: '8px 4px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'block' }}>BP</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTimelineCase.vitals.sbp ? `${selectedTimelineCase.vitals.sbp}/${selectedTimelineCase.vitals.dbp || '-'}` : '-'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>mmHg</span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '10px', padding: '8px 4px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'block' }}>HR (ชีพจร)</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTimelineCase.vitals.heart_rate ?? '-'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>bpm</span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '10px', padding: '8px 4px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'block' }}>RR (หายใจ)</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTimelineCase.vitals.resp_rate ?? '-'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>/min</span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '10px', padding: '8px 4px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'block' }}>BT (อุณหภูมิ)</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTimelineCase.vitals.temperature ? `${selectedTimelineCase.vitals.temperature}` : '-'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>°C</span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '10px', padding: '8px 4px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'block' }}>SpO₂</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTimelineCase.vitals.spo2 ? `${selectedTimelineCase.vitals.spo2}%` : '-'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>O₂ sat</span>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #dde3ed', borderRadius: '10px', padding: '8px 4px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, display: 'block' }}>GCS</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                        {selectedTimelineCase.vitals.gcs ?? '-'}
                      </span>
                      <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>คะแนน</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Sequence */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#334155',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>⏱️</span> ลำดับขั้นตอนการดูแลรักษา ({timelineEvents.length} ขั้นตอน)
                  </div>
                  {loadingTimeline ? (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#2563eb',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span className="animate-spin">🔄</span> กำลังโหลด...
                    </span>
                  ) : (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      {timelineEvents.length} ขั้นตอน
                    </span>
                  )}
                </div>

                {loadingTimeline ? (
                  <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
                    กำลังดึงข้อมูลขั้นตอนการรักษาจากระบบ...
                  </div>
                ) : timelineEvents.length === 0 ? (
                  <div
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '12px',
                      background: '#f8fafc',
                      borderRadius: '12px',
                      border: '1.5px dashed #cbd5e1',
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
                    ยังไม่มีบันทึกขั้นตอนการรักษาเพิ่มเติมสำหรับเคสนี้
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', paddingLeft: '4px' }}>
                    {timelineEvents.map((ev, index) => {
                      const timeStr = ev.timestamp
                        ? new Date(ev.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '--:--:--';
                      const isLast = index === timelineEvents.length - 1;
                      const isSkipped = ev.actionText?.startsWith('⏭ ข้าม');

                      const dotColor = isSkipped
                        ? '#64748b'
                        : ev.color === 'green'
                          ? '#16a34a'
                          : ev.color === 'red'
                            ? '#dc2626'
                            : ev.color === 'orange'
                              ? '#ea580c'
                              : '#2563eb';

                      const dotBg = isSkipped
                        ? '#f8fafc'
                        : ev.color === 'green'
                          ? '#f0fdf4'
                          : ev.color === 'red'
                            ? '#fef2f2'
                            : ev.color === 'orange'
                              ? '#fff7ed'
                              : '#eff6ff';

                      return (
                        <div key={ev.id || index} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                          {/* Connector line (Identical to TimelinePanel) */}
                          {!isLast && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '13px',
                                top: '28px',
                                bottom: '-12px',
                                width: '2px',
                                background: '#e2e8f0',
                                zIndex: 1,
                              }}
                            />
                          )}

                          {/* Step Number Circle */}
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              position: 'relative',
                              zIndex: 2,
                              fontSize: '11px',
                              fontWeight: 800,
                              background: dotBg,
                              color: dotColor,
                              border: `1.5px solid ${dotColor}`,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                          >
                            {index + 1}
                          </div>

                          {/* Step Card */}
                          <div
                            style={{
                              flex: 1,
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                              transition: 'border-color 0.15s, box-shadow 0.15s',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                                {isSkipped ? `ขั้นตอนที่ ${index + 1} (ข้าม)` : `ขั้นตอนที่ ${index + 1}`}
                              </span>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontFamily: 'monospace',
                                  background: '#f1f5f9',
                                  color: '#475569',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  fontWeight: 600,
                                }}
                              >
                                {timeStr}
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginTop: '4px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                              {(() => {
                                let text = (ev.actionText || '')
                                  .replace(/\s*—\s*โดย\s+.*$/gi, '')
                                  .replace(/\s*\(โดย\s+[^)]+\)/gi, '')
                                  .replace(/\s*\[ผู้ปฏิบัติ:\s*[^\]]*\]/gi, '')
                                  .trim();
                                if (text.includes('แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด')) {
                                  const match = text.match(/^(.*?\([^)]*น\.\))/);
                                  if (match) return match[1];
                                  return '✓ แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด';
                                }
                                return text;
                              })()}
                            </div>
                            {ev.actor && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ opacity: 0.8 }}>ผู้ปฏิบัติ:</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ─── Modal Footer ─── */}
            <div
              style={{
                padding: '14px 24px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                id="btn-copy-timeline-his"
                onClick={handleCopyModalTimeline}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: '#ffffff',
                  color: '#1e293b',
                  border: '1.5px solid #cbd5e1',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                <span>📋</span> คัดลอกขั้นตอนการรักษาลง HIS
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTimelineCase(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: 'transparent',
                    color: '#64748b',
                    border: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#e2e8f0';
                    e.currentTarget.style.color = '#334155';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }}
                >
                  ✕ ปิด
                </button>
                <button
                  type="button"
                  id="btn-navigate-to-bedside"
                  onClick={() => handleNavigateToBedside(selectedTimelineCase.id)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.opacity = '0.92';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <span>🖥️</span> เปิดดูแฟ้มประวัติในหน้าหลัก (อ่านอย่างเดียว)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

