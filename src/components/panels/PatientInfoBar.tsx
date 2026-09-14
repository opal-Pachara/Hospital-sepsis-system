import { useEffect, useState } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import type { Patient } from '../../types';
import { maskHN } from '../../utils/hnMask';

export default function PatientInfoBar({ patient }: { patient: Patient }) {
  const [erElapsed, setErElapsed] = useState('');
  const [isOldData, setIsOldData] = useState(false);
  const { patientData, selectPatient } = useRTSASStore();
  const pData = patientData[patient.id];
  const isTreatmentCompleted = (pData?.treatmentCompleted ?? false) || (patient.treatmentStatus?.treatment_completed ?? false);
  const isRuledOut = (pData?.sepsisRuledOut ?? false) || (patient.treatmentStatus?.sepsis_ruled_out ?? false);

  useEffect(() => {
    const arrivalMs = new Date(patient.arrivalTime).getTime();

    const update = () => {
      const diff = Date.now() - arrivalMs;
      const hours = diff / 3600000;

      if (hours > 24) {
        // Data is from a previous day — don't show a meaningless elapsed counter
        setIsOldData(true);
        setErElapsed('');
      } else {
        setIsOldData(false);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setErElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
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
  const isHighRisk = (patient.currentRiskLevel === 'high' || patient.currentRiskLevel === 'medium') && !isTreatmentCompleted && !isRuledOut;

  return (
      <div
        className="bg-white border border-[#dde3ed] rounded-xl relative overflow-hidden"
        style={{ padding: '10px 14px 10px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}
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
      <div className="flex items-center justify-between gap-2" style={{ marginBottom: '6px' }}>
        <div className="flex items-center gap-2">
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>{maskHN(patient.hn)}</div>
          <button
            type="button"
            id="btn-deselect-patient"
            onClick={() => selectPatient('')}
            title="ยกเลิกการเลือกผู้ป่วย (กลับหน้าว่าง)"
            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>✕</span>
            <span>ปิด</span>
          </button>
        </div>
        {isTreatmentCompleted ? (
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 800,
              textAlign: 'center',
              background: '#ecfdf5',
              border: '1.5px solid #10b981',
              color: '#059669',
              whiteSpace: 'nowrap',
            }}
          >
            ✅ สิ้นสุดการรักษาแล้ว
          </div>
        ) : isRuledOut ? (
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 800,
              textAlign: 'center',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#16a34a',
              whiteSpace: 'nowrap',
            }}
          >
            🟢 ไม่ใช่ภาวะ Sepsis (Rule Out)
          </div>
        ) : isOldData ? (
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 700,
              textAlign: 'center',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#64748b',
              whiteSpace: 'nowrap',
            }}
          >
            🔒 ประวัติย้อนหลัง (ปิดเคสแล้ว)
          </div>
        ) : patient.hasSepsisAlert ? (
          <div
            className="animate-pulse-red flex-shrink-0"
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 800,
              textAlign: 'center',
              background: '#fef2f2',
              border: '1.5px solid #dc2626',
              color: '#dc2626',
              whiteSpace: 'nowrap',
              lineHeight: 1.3,
            }}
          >
            เสี่ยงติดเชื้อในกระแสเลือด — ต้องประเมินทันที
          </div>
        ) : (
          <div
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10.5px',
              fontWeight: 700,
              textAlign: 'center',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              color: '#16a34a',
              whiteSpace: 'nowrap',
            }}
          >
            🟢 สถานะปกติ
          </div>
        )}
      </div>

      {/* Row 2: Demographic Badges & Location & ER Time */}
      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginBottom: '4px' }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb',
            whiteSpace: 'nowrap',
          }}>
            {genderIcon} {genderLabel}
          </span>
          {(patient.age && patient.age > 0) ? (
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 7px',
              borderRadius: '6px', background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0891b2',
              whiteSpace: 'nowrap',
            }}>
              {patient.age} ปี
            </span>
          ) : null}
          <span style={{ fontSize: '10.5px', color: '#64748b' }}>
            คัดกรอง {arrivalTimeStr} น. &nbsp;·&nbsp; {patient.location}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOldData ? (
            <>
              <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                วันที่คัดกรอง
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                {new Date(patient.arrivalTime).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                เวลาใน ER
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
                {erElapsed} นาที
              </span>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Dedicated Chief Complaint Box (กล่องอาการสำคัญ ป้องกันข้อความล้น) */}
      {patient.chiefComplaint && (
        <div
          id="chief-complaint-box"
          style={{
            marginTop: '6px',
            padding: '7px 10px',
            borderRadius: '8px',
            background: isHighRisk ? '#fff5f5' : '#f8fafc',
            border: `1px solid ${isHighRisk ? '#fecaca' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: isHighRisk ? '#b91c1c' : '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
              marginTop: '1px',
              whiteSpace: 'nowrap',
            }}
          >
            <span>🩺</span>
            <span>อาการสำคัญ:</span>
          </span>
          <span
            style={{
              fontSize: '11px',
              lineHeight: '1.5',
              color: isHighRisk ? '#991b1b' : '#334155',
              fontWeight: 500,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              whiteSpace: 'normal',
              flex: 1,
            }}
          >
            {patient.chiefComplaint}
          </span>
        </div>
      )}
      </div>
  );
}
