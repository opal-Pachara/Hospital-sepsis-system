import { useState, useEffect } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { Patient, RiskLevel } from '../types';
import { maskHN } from '../utils/hnMask';

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
  const risk = riskConfig[patient.currentRiskLevel];

  const genderIcon = patient.gender === 'male' ? '♂' : patient.gender === 'female' ? '♀' : '⚥';
  const genderLabel = patient.gender === 'male' ? 'ชาย' : patient.gender === 'female' ? 'หญิง' : 'อื่นๆ';

  const arrivalMinutes = Math.floor(
    (Date.now() - new Date(patient.arrivalTime).getTime()) / 60000
  );
  const arrivalTime = new Date(patient.arrivalTime).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isHighRisk = patient.currentRiskLevel === 'high';
  const isMissingData = patient.latestNewsResult?.missingDataCount && patient.latestNewsResult.missingDataCount > 0;

  return (
    <button
      id={`patient-card-${patient.id}`}
      onClick={() => selectPatient(patient.id)}
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

      {/* Top row: HN + Badge */}
      <div className="flex justify-between items-start" style={{ marginLeft: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{maskHN(patient.hn)}</div>
        <span
          className={isHighRisk ? 'animate-blink-badge' : ''}
          style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '10px',
            background: risk.badgeBg,
            color: risk.badgeText,
            border: `1px solid ${risk.badgeBorder}`,
          }}
        >
          {isHighRisk ? '🔴 ' : isMissingData ? '⚪ ' : '🟢 '}
          {isHighRisk ? risk.labelTh : isMissingData ? 'รอประเมิน' : risk.labelTh}
        </span>
      </div>

      {/* Info */}
      <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px', marginLeft: '8px' }}>
        {genderIcon} {genderLabel} · {patient.age} ปี · {patient.location}
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
            NEWS {patient.latestNewsScore} — {risk.label}
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
        🕐 {arrivalTime} · {isSelected ? 'กำลังดูแล' : `${arrivalMinutes} นาทีที่แล้ว`}
      </div>
    </button>
  );
}

export default function Sidebar() {
  const { patients, selectedPatient } = useRTSASStore();
  const [filter, setFilter] = useState<'all' | 'alert'>('all');
  const [lastRefresh, setLastRefresh] = useState('');

  // Sort patients by risk: high → medium → low_medium → low
  const riskOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low_medium: 2, low: 3 };
  const sortedPatients = [...patients].sort(
    (a, b) => riskOrder[a.currentRiskLevel] - riskOrder[b.currentRiskLevel]
  );

  const alertCount = patients.filter((p) => p.hasSepsisAlert).length;

  const filteredPatients = filter === 'alert'
    ? sortedPatients.filter((p) => p.hasSepsisAlert)
    : sortedPatients;

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
        <span style={{
          background: '#2563eb', color: '#fff', borderRadius: '10px',
          padding: '1px 8px', fontSize: '11px', fontWeight: 700,
        }}>
          {patients.length}
        </span>
      </div>

      {/* Refresh bar */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{ padding: '5px 14px', borderBottom: '1px solid #dde3ed', background: '#f8fafc' }}
      >
        <span className="flex items-center gap-1" style={{ fontSize: '9px', color: '#64748b' }}>
          <span className="animate-pulse-green inline-block" style={{
            width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e',
          }} />
          รีเฟรชออโต้
        </span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8' }}>{lastRefresh}</span>
      </div>

      {/* Filter buttons */}
      <div
        className="flex gap-1 flex-wrap flex-shrink-0"
        style={{ padding: '8px 10px', borderBottom: '1px solid #dde3ed' }}
      >
        <button
          className={`transition-all ${filter === 'all' ? 'text-white' : ''}`}
          onClick={() => setFilter('all')}
          style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            border: `1px solid #2563eb`,
            background: filter === 'all' ? '#2563eb' : 'transparent',
            color: filter === 'all' ? '#fff' : '#2563eb',
          }}
        >
          ทั้งหมด {patients.length}
        </button>
        <button
          className="transition-all"
          onClick={() => setFilter('alert')}
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
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPatients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '11px', color: '#94a3b8' }}>
            ไม่พบผู้ป่วย
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              isSelected={selectedPatient?.id === patient.id}
            />
          ))
        )}
      </div>
    </aside>
  );
}
