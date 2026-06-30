import { useState, useEffect } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { Patient, RiskLevel } from '../types';

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
      className="w-full text-left border-b border-border-default relative bg-white"
      style={{
        padding: '10px 14px',
        ...(isSelected ? { background: '#eff6ff', borderLeft: '3px solid #2563eb' } : {}),
      }}
    >
      {/* Alert bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: risk.barColor, borderRadius: '0 2px 2px 0' }}
      />

      {/* Top row: HN + Badge */}
      <div className="flex justify-between items-start" style={{ marginLeft: '8px' }}>
        <div className="text-xs font-bold text-text-primary">{patient.hn}</div>
        <span
          className={`text-[9px] font-bold py-0.5 px-1.5 rounded-[10px] ${isHighRisk ? 'animate-blink-badge' : ''}`}
          style={{
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
      <div className="text-[10px] text-text-secondary mt-0.5" style={{ marginLeft: '8px' }}>
        {genderIcon} {genderLabel} · {patient.age} ปี · {patient.location}
      </div>

      {/* Score Chip */}
      <div className="flex gap-2 mt-1" style={{ marginLeft: '8px' }}>
        {isMissingData ? (
          <span
            className="text-[10px] font-bold py-0.5 px-2 rounded-lg"
            style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', fontSize: '9px' }}
          >
            ⚠ คำนวณ NEWS ไม่ได้
          </span>
        ) : (
          <span
            className="text-[10px] font-bold py-0.5 px-2 rounded-lg whitespace-nowrap"
            style={{ background: risk.chipBg, color: risk.chipText, border: `1px solid ${risk.chipBorder}` }}
          >
            NEWS {patient.latestNewsScore} — {risk.label}
          </span>
        )}
      </div>

      {/* Missing data info */}
      {isMissingData && (
        <div className="text-[9px] text-text-muted mt-0.5" style={{ marginLeft: '8px' }}>
          ขาดข้อมูล: {patient.latestNewsResult?.missingDataCount} รายการ
        </div>
      )}

      {/* Time */}
      <div className="text-[9px] text-text-muted mt-1" style={{ marginLeft: '8px' }}>
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
    <aside className="w-[260px] bg-surface-sidebar border-r border-border-default flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-white border-b border-border-default flex items-center justify-between">
        <span className="text-xs font-bold text-text-primary uppercase tracking-wider">📋 รายชื่อผู้ป่วย</span>
        <span className="bg-brand-primary text-white rounded-[10px] px-2 py-0.5 text-[11px] font-bold">
          {patients.length}
        </span>
      </div>

      {/* Refresh bar */}
      <div className="px-3.5 py-1.5 border-b border-border-default bg-surface-elevated flex items-center justify-between">
        <span className="text-[9px] text-text-muted flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse-green inline-block" />
          รีเฟรชทุก 10 วินาที
        </span>
        <span className="text-[9px] text-text-muted">{lastRefresh}</span>
      </div>

      {/* Filter buttons */}
      <div className="px-2.5 py-2 border-b border-border-default flex gap-1 flex-wrap">
        <button
          className={`py-0.5 px-2.5 rounded-[20px] border text-[10px] font-semibold cursor-pointer transition-all ${
            filter === 'all'
              ? 'bg-brand-primary text-white border-brand-primary'
              : 'bg-transparent text-brand-primary border-brand-primary'
          }`}
          onClick={() => setFilter('all')}
        >
          ทั้งหมด {patients.length}
        </button>
        <button
          className={`py-0.5 px-2.5 rounded-[20px] border text-[10px] font-semibold cursor-pointer transition-all ${
            filter === 'alert'
              ? 'bg-status-error text-white border-status-error'
              : 'bg-transparent text-status-error border-status-error'
          }`}
          onClick={() => setFilter('alert')}
        >
          🔴 เสี่ยง {alertCount}
        </button>
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
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
