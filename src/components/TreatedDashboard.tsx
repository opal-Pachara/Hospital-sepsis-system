import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import { maskHN } from '../utils/hnMask';
import { showToast } from './Toast';

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

export default function TreatedDashboard({
  onBackToClinical,
  onSelectPatientTimeline,
}: TreatedDashboardProps) {
  const { patients, patientData, selectPatient, setActiveTab } = useRTSASStore();

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dailyHistory, setDailyHistory] = useState<DailySummaryItem[]>([]);
  const [cases, setCases] = useState<TreatedCaseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<'all' | 'treated_only' | 'high_risk'>('all');

  // Format Thai date
  const formatThaiDate = (dStr: string) => {
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

  // Fetch daily stats from backend API or fallback to store
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/daily-stats');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const datesList: string[] = data.dates || [];
      const historyList: DailySummaryItem[] = data.daily_history || [];

      setAvailableDates(datesList);
      setDailyHistory(historyList);

      const initialDate = datesList[0] || new Date().toISOString().slice(0, 10);
      setSelectedDate((prev) => (prev && datesList.includes(prev) ? prev : initialDate));
    } catch (err) {
      console.warn('[TreatedDashboard] Backend stats API error, using store fallback:', err);
      // Fallback: build from Zustand state
      const todayStr = new Date().toISOString().slice(0, 10);
      let highRisk = 0;
      let treatedDone = 0;
      let ruledOut = 0;

      patients.forEach((p) => {
        if (p.hasSepsisAlert) highRisk++;
        const pData = patientData[p.id];
        if (pData?.treatmentCompleted) treatedDone++;
        if (pData?.sepsisRuledOut) ruledOut++;
      });

      const total = patients.length;
      const rate = highRisk > 0 ? Math.round(((treatedDone + ruledOut) / highRisk) * 100) : 100;

      const fallbackHistory: DailySummaryItem[] = [
        {
          date: todayStr,
          total_cases: total,
          high_risk_cases: highRisk,
          treated_completed: treatedDone,
          ruled_out: ruledOut,
          compliance_rate: rate,
        },
      ];

      setAvailableDates([todayStr]);
      setDailyHistory(fallbackHistory);
      setSelectedDate(todayStr);
    } finally {
      setLoading(false);
    }
  }, [patients, patientData]);

  // Fetch cases for a specific date
  const fetchCasesForDate = useCallback(
    async (dateStr: string) => {
      try {
        let res = await fetch(`/api/dashboard/treated-cases?date=${dateStr}`);
        if (!res.ok) {
          res = await fetch(`/api/dashboard/daily-cases?date=${dateStr}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCases(data.cases || []);
      } catch (err) {
        console.warn('[TreatedDashboard] Backend cases API error, using store fallback:', err);
        // Fallback: build cases from store patients (filter by date if available)
        const matched = patients.filter(
          (p) => !p.arrivalTime || p.arrivalTime.slice(0, 10) === dateStr
        );
        const sourcePatients =
          matched.length > 0
            ? matched
            : dateStr === new Date().toISOString().slice(0, 10)
            ? patients
            : [];
        const fallbackCases: TreatedCaseItem[] = sourcePatients.map((p) => {
          const pData = patientData[p.id];
          const isCompleted = pData?.treatmentCompleted ?? false;
          const isRuledOut = pData?.sepsisRuledOut ?? false;
          const isTreated = isCompleted || isRuledOut;

          let outcome = 'ปกติ';
          if (isCompleted) outcome = '✅ Sepsis Bundle สำเร็จ';
          else if (isRuledOut) outcome = '🟢 Rule Out Sepsis';
          else if (p.hasSepsisAlert) outcome = '🔴 เสี่ยงสูง (รอประเมิน)';
          else if (p.currentRiskLevel === 'medium') outcome = '⏳ กำลังดูแลรักษา';

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
            is_treated: isTreated,
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
    [patients, patientData]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (selectedDate) {
      fetchCasesForDate(selectedDate);
    }
  }, [selectedDate, fetchCasesForDate]);

  // Current selected day statistics
  const currentDayStats = useMemo(() => {
    return (
      dailyHistory.find((h) => h.date === selectedDate) || {
        date: selectedDate,
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
    if (filterType === 'treated_only') {
      return cases.filter((c) => c.is_treated);
    }
    if (filterType === 'high_risk') {
      return cases.filter((c) => c.news_score >= 5 || c.has_single_alert);
    }
    return cases;
  }, [cases, filterType]);

  // Handle click on clinical timeline
  const handleOpenTimeline = (patientId: string) => {
    const matched = patients.find((p) => p.id === patientId || p.hn === patientId);
    if (matched) {
      selectPatient(matched.id);
      setActiveTab('timeline');
      onBackToClinical?.();
      showToast(`เปิดประวัติการรักษา ${maskHN(matched.hn)}`, 'info');
    } else if (onSelectPatientTimeline) {
      onSelectPatientTimeline(patientId);
    } else {
      onBackToClinical?.();
    }
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
              โรงพยาบาลบางคล้า · ข้อมูลสรุปประจำวันที่ {formatThaiDate(selectedDate)} ({selectedDate})
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
              {availableDates.slice(0, 7).map((d) => {
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
              })}
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
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
                เป้า ≥ 80%
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
                      className={`cursor-pointer transition-colors ${
                        isCurrent ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
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
                            border: `1px solid ${
                              item.compliance_rate >= 80
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
          </div>
        </div>

        {/* ─── Section 2: Patient Cases Table (using .section-card) ─── */}
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">
              <span>📋</span> รายชื่อเคสผู้ป่วยวันที่ {formatThaiDate(selectedDate)} (PDPA Compliant List)
            </div>

            {/* Filter Tabs matching Sidebar filter pills */}
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
                onClick={() => setFilterType('treated_only')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid #16a34a`,
                  background: filterType === 'treated_only' ? '#16a34a' : '#fff',
                  color: filterType === 'treated_only' ? '#fff' : '#16a34a',
                  transition: 'all 0.15s',
                }}
              >
                ✅ รักษาแล้ว ({cases.filter((c) => c.is_treated).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('high_risk')}
                style={{
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: `1px solid #dc2626`,
                  background: filterType === 'high_risk' ? '#dc2626' : '#fff',
                  color: filterType === 'high_risk' ? '#fff' : '#dc2626',
                  transition: 'all 0.15s',
                }}
              >
                🔴 เสี่ยง Sepsis ({cases.filter((c) => c.news_score >= 5 || c.has_single_alert).length})
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
                ไม่มีรายการผู้ป่วยในหมวดหมู่นี้สำหรับวันที่เลือก
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
                              border: `1px solid ${
                                c.treatment_completed
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
                            onClick={() => handleOpenTimeline(c.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#2563eb',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = '#2563eb';
                              e.currentTarget.style.color = '#fff';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = '#eff6ff';
                              e.currentTarget.style.color = '#2563eb';
                            }}
                            title="ดู Timeline การรักษาของผู้ป่วยรายนี้"
                          >
                            🔍 ดู Timeline
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
    </div>
  );
}
