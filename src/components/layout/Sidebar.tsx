import { useState, useEffect } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import type { Patient, RiskLevel } from '../../types';
import { maskHN } from '../../utils/hnMask';
import { showToast } from '../common/Toast';

const riskConfig: Record<RiskLevel, { label: string; labelTh: string; badgeBg: string; badgeText: string; badgeBorder: string; barColor: string; chipBg: string; chipText: string; chipBorder: string }> = {
  high: {
    label: 'HIGH RISK', labelTh: 'เสี่ยงติดเชื้อ',
    badgeBg: '#fef2f2', badgeText: '#dc2626', badgeBorder: '#fca5a5', barColor: '#dc2626',
    chipBg: '#fef2f2', chipText: '#dc2626', chipBorder: '#fca5a5',
  },
  medium: {
    label: 'MEDIUM', labelTh: 'เฝ้าระวัง',
    badgeBg: '#fff7ed', badgeText: '#ea580c', badgeBorder: '#fdba74', barColor: '#ea580c',
    chipBg: '#fff7ed', chipText: '#c2410c', chipBorder: '#fdba74',
  },
  low_medium: {
    label: 'LOW-MED', labelTh: 'ปกติ',
    badgeBg: '#f0fdf4', badgeText: '#16a34a', badgeBorder: '#86efac', barColor: '#22c55e',
    chipBg: '#f0fdf4', chipText: '#16a34a', chipBorder: '#86efac',
  },
  low: {
    label: 'LOW RISK', labelTh: 'ปกติ',
    badgeBg: '#f0fdf4', badgeText: '#16a34a', badgeBorder: '#86efac', barColor: '#22c55e',
    chipBg: '#f0fdf4', chipText: '#16a34a', chipBorder: '#86efac',
  },
};

