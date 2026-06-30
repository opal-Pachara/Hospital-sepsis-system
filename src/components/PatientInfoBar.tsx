import { useEffect, useState } from 'react';
import type { Patient } from '../types';

export default function PatientInfoBar({ patient }: { patient: Patient }) {
  const [erElapsed, setErElapsed] = useState('00:00');

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(patient.arrivalTime).getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setErElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [patient.arrivalTime]);

  const arrivalTimeStr = new Date(patient.arrivalTime).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const genderIcon = patient.gender === 'male' ? '♂' : patient.gender === 'female' ? '♀' : '⚥';
  const genderLabel = patient.gender === 'male' ? 'ชาย' : patient.gender === 'female' ? 'หญิง' : 'อื่นๆ';
  const isHighRisk = patient.currentRiskLevel === 'high' || patient.currentRiskLevel === 'medium';

  return (
    <div
      className="bg-white border border-border-default rounded-xl px-3.5 py-2.5 flex flex-col gap-1.5 relative overflow-hidden"
      style={{ paddingLeft: '18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}
    >
      {/* Left gradient bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[5px]"
        style={{
          background: isHighRisk
            ? 'linear-gradient(to bottom, #dc2626, #ea580c)'
            : 'linear-gradient(to bottom, #16a34a, #22c55e)',
          borderRadius: '12px 0 0 12px',
        }}
      />

      {/* Row 1: HN + Alert badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold text-text-primary">{patient.hn}</div>
        {patient.hasSepsisAlert && (
          <div
            className="py-1 px-2.5 rounded-lg text-[11px] font-extrabold text-center whitespace-nowrap flex-shrink-0 animate-pulse-red"
            style={{
              background: '#fef2f2',
              border: '2px solid #dc2626',
              color: '#dc2626',
            }}
          >
            เสี่ยงติดเชื้อในกระแสเลือด — ต้องประเมินทันที
          </div>
        )}
      </div>

      {/* Row 2: Detail */}
      <div className="text-[11px] text-text-secondary">
        คัดกรอง: {arrivalTimeStr} น. &nbsp;·&nbsp; {patient.location}
      </div>

      {/* Row 3: Badges + ER time */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold py-0.5 px-2 rounded-[10px] whitespace-nowrap"
            style={{ background: '#eff6ff', border: '1px solid #93c5fd', color: '#2563eb' }}>
            {genderIcon} {genderLabel}
          </span>
          <span className="text-[10px] font-semibold py-0.5 px-2 rounded-[10px] whitespace-nowrap"
            style={{ background: '#ecfeff', border: '1px solid #67e8f9', color: '#0891b2' }}>
            {patient.age} ปี
          </span>
          <span className="text-[10px] font-semibold py-0.5 px-2 rounded-[10px] whitespace-nowrap"
            style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }}>
            {patient.chiefComplaint}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] text-text-muted uppercase tracking-wider">เวลาใน ER</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: '#ea580c' }}>{erElapsed} นาที</span>
        </div>
      </div>
    </div>
  );
}
