import type { NEWSResult, RiskLevel } from '../../types';

const paramLabels: Record<string, { icon: string; label: string; normalRange: string }> = {
  respiratoryRate: { icon: '🫁', label: 'อัตราการหายใจ (RR)', normalRange: '12–20' },
  spO2: { icon: '💉', label: 'SpO₂', normalRange: '≥ 96%' },
  temperature: { icon: '🌡️', label: 'อุณหภูมิร่างกาย', normalRange: '36.1–38.0' },
  systolicBP: { icon: '🩸', label: 'ความดันโลหิตซิสโตลิก (SBP)', normalRange: '111–219' },
  heartRate: { icon: '❤️', label: 'อัตราชีพจร (HR)', normalRange: '51–90' },
  avpu: { icon: '🧠', label: 'ระดับความรู้สึกตัว (AVPU)', normalRange: 'A (Alert)' },
  oxygenSupplementation: { icon: '🫁', label: 'การได้รับออกซิเจนเสริม (O₂)', normalRange: 'Room Air' },
};

const CANONICAL_PARAM_ORDER = [
  'respiratoryRate',
  'spO2',
  'temperature',
  'systolicBP',
  'heartRate',
  'avpu',
  'oxygenSupplementation',
];

const isUnassessedDisplay = (displayVal?: string) =>
  Boolean(
    displayVal &&
      (displayVal.includes('รอประเมิน') ||
        displayVal.includes('ยังไม่ประเมิน') ||
        displayVal.includes('ยังไม่ระบุ') ||
        displayVal.includes('รอเลือก'))
  );

const riskLabels: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'ปกติ', color: '#16a34a' },
  low_medium: { label: 'ปกติ', color: '#16a34a' },
  medium: { label: 'เฝ้าระวัง', color: '#ea580c' },
  high: { label: '⚠ เสี่ยงติดเชื้อ', color: '#ef4444' },
  incomplete: { label: 'รอประเมิน (ข้อมูลไม่ครบ)', color: '#64748b' },
};

const ptsClasses: Record<number, string> = {
  0: 'text-[#16a34a]',
  1: 'text-[#ca8a04]',
  2: 'text-[#ea580c]',
  3: 'text-[#dc2626]',
};

import { useRTSASStore } from '../../store/useRTSASStore';