function PatientCard({ patient, isSelected }: { patient: Patient; isSelected: boolean }) {
  const selectPatient = useRTSASStore((s) => s.selectPatient);
  const patientData = useRTSASStore((s) => s.patientData);
  const currentTime = useRTSASStore((s) => s.ui.currentTime);
  const risk = riskConfig[patient.currentRiskLevel];

  // Live countdown badge for this specific patient
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);

  useEffect(() => {
    const updateBadge = () => {
      const data = patientData[patient.id] || (patient.hn ? patientData[patient.hn] : undefined);
      const timer = data?.countdownTimer;
      const isCompleted = Boolean(
        data?.treatmentCompleted ||
        patient.treatmentStatus?.treatment_completed
      );
      const isRuledOut = Boolean(
        data?.sepsisRuledOut ||
        patient.treatmentStatus?.sepsis_ruled_out
      );
      const isTimerActive = Boolean(timer?.isActive);

      if (timer?.startedAt && isTimerActive && !isCompleted && !isRuledOut) {
        const elapsed = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000);
        const remaining = Math.max(0, timer.totalDurationSeconds - elapsed);
        if (remaining === 0 || timer.isExpired) {
          const overdueSecs = Math.max(0, elapsed - timer.totalDurationSeconds);
          const overdueMins = Math.floor(overdueSecs / 60);
          setCountdownLabel(overdueMins > 0 ? `🚨 เกิน ${overdueMins} น.` : '🔴 ครบ 60 น.');
        } else {
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          setCountdownLabel(`⏱ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      } else {
        setCountdownLabel(null);
      }
    };

    updateBadge();
    const iv = setInterval(updateBadge, 1000);
    return () => clearInterval(iv);
  }, [patient.id, patient.hn, patient.treatmentStatus, patientData]);

  const genderIcon = patient.gender === 'male' ? '♂' : patient.gender === 'female' ? '♀' : '⚥';
  const genderLabel = patient.gender === 'male' ? 'ชาย' : patient.gender === 'female' ? 'หญิง' : 'อื่นๆ';

  const arrivalMs = new Date(patient.arrivalTime).getTime();
  const nowMs = new Date(currentTime).getTime();
  const diffMins = Math.floor((nowMs - arrivalMs) / 60000);
  const isOldData = diffMins > 24 * 60; // older than 24 hours

  const arrivalTime = new Date(patient.arrivalTime).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const arrivalDateStr = new Date(patient.arrivalTime).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });

  const isHighRisk = patient.currentRiskLevel === 'high';
  const isMissingData = !!(patient.latestNewsResult?.missingDataCount && patient.latestNewsResult.missingDataCount > 0);

  return (
    <button
      id={`patient-card-${patient.id}`}
      onClick={() => isSelected ? selectPatient('') : selectPatient(patient.id)}
      className="w-full text-left border-b border-[#dde3ed] relative bg-white transition-all hover:bg-slate-50"
      style={{
        padding: '10px 14px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        ...(isSelected ? { background: '#eff6ff', borderLeft: '3px solid #2563eb' } : {}),
      }}
    >
      {/* Alert bar */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: '4px', background: risk.barColor, borderRadius: '0 2px 2px 0' }}
      />

      {/* Top row: HN (masked) + Badge */}
      <div className="flex justify-between items-start" style={{ marginLeft: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{maskHN(patient.hn)}</div>
        <span
          className={isHighRisk ? 'animate-blink-badge' : ''}
          style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '10px',
            background: isHighRisk ? risk.badgeBg : isMissingData ? '#f1f5f9' : '#f0fdf4',
            color: isHighRisk ? risk.badgeText : isMissingData ? '#64748b' : '#16a34a',
            border: `1px solid ${isHighRisk ? risk.badgeBorder : isMissingData ? '#cbd5e1' : '#86efac'}`,
          }}
        >
          {isHighRisk ? '🔴 เสี่ยงติดเชื้อ' : isMissingData ? '⚪ รอประเมิน' : '🟢 ปกติ'}
        </span>
      </div>

      {/* Info — แสดงเฉพาะเพศ + อายุ ตาม privacy requirements */}
      <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px', marginLeft: '8px' }}>
        {genderIcon} {genderLabel}{patient.age && patient.age > 0 ? ` · ${patient.age} ปี` : ''}
      </div>

      {/* Score Chip */}
      <div className="flex gap-2" style={{ marginLeft: '8px', marginTop: '5px' }}>
        {isMissingData ? (
          <span
            style={{
              fontSize: '9px', fontWeight: 600, padding: '2px 7px', borderRadius: '8px',
              background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1',
            }}
          >
            ⚠ คำนวณ NEWS ไม่ได้
          </span>
        ) : (
          <span
            style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '8px',
              background: risk.chipBg, color: risk.chipText, border: `1px solid ${risk.chipBorder}`,
              whiteSpace: 'nowrap',
            }}
          >
            NEWS {patient.latestNewsScore}
          </span>
        )}
      </div>

      {/* Missing data info */}
      {isMissingData && (
        <div style={{ fontSize: '9px', color: '#94a3b8', marginLeft: '8px', marginTop: '2px' }}>
          ขาดข้อมูล: {patient.latestNewsResult?.missingDataCount} รายการ
        </div>
      )}

      {/* Time */}
      <div style={{ fontSize: '9px', color: '#94a3b8', marginLeft: '8px', marginTop: '3px' }}>
        {isOldData
          ? `📅 ${arrivalDateStr} · ${arrivalTime}`
          : `🕐 ${arrivalTime} · ${isSelected ? 'กำลังดูแล' : `${diffMins} นาทีที่แล้ว`}`
        }
      </div>

      {/* Countdown badge — only shows when Sepsis Bundle timer is active */}
      {countdownLabel && (
        <div style={{
          marginLeft: '8px', marginTop: '4px',
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '10px', fontWeight: 700,
          background: countdownLabel.startsWith('🔴') ? '#fef2f2' : '#fff7ed',
          color: countdownLabel.startsWith('🔴') ? '#dc2626' : '#c2410c',
          border: `1px solid ${countdownLabel.startsWith('🔴') ? '#fca5a5' : '#fdba74'}`,
          borderRadius: '6px', padding: '2px 7px',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {countdownLabel} Sepsis Bundle
        </div>
      )}
    </button>
  );
}

// ─── Completed Patient Card (Rule Out or Bundle Done) ───────────────────────
function CompletedPatientCard({ patient, isSelected }: { patient: Patient; isSelected: boolean }) {
  const selectPatient = useRTSASStore((s) => s.selectPatient);
  const patientData = useRTSASStore((s) => s.patientData);
  const data = patientData[patient.id] || (patient.hn ? patientData[patient.hn] : undefined);

  const genderIcon = patient.gender === 'male' ? '♂' : patient.gender === 'female' ? '♀' : '⚥';
  const genderLabel = patient.gender === 'male' ? 'ชาย' : patient.gender === 'female' ? 'หญิง' : 'อื่นๆ';

  const isRuledOut = Boolean(data?.sepsisRuledOut || patient.treatmentStatus?.sepsis_ruled_out);
  const isTreatmentCompleted = Boolean(data?.treatmentCompleted || patient.treatmentStatus?.treatment_completed);

  const completedTime = isRuledOut
    ? data?.ruledOutAt
    : isTreatmentCompleted 
      ? (data?.treatmentCompletedAt || patient.treatmentStatus?.treatment_completed_at)
      : data?.countdownTimer?.startedAt; // fallback — could be improved

  const timeStr = completedTime
    ? new Date(completedTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <button
      id={`completed-card-${patient.id}`}
      onClick={() => {
        if (isSelected) {
          selectPatient('');
        } else {
          selectPatient(patient.id);
          useRTSASStore.getState().setActiveTab('timeline');
        }
      }}
      className="w-full text-left border-b border-[#e2e8f0] relative transition-all hover:bg-slate-50"
      style={{
        padding: '8px 14px',
        fontFamily: 'inherit',
        cursor: 'pointer',
        background: isSelected ? '#f0fdf4' : '#f8fafc',
        borderLeft: isSelected ? '3px solid #16a34a' : '3px solid transparent',
        opacity: 0.85,
      }}
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-0 bottom-0"
        style={{ width: '3px', background: isRuledOut ? '#86efac' : '#4ade80', borderRadius: '0 2px 2px 0' }}
      />

      <div className="flex justify-between items-center" style={{ marginLeft: '6px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
          {maskHN(patient.hn)}
        </div>
        <span style={{
          fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px',
          background: isRuledOut ? '#f0fdf4' : '#dcfce7',
          color: isRuledOut ? '#16a34a' : '#15803d',
          border: `1px solid ${isRuledOut ? '#86efac' : '#4ade80'}`,
        }}>
          {isRuledOut ? '🟢 Rule Out' : isTreatmentCompleted ? '✅ สิ้นสุดการรักษา' : '✅ จบกระบวนการ'}
        </span>
      </div>

      <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px', marginLeft: '6px' }}>
        {genderIcon} {genderLabel}{patient.age && patient.age > 0 ? ` · ${patient.age} ปี` : ''}
        {' · '}NEWS {patient.latestNewsScore}
        {completedTime && (
          <span> · {isRuledOut ? 'Rule Out' : 'เสร็จ'} {timeStr} น.</span>
        )}
      </div>
    </button>
  );
}

export interface SidebarProps {
  onRefresh?: () => Promise<void>;
  onNavigateTreatedDashboard?: () => void;
  onNavigateClinical?: () => void;
}

export default function Sidebar({ onRefresh, onNavigateTreatedDashboard, onNavigateClinical }: SidebarProps = {}) {
  const { patients, selectedPatient, patientData } = useRTSASStore();
  const [filter, setFilter] = useState<'all' | 'alert' | 'completed'>('all');
  const [lastRefresh, setLastRefresh] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(true);
  void completedOpen; void setCompletedOpen;

  // Determine which patients have completed their treatment loop
  const isPatientCompleted = (p: Patient): boolean => {
    const data = patientData[p.id] || (p.hn ? patientData[p.hn] : undefined);
    const isCompleted = Boolean(data?.treatmentCompleted || p.treatmentStatus?.treatment_completed);
    const isRuledOut = Boolean(data?.sepsisRuledOut || p.treatmentStatus?.sepsis_ruled_out);
    return isCompleted || isRuledOut;
  };

  // Sort patients by risk: high → medium → low_medium → low
  const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low_medium: 2, low: 3 };

  const activePatients = [...patients]
    .filter((p) => !isPatientCompleted(p))
    .sort((a, b) => riskOrder[a.currentRiskLevel] - riskOrder[b.currentRiskLevel]);

  const completedPatients = [...patients]
    .filter((p) => isPatientCompleted(p))
    .sort((a, b) => riskOrder[a.currentRiskLevel] - riskOrder[b.currentRiskLevel]);

  const alertCount = activePatients.filter((p) => p.hasSepsisAlert).length;

  const filteredActive = filter === 'alert'
    ? activePatients.filter((p) => p.hasSepsisAlert)
    : activePatients;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setLastRefresh(
        `อัปเดต ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-hidden z-10 relative"
      style={{
        width: '260px',
        background: '#f1f5f9',
        borderRight: '1px solid #dde3ed',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #dde3ed' }}
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '1px' }}>
          📋 รายชื่อผู้ป่วย
        </span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span style={{
            background: '#2563eb', color: '#fff', borderRadius: '10px',
            padding: '1px 8px', fontSize: '11px', fontWeight: 700,
          }}>
            {activePatients.length}
          </span>
        </div>
      </div>

      {/* Refresh bar */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '6px 14px', borderBottom: '1px solid #dde3ed', background: '#f8fafc' }}
      >
        <span className="flex items-center gap-1" style={{ fontSize: '9px', color: '#64748b' }}>
          <span className="animate-pulse-green inline-block" style={{
            width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e',
          }} />
          รีเฟรชออโต้
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>{lastRefresh}</span>
          {onRefresh && (
            <button
              id="btn-pull-patients"
              type="button"
              disabled={isRefreshing}
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await onRefresh();
                  showToast('ดึงข้อมูลล่าสุดเรียบร้อย', 'success');
                } catch {
                  showToast('ไม่สามารถดึงข้อมูลได้', 'error');
                } finally {
                  setIsRefreshing(false);
                }
              }}
              style={{
                fontSize: '9px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: isRefreshing ? '#f1f5f9' : '#fff',
                color: '#2563eb',
                cursor: isRefreshing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s',
              }}
              title="ดึงข้อมูลใหม่จากระบบทันที"
            >
              <span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
              <span>{isRefreshing ? 'กำลังดึง...' : 'ดึงข้อมูล'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter buttons */}
      <div
        className="flex gap-1 flex-wrap flex-shrink-0"
        style={{ padding: '8px 10px', borderBottom: '1px solid #dde3ed' }}
      >
        <button
          className={`transition-all ${filter === 'all' ? 'text-white' : ''}`}
          onClick={() => {
            setFilter('all');
            onNavigateClinical?.();
          }}
          style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid #2563eb`,
            background: filter === 'all' ? '#2563eb' : 'transparent',
            color: filter === 'all' ? '#fff' : '#2563eb',
          }}
        >
          กำลังรักษา {activePatients.length}
        </button>
        <button
          className="transition-all"
          onClick={() => {
            setFilter('alert');
            onNavigateClinical?.();
          }}
          style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid #dc2626`,
            background: filter === 'alert' ? '#dc2626' : 'transparent',
            color: filter === 'alert' ? '#fff' : '#dc2626',
          }}
        >
          🔴 เสี่ยง {alertCount}
        </button>
        <button
          className="transition-all"
          id="btn-filter-completed"
          onClick={() => {
            setFilter('completed');
            onNavigateTreatedDashboard?.();
          }}
          style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid #16a34a`,
            background: filter === 'completed' ? '#16a34a' : 'transparent',
            color: filter === 'completed' ? '#fff' : '#16a34a',
          }}
        >
          ✅ Dashborad ผู้ปว่ยรักษาแล้ว 
        </button>
      </div>

      {/* ─── Patient List Area ─── */}
      <div className="flex-1 overflow-y-auto">

        {/* Tab: completed patients */}
        {filter === 'completed' ? (
          completedPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: '11px', color: '#94a3b8' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              ยังไม่มีผู้ป่วยที่จบกระบวนการ
              {onNavigateTreatedDashboard && (
                <button
                  type="button"
                  id="btn-sidebar-empty-open-dashboard"
                  onClick={onNavigateTreatedDashboard}
                  style={{
                    marginTop: '12px',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid #86efac',
                    background: '#f0fdf4',
                    color: '#15803d',
                  }}
                >
                  📊 เปิดดู Dashboard สรุปรายวัน
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div style={{
                padding: '8px 12px',
                background: '#f0fdf4',
                borderBottom: '1px solid #d1fae5',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>
                  📋 ผู้ป่วยที่รักษาแล้ววันนี้ — {completedPatients.length} ราย (Timeline ยังเก็บอยู่)
                </div>
                {onNavigateTreatedDashboard && (
                  <button
                    type="button"
                    id="btn-sidebar-open-dashboard"
                    onClick={onNavigateTreatedDashboard}
                    style={{
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #86efac',
                      background: '#fff',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    <span>📊</span>
                    <span>ดู Dashboard สรุปรายวัน</span>
                  </button>
                )}
              </div>
              {completedPatients.map((patient) => (
                <CompletedPatientCard
                  key={patient.id}
                  patient={patient}
                  isSelected={selectedPatient?.id === patient.id}
                />
              ))}
            </>
          )
        ) : (
          /* Tab: active / alert patients */
          filteredActive.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '11px', color: '#94a3b8' }}>
              {filter === 'alert' ? 'ไม่มีผู้ป่วยเสี่ยงขณะนี้' : 'ไม่พบผู้ป่วยที่อยู่ในกระบวนการ'}
            </div>
          ) : (
            filteredActive.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                isSelected={selectedPatient?.id === patient.id}
              />
            ))
          )
        )}
      </div>
    </aside>
  );
}
