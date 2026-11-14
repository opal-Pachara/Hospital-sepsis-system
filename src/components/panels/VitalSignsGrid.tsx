import type { NEWSResult, NEWSParameterScore } from '../../types';
import { useRTSASStore } from '../../store/useRTSASStore';

const paramConfig: Record<string, { icon: string; label: string; unit: string }> = {
  respiratoryRate: { icon: '🫁', label: 'RR', unit: 'ครั้ง/นาที' },
  spO2: { icon: '💉', label: 'SpO₂', unit: '%' },
  temperature: { icon: '🌡️', label: 'TEMP', unit: '°C' },
  systolicBP: { icon: '❤️', label: 'SBP', unit: 'mmHg' },
  heartRate: { icon: '🫀', label: 'HR', unit: 'ครั้ง/นาที' },
  avpu: { icon: '🧠', label: 'GCS/AVPU', unit: '' },
  oxygenSupplementation: { icon: '🔵', label: 'O₂', unit: '' },
};

const CARD_ORDER = ['respiratoryRate', 'spO2', 'temperature', 'systolicBP', 'heartRate'];

const scoreTagColors: Record<number, { bg: string; color: string }> = {
  0: { bg: '#dcfce7', color: '#16a34a' },
  1: { bg: '#fef9c3', color: '#ca8a04' },
  2: { bg: '#ffedd5', color: '#ea580c' },
  3: { bg: '#fee2e2', color: '#dc2626' },
};

const valueColors: Record<number, string> = {
  0: '#22c55e',
  1: '#eab308',
  2: '#f97316',
  3: '#ef4444',
};

/**
 * Extract only the numeric portion from displayValue
 * e.g. "28 bpm" → "28", "91%" → "91", "39.5°C" → "39.5", "V" → "V"
 */
function extractNumericValue(displayValue: string, parameter: string): string {
  if (parameter === 'avpu') return displayValue;
  // Remove known unit suffixes
  return displayValue
    .replace(/\s*bpm$/i, '')
    .replace(/%$/, '')
    .replace(/°C$/i, '')
    .replace(/\s*mmHg$/i, '')
    .trim();
}

function VitalCard({
  param,
  onAvpuClick,
}: {
  param: NEWSParameterScore;
  onAvpuClick?: () => void;
}) {
  const config = paramConfig[param.parameter] || { icon: '📊', label: param.label, unit: '' };
  const scoreTag = scoreTagColors[Math.min(param.score, 3)];
  const valColor = valueColors[Math.min(param.score, 3)];

  const isAvpu = param.parameter === 'avpu';
  const borderClass = param.score >= 3 ? 'border-[#fca5a5] bg-[#fef2f2]'
    : param.score >= 1 ? 'border-[#fdba74] bg-[#fff7ed]'
      : 'border-[#e2e8f0] bg-[#f8fafc]';

  // Extract clean numeric value — prevent duplicate units
  const rawValue = extractNumericValue(param.displayValue, param.parameter);
  const isPending = isAvpu && (rawValue.includes('รอ') || rawValue.includes('?'));

  let displayVal = rawValue;
  let unitLabel = config.unit;

  if (isAvpu) {
    if (isPending) {
      displayVal = rawValue.includes('15') ? 'Alert?' : rawValue.match(/GCS\s*\d+/)?.[0] || 'รอตรวจ';
      unitLabel = '🧠 คลิกเพื่อประเมิน';
    } else {
      const matchLevel = rawValue.match(/\b([AVPU])\b/)?.[1] || rawValue;
      displayVal = `[${matchLevel}]`;
      unitLabel = matchLevel === 'A' ? 'Alert (GCS 15)'
        : matchLevel === 'V' ? 'Voice (ตอบสนองเสียง)'
        : matchLevel === 'P' ? 'Pain (ตอบสนองเจ็บ)'
        : matchLevel === 'U' ? 'Unresponsive (หมดสติ)'
        : rawValue;
    }
  }

  return (
    <div
      onClick={isAvpu ? onAvpuClick : undefined}
      className={`rounded-[10px] border text-center relative overflow-hidden ${borderClass} ${
        isAvpu ? 'cursor-pointer hover:border-blue-400 hover:shadow-xs transition-all' : ''
      }`}
      style={{ padding: '10px 8px' }}
      title={isAvpu ? 'คลิกเพื่อประเมิน/แก้ไขระดับ AVPU' : undefined}
    >
      {/* Score tag circle */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: '4px', right: '4px',
          width: '18px', height: '18px',
          borderRadius: '50%',
          fontSize: '9px', fontWeight: 800,
          background: scoreTag.bg, color: scoreTag.color,
        }}
      >
        {isPending ? '?' : param.score}
      </div>

      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
        {config.label}
      </div>
      <div
        style={{
          fontSize: isAvpu ? '16px' : '20px',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          margin: '4px 0 2px',
          color: isPending ? '#ea580c' : valColor,
        }}
      >
        {displayVal}
      </div>
      <div style={{ fontSize: '9px', color: isPending ? '#b45309' : '#475569', fontWeight: isPending ? 700 : 400 }}>
        {unitLabel}
      </div>
    </div>
  );
}