export default function NewsCalculationLogic({ newsResult }: { newsResult: NEWSResult }) {
  const { selectedPatient, openModal } = useRTSASStore();

  const avpuParam = newsResult.breakdown?.find((p) => p.parameter === 'avpu');
  const o2Param = newsResult.breakdown?.find((p) => p.parameter === 'oxygenSupplementation');

  const isAvpuUnassessed = Boolean(
    isUnassessedDisplay(avpuParam?.displayValue) ||
      newsResult.needsAvpuPrompt ||
      newsResult.missingParameters?.some((p) => p.includes('AVPU'))
  );
  const isO2Unassessed = Boolean(
    isUnassessedDisplay(o2Param?.displayValue) ||
      newsResult.needsOxygenPrompt ||
      newsResult.missingParameters?.some((p) => p.includes('ออกซิเจน') || p.includes('O₂'))
  );

  const isPendingAvpuOrO2Only =
    newsResult.isComplete === false &&
    (newsResult.missingParameters?.every(
      (p) => p.includes('AVPU') || p.includes('Alert') || p.includes('ออกซิเจน') || p.includes('O₂')
    ) ?? true);

  const isPendingAvpu = isAvpuUnassessed;
  const isPendingO2Prompt = Boolean(newsResult.needsOxygenPrompt || isO2Unassessed);

  const isHighRiskPending = (newsResult.riskLevel === 'high' || newsResult.totalScore >= 5) && newsResult.isComplete === false;

  const assessedCount = Math.max(
    0,
    (newsResult.breakdown?.length || 7) - (isAvpuUnassessed ? 1 : 0) - (isO2Unassessed ? 1 : 0)
  );
  const missingBadgeDetail =
    isAvpuUnassessed && isO2Unassessed
      ? 'ยังไม่มีผล AVPU และ O₂'
      : isAvpuUnassessed
      ? 'ยังไม่มีผล AVPU'
      : isO2Unassessed
      ? 'ยังไม่มีผล O₂'
      : 'รอข้อมูลเพิ่มเติม';
  const missingInstruction =
    isAvpuUnassessed && isO2Unassessed
      ? 'AVPU และบันทึกสถานะการได้รับออกซิเจนเสริม'
      : isAvpuUnassessed
      ? 'AVPU'
      : 'สถานะการได้รับออกซิเจนเสริม (O₂)';

  // If missing basic vital signs (RR, SpO2, Temp, BP, HR)
  if (newsResult.riskLevel === 'incomplete' && !isPendingAvpuOrO2Only) {
    return (
      <div className="section-card">
        <div className="section-card-header">
          <div className="section-card-title"><span>🔍</span> การคำนวณ NEWS Score</div>
          <div style={{ fontSize: '9px', color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            ⏳ รอข้อมูลครบถ้วน
          </div>
        </div>
        <div className="section-card-body">
          <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              ข้อมูลสัญญาณชีพยังไม่ครบถ้วน
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
              ระบบ RTSAS ระงับการคำนวณคะแนน NEWS ชั่วคราว เพื่อความถูกต้องตามมาตรฐานความปลอดภัย
              {newsResult.missingParameters && newsResult.missingParameters.length > 0 && (
                <div style={{ marginTop: '10px', textAlign: 'left', background: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#dc2626', marginBottom: '4px' }}>รายการที่ยังไม่ได้บันทึก:</div>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '16px', margin: 0 }}>
                    {newsResult.missingParameters.map((p, idx) => (
                      <li key={idx} style={{ fontSize: '10px', color: '#b91c1c' }}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const risk = riskLabels[newsResult.riskLevel] ?? { label: 'ปกติ', color: '#16a34a' };

  // All 7 parameters of NEWS 2012 in canonical UI order (matching NEWS table layout)
  const orderedParams = [...newsResult.breakdown].sort((a, b) => {
    const ia = CANONICAL_PARAM_ORDER.indexOf(a.parameter);
    const ib = CANONICAL_PARAM_ORDER.indexOf(b.parameter);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const maxScore = 20; // 6 params * 3 + O2 * 2 = 20

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title"><span>🔍</span> การคำนวณ NEWS SCORE (NEWS 2012)</div>
        {!newsResult.isComplete ? (
          <div style={{
            fontSize: '9px',
            color: '#1e3a8a',
            background: '#f1f5f9',
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            lineHeight: 1.25,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '14px',
              height: '14px',
              borderRadius: '4px',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '9px',
              fontWeight: 800,
              flexShrink: 0,
            }}>i</span>
            <div>
              <div>ข้อมูลยังไม่ครบถ้วน</div>
              <div style={{ fontSize: '8.5px', fontWeight: 500, color: '#475569' }}>({missingBadgeDetail})</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '9px', color: '#0891b2', background: '#ecfeff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a5f3fc' }}>
            ✅ ตรวจสอบย้อนกลับได้
          </div>
        )}
      </div>
      <div className="section-card-body">
        <div className="flex flex-col gap-2.5">
          {/* NEWS Score Box */}
          <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: '1px solid #dde3ed' }}>
            {/* Score Header */}
            <div className="flex items-center justify-between" style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #dde3ed' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>
                  National Early Warning Score (NEWS 2012)
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Royal College of Physicians, 2012</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  lineHeight: 1,
                  color: !newsResult.isComplete ? '#ea580c' : risk.color,
                }}>
                  {newsResult.totalScore}
                </div>
                {!newsResult.isComplete ? (
                  <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '3px', color: '#d97706' }}>
                    ⚠️ ข้อมูลยังไม่ครบถ้วน
                  </div>
                ) : (
                  <div style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px', color: risk.color }}>
                    {risk.label}
                  </div>
                )}
              </div>
            </div>

            {/* Table header */}
            <div className="flex items-center" style={{
              padding: '5px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
              fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              <span className="flex-1">พารามิเตอร์</span>
              <span style={{ width: '90px', textAlign: 'center' }}>ค่าที่วัดได้</span>
              <span style={{ width: '72px', textAlign: 'center' }}>เกณฑ์ปกติ</span>
              <span style={{ width: '40px', textAlign: 'center' }}>คะแนน</span>
            </div>

            {/* Rows */}
            {orderedParams.map((param) => {
              const config = paramLabels[param.parameter] || { icon: '📊', label: param.label, normalRange: '—' };
              const isAvpuRowUnassessed =
                param.parameter === 'avpu' && (isAvpuUnassessed || isUnassessedDisplay(param.displayValue));
              const isO2RowUnassessed =
                param.parameter === 'oxygenSupplementation' && (isO2Unassessed || isUnassessedDisplay(param.displayValue));
              const isRowUnassessed = isAvpuRowUnassessed || isO2RowUnassessed;
              const isHighlight = !isRowUnassessed && param.score >= 3;
              const ptsClass = ptsClasses[Math.min(param.score, 3)];

              return (
                <div
                  key={param.parameter}
                  className="flex items-center"
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '11px',
                    ...(isRowUnassessed
                      ? { background: '#f8fafc', color: '#64748b' }
                      : isHighlight
                      ? { background: '#fef2f2' }
                      : {}),
                  }}
                >
                  <span className="flex-1" style={{ color: isRowUnassessed ? '#64748b' : '#475569' }}>
                    {config.icon} {config.label}
                  </span>
                  <span
                    style={{
                      width: '90px',
                      textAlign: 'center',
                      fontWeight: isRowUnassessed ? 500 : 600,
                      color: isRowUnassessed ? '#64748b' : '#0f172a',
                    }}
                  >
                    {isAvpuRowUnassessed
                      ? 'ยังไม่ประเมิน'
                      : isO2RowUnassessed
                      ? 'ยังไม่ระบุ'
                      : param.displayValue}
                  </span>
                  <span style={{ width: '72px', textAlign: 'center', fontSize: '9px', color: '#94a3b8' }}>
                    {isRowUnassessed ? '—' : config.normalRange}
                  </span>
                  <span
                    className={isRowUnassessed ? '' : ptsClass}
                    style={{
                      width: '40px',
                      textAlign: 'center',
                      fontWeight: isRowUnassessed ? 600 : 800,
                      fontSize: '13px',
                      color: isRowUnassessed ? '#94a3b8' : undefined,
                    }}
                  >
                    {isRowUnassessed ? '—' : `+${param.score}`}
                  </span>
                </div>
              );
            })}

            {/* Total row shown only when all 7 items are complete */}
            {newsResult.isComplete && (
              <div className="flex flex-col" style={{
                padding: '8px 12px',
                background: newsResult.totalScore >= 5 ? '#fef2f2' : '#f8fafc',
                borderTop: `1px solid ${newsResult.totalScore >= 5 ? '#fca5a5' : '#e2e8f0'}`,
              }}>
                <div className="flex justify-between items-center">
                  <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>รวม NEWS Score</span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: newsResult.totalScore >= 5 ? '#ef4444' : '#16a34a' }}>
                    {newsResult.totalScore} / {maxScore}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Callout Box */}
          {!newsResult.isComplete ? (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: '1px',
                }}>i</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', lineHeight: 1.45 }}>
                    หมายเหตุ: ระบบคำนวณ NEWS จากข้อมูลที่มีอยู่เท่านั้น (ขณะนี้ {assessedCount} รายการ = {newsResult.totalScore} คะแนน)
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#1e40af', marginTop: '3px', lineHeight: 1.45 }}>
                    กรุณาประเมิน {missingInstruction} เพื่อให้ระบบคำนวณคะแนน NEWS ได้ครบถ้วน
                  </div>
                </div>
              </div>

              {isHighRiskPending && (
                <div style={{
                  marginTop: '8px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  fontSize: '11px',
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}>
                  🚨 คะแนนจากข้อมูลที่มีอยู่ ≥ 5 ({newsResult.totalScore} คะแนน) — แจ้งเตือนความเสี่ยงสูงทันที โดยไม่รอผล AVPU / O₂ (การเริ่มจับเวลา 60 นาที จะเริ่มเมื่อแพทย์ยืนยัน Sepsis เท่านั้น)
                </div>
              )}

              {(isPendingAvpu || isPendingO2Prompt) && selectedPatient && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '6px', flexWrap: 'wrap' }}>
                  {isPendingAvpu && (
                    <button
                      type="button"
                      onClick={() => openModal('avpu_assessment', {
                        patientId: selectedPatient.id,
                        hn: selectedPatient.hn,
                        gcs: selectedPatient.latestVitals.gcs,
                        patientName: selectedPatient.fullName,
                        mode: 'avpu',
                      })}
                      style={{
                        background: '#ea580c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🧠 ประเมิน AVPU ตอนนี้
                    </button>
                  )}
                  {isO2Unassessed && (
                    <button
                      type="button"
                      onClick={() => openModal('avpu_assessment', {
                        patientId: selectedPatient.id,
                        hn: selectedPatient.hn,
                        gcs: selectedPatient.latestVitals.gcs,
                        patientName: selectedPatient.fullName,
                        mode: 'oxygen',
                      })}
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      💨 ระบุออกซิเจนเสริมตอนนี้
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔎</span> Logic การแจ้งเตือน & Safety Rule (NEWS 2012)
              </div>
              <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>IF</span> NEWS ≥ 5{' '}
                <span style={{ color: '#64748b', fontSize: '10px' }}>(เกณฑ์แจ้งเตือนความเสี่ยง Sepsis)</span><br />
                <span style={{ color: '#2563eb', fontWeight: 700 }}>→</span>{' '}
                <span style={{ color: '#dc2626', fontWeight: 700 }}>เสี่ยงติดเชื้อในกระแสเลือด 🔴</span>
                <br /><br />
                NEWS = <span style={{ color: '#2563eb', fontWeight: 700 }}>{newsResult.totalScore}</span>{' '}
                ({newsResult.totalScore >= 5 ? '≥ 5 ✓' : '< 5'})
                <div style={{
                  marginTop: '6px', padding: '4px 8px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 700,
                  ...(newsResult.totalScore >= 5
                    ? { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }
                    : { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }),
                }}>
                  {newsResult.totalScore >= 5 ? '🔴 เสี่ยงติดเชื้อในกระแสเลือด' : '🟢 ไม่พบความเสี่ยง'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