export default function VitalSignsGrid({ newsResult }: { newsResult: NEWSResult }) {
  const {
    selectedPatient,
    patientData,
    assessmentSchedule,
    openModal,
  } = useRTSASStore();

  // Find the latest completed assessment entry from the patient's schedule (Phase 4)
  const schedule = (selectedPatient ? patientData[selectedPatient.id]?.assessmentSchedule : null) || assessmentSchedule;
  const completedEntries = (schedule?.entries || []).filter(
    (e) => e.isCompleted && e.newsResult
  );
  const latestAssessment = completedEntries.length > 0 ? completedEntries[completedEntries.length - 1] : null;

  // Use the re-assessed newsResult and timestamp if available, otherwise fall back to initial newsResult
  const effectiveNewsResult = latestAssessment?.newsResult || newsResult;
  const effectiveTimeIso = latestAssessment?.completedAt || latestAssessment?.newsResult?.calculatedAt || effectiveNewsResult.calculatedAt;

  let timeStr = '--:--:--';
  if (effectiveTimeIso) {
    try {
      const d = new Date(effectiveTimeIso);
      if (!isNaN(d.getTime())) {
        timeStr = d.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    } catch {
      timeStr = '--:--:--';
    }
  }

  const roundSuffix = latestAssessment ? ` (ประเมินซ้ำครั้งที่ ${latestAssessment.sequence})` : '';

  // Keep the 5 numeric vital sign cards in exact 3x2 order; 6th slot is GCS (ข้อมูลประกอบ)
  const displayParams = effectiveNewsResult.breakdown
    .filter((p) => p.parameter !== 'oxygenSupplementation' && p.parameter !== 'avpu')
    .sort((a, b) => {
      const idxA = CARD_ORDER.indexOf(a.parameter);
      const idxB = CARD_ORDER.indexOf(b.parameter);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

  const gcs = latestAssessment?.vitals?.gcs ?? selectedPatient?.latestVitals.gcs ?? 15;
  const rawTreatmentAvpuStatus = selectedPatient?.treatmentStatus?.avpu_status as string | undefined;
  const hasExplicitAvpu = Boolean(
    latestAssessment?.vitals?.avpu ||
    selectedPatient?.treatmentStatus?.assessed_avpu ||
    rawTreatmentAvpuStatus === 'confirmed' ||
    rawTreatmentAvpuStatus === 'assessed' ||
    rawTreatmentAvpuStatus === 'confirmed_alert' ||
    selectedPatient?.latestVitals.avpuStatus === 'confirmed' ||
    selectedPatient?.latestVitals.isAvpuConfirmed
  );
  const avpuStatus: 'confirmed' | 'pending_assessment' =
    hasExplicitAvpu || gcs === 15 ? 'confirmed' : 'pending_assessment';

  const effectiveAvpu =
    latestAssessment?.vitals?.avpu ||
    selectedPatient?.treatmentStatus?.assessed_avpu ||
    selectedPatient?.latestVitals.avpu ||
    'A';

  const rawO2 =
    latestAssessment?.vitals?.oxygenSupplementation ??
    selectedPatient?.treatmentStatus?.supplemental_oxygen ??
    selectedPatient?.latestVitals.oxygenSupplementation;

  const oxygenStatus: 'unassessed' | 'room_air' | 'supplemental' =
    rawO2 === true || rawO2 === 'supplemental'
      ? 'supplemental'
      : rawO2 === false || rawO2 === 'room_air'
      ? 'room_air'
      : 'unassessed';

  const isOxygenSupplemental = oxygenStatus === 'supplemental';
  const isOxygenUnassessed = oxygenStatus === 'unassessed';

  const handleOpenAvpuModal = (mode: 'avpu' | 'oxygen' = 'avpu') => {
    if (!selectedPatient) return;
    openModal('avpu_assessment', {
      patientId: selectedPatient.id,
      hn: selectedPatient.hn,
      gcs,
      patientName: selectedPatient.fullName,
      mode,
    });
  };

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title">
          <span>📊</span> สัญญาณชีพ — ณ เวลา {timeStr} น.{roundSuffix}
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8' }}>🔵 ตัวเลขในวงกลม = คะแนน NEWS 2012</div>
      </div>
      <div className="section-card-body">
        {/* AVPU Prompt Banner for selected patient (GCS < 15) */}
        {selectedPatient && avpuStatus === 'pending_assessment' && (
          <div
            style={{
              marginBottom: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#fffbeb',
              border: '1.5px solid #fcd34d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px', flexShrink: 0 }}>🧠</span>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#92400e', lineHeight: 1.35 }}>
                  ผู้ป่วยมี GCS {gcs} (&lt; 15) จาก HOSxP — โปรดประเมิน AVPU เพิ่มเติม
                </div>
                <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: '2px', lineHeight: 1.4 }}>
                  ระบบจะให้คะแนน AVPU (3 คะแนน) เมื่อพยาบาลประเมินและบันทึกผลในระบบเท่านั้น
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAvpuModal('avpu')}
              style={{
                background: '#d97706',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 14px',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
            >
              ประเมิน AVPU ตอนนี้
            </button>
          </div>
        )}

        {/* Oxygen Prompt Banner when preliminary score is 3–4 and O2 is unassessed */}
        {selectedPatient && effectiveNewsResult.needsOxygenPrompt && (
          <div
            style={{
              marginBottom: '10px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>💨</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400e' }}>
                  คะแนนเบื้องต้น {effectiveNewsResult.totalScore} คะแนน (3–4 คะแนน) — โปรดระบุการได้รับออกซิเจนเสริมก่อนสรุปผล
                </div>
                <div style={{ fontSize: '10px', color: '#b45309', marginTop: '1px' }}>
                  หากได้รับออกซิเจนเสริม (+2 คะแนน) คะแนนรวมจะถึงเกณฑ์แจ้งเตือน Sepsis (≥ 5 คะแนน)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAvpuModal('oxygen')}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              ระบุออกซิเจนตอนนี้
            </button>
          </div>
        )}

        {/* 6-Card Grid: 5 Scored Vital Parameters + 1 Informational GCS Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {displayParams.map((param) => (
            <VitalCard key={param.parameter} param={param} />
          ))}

          {/* 6th Card: GCS (ข้อมูลประกอบ) */}
          <div
            className="rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] text-center relative overflow-hidden"
            style={{ padding: '10px 8px' }}
          >
            <div
              style={{
                fontSize: '9.5px',
                color: '#334155',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <span>ℹ️</span>
              <span>GCS (ข้อมูลประกอบ)</span>
            </div>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                margin: '4px 0 2px',
                color: '#0f172a',
              }}
            >
              {gcs}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b' }}>
              จาก HOSxP (เต็ม 15)
            </div>
          </div>
        </div>

        {/* Dedicated Strip 1: AVPU (สำหรับคำนวณ NEWS) */}
        {selectedPatient && (
          <div
            style={{
              marginTop: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>👁️</span>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                  AVPU (สำหรับคำนวณ NEWS)
                </div>
                <div style={{ marginTop: '4px' }}>
                  {avpuStatus === 'pending_assessment' ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#e2e8f0',
                        color: '#334155',
                      }}
                    >
                      ⊖ ยังไม่ประเมิน (ยังไม่ให้คะแนน)
                    </span>
                  ) : effectiveAvpu === 'A' ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#dcfce7',
                        color: '#15803d',
                      }}
                    >
                      ✓ A — Alert (0 คะแนน)
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#fee2e2',
                        color: '#dc2626',
                      }}
                    >
                      ⚠️ {effectiveAvpu} (+3 คะแนน)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              id="btn-assess-avpu"
              onClick={() => handleOpenAvpuModal('avpu')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1.5px solid #3b82f6',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>✏️ ประเมิน AVPU</span>
            </button>
          </div>
        )}

        {/* Dedicated Strip 2: Supplemental Oxygen */}
        {selectedPatient && (
          <div
            style={{
              marginTop: '8px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🫁</span>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                  การได้รับออกซิเจนเสริม (Supplemental O₂)
                </div>
                <div style={{ marginTop: '4px' }}>
                  {isOxygenUnassessed ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#e2e8f0',
                        color: '#334155',
                      }}
                    >
                      ⊖ ยังไม่ระบุ (ยังไม่ให้คะแนน)
                    </span>
                  ) : isOxygenSupplemental ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#e0f2fe',
                        color: '#0369a1',
                      }}
                    >
                      💨 ได้รับออกซิเจนเสริม (+2 คะแนน)
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 700,
                        background: '#dcfce7',
                        color: '#15803d',
                      }}
                    >
                      ✓ ไม่ได้รับออกซิเจนเสริม (0 คะแนน)
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              id="btn-record-o2"
              onClick={() => handleOpenAvpuModal('oxygen')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 14px',
                borderRadius: '999px',
                border: '1.5px solid #3b82f6',
                background: '#ffffff',
                color: '#2563eb',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>✏️ บันทึกสถานะ O₂</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

