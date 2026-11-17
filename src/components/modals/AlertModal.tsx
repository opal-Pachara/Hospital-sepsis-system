import { useRTSASStore, requiresInitialAvpuO2Gate } from '../../store/useRTSASStore';
import { maskHN } from '../../utils/hnMask';

export const PARAM_LABELS_TH: Record<string, string> = {
  respiratoryRate: 'อัตราการหายใจ (RR)',
  spO2: 'ความอิ่มตัวออกซิเจน (SpO₂)',
  oxygenSupplementation: 'ออกซิเจนเสริม (O₂)',
  temperature: 'อุณหภูมิร่างกาย (Temp)',
  systolicBP: 'ความดันโลหิตซิสโตลิก (SBP)',
  heartRate: 'อัตราชีพจร (HR)',
  avpu: 'ระดับความรู้สึกตัว (AVPU)',
};

export const CRITICAL_PARAM_THRESHOLDS_TH: Record<string, string> = {
  respiratoryRate: 'เกณฑ์ +3: ≤8 หรือ ≥25 ครั้ง/นาที',
  spO2: 'เกณฑ์ +3: ≤91%',
  temperature: 'เกณฑ์ +3: ≤35.0°C',
  systolicBP: 'เกณฑ์ +3: ≤90 หรือ ≥220 mmHg',
  heartRate: 'เกณฑ์ +3: ≤40 หรือ ≥131 ครั้ง/นาที',
  avpu: 'เกณฑ์ +3: V / P / U (ระดับความรู้สึกตัวลดลง)',
};

import type { NEWSParameterScore, Patient } from '../../types';

export function filterDisplayBreakdownItems(breakdown?: NEWSParameterScore[]): NEWSParameterScore[] {
  return (breakdown || []).filter(
    (p) => !(p.parameter === 'oxygenSupplementation' && (p.displayValue.includes('ยังไม่') || p.displayValue.includes('รอ')))
  );
}

const SHORT_PARAM_PREFIX: Partial<Record<NEWSParameterScore['parameter'], string>> = {
  respiratoryRate: 'RR',
  spO2: 'SpO₂',
  temperature: 'Temp',
  systolicBP: 'SBP',
  heartRate: 'HR',
};

/** Parameter chip row highlighting ONLY score === 3 in red; scores < 3 stay normal neutral. */
export function NewsBreakdownChips({ items, neutralBg = '#f8fafc' }: { items: NEWSParameterScore[]; neutralBg?: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
      {items.map((p) => {
        const isUnassessed =
          p.displayValue.includes('รอประเมิน') ||
          p.displayValue.includes('ยังไม่ประเมิน') ||
          p.displayValue.includes('ยังไม่ระบุ') ||
          p.displayValue.includes('รอเลือก');
        const isCriticalParam = !isUnassessed && p.score === 3;
        const prefix = SHORT_PARAM_PREFIX[p.parameter];
        const valueText = prefix ? `${prefix} ${p.displayValue}` : p.displayValue;
        return (
          <span
            key={p.parameter}
            data-critical-param={isCriticalParam ? 'true' : 'false'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '9px',
              fontWeight: isCriticalParam ? 800 : 600,
              color: isCriticalParam ? '#b91c1c' : '#475569',
              background: isCriticalParam ? '#fef2f2' : neutralBg,
              border: isCriticalParam ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '2px 6px',
              whiteSpace: 'nowrap',
              ...(isCriticalParam ? { boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.12)' } : {}),
            }}
          >
            {isUnassessed ? (
              `${p.parameter === 'avpu' ? 'AVPU: ยังไม่ประเมิน' : 'O₂: ยังไม่ระบุ'} (—)`
            ) : isCriticalParam ? (
              <>
                <span>{valueText}</span>
                <span style={{
                  background: '#dc2626',
                  color: '#fff',
                  padding: '0 5px',
                  borderRadius: '4px',
                  fontWeight: 800,
                }}>
                  +3
                </span>
              </>
            ) : (
              <>
                <span>{valueText}</span>
                <span style={{ opacity: 0.75 }}>+{p.score}</span>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

export interface AlertModalContentProps {
  patient: Patient | null | undefined;
  alertNewsScore: number;
  pendingCount: number;
  onAcknowledge: () => void;
  onClose: () => void;
}

export default function AlertModal() {
  const { ui, closeModal, selectedPatient, pendingAlerts, selectPatient } = useRTSASStore();

  if (ui.modal.activeModal !== 'alert') return null;

  const data = ui.modal.modalData as {
    newsScore: number;
    patientName?: string;
    hn?: string;
  } | null;

  if (!data) return null;

  // Use modal data as primary source (patient may not be selected when alert queued)
  const alertHN = data.hn || data.patientName || '';
  const alertNewsScore = data.newsScore;

  // Try to find the alerted patient in the list
  const alertedPatient = useRTSASStore.getState().patients.find(
    (p) => p.hn === alertHN || p.id === alertHN || (data.patientName && p.fullName === data.patientName)
  );
  const patient = alertedPatient ?? selectedPatient;

  const advanceQueue = () => {
    const targetHn = alertedPatient?.hn ?? alertHN;
    const remainingAlerts = useRTSASStore.getState().pendingAlerts.filter((a) => a.hn !== targetHn);
    useRTSASStore.setState({ pendingAlerts: remainingAlerts });

    // Mark alert as dismissed in store so page refresh won't pop it up again
    useRTSASStore.getState().markAlertDismissed(targetHn);

    closeModal();

    // If more alerts exist in queue, pop up the next alert seamlessly
    if (remainingAlerts.length > 0) {
      const nextAlert = remainingAlerts[0];
      const nextPatient = useRTSASStore.getState().patients.find(
        (p) => p.hn === nextAlert.hn || p.id === nextAlert.hn
      );
      setTimeout(() => {
        useRTSASStore.getState().openModal('alert', {
          hn: nextAlert.hn,
          newsScore: nextAlert.newsScore,
          patientName: nextPatient?.fullName || nextAlert.hn,
        });
      }, 250);
    }
  };

  const handleAcknowledge = () => {
    const targetHn = alertedPatient?.hn ?? alertHN;
    useRTSASStore.getState().markAlertDismissed(targetHn);

    // Sync acknowledgement to backend MySQL
    fetch('/api/treatment-status/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hn: targetHn,
        acknowledged_by: 'Nurse/System',
        vn: alertedPatient?.vn,
      }),
    }).catch((err) => console.warn('[AlertModal] Failed to sync acknowledge to backend:', err));

    const allPatients = useRTSASStore.getState().patients;
    const targetPatient = alertedPatient ?? allPatients.find((p) => p.hn === targetHn || p.id === targetHn);
    const targetPatientId = targetPatient?.id || targetHn;

    // Switch context to target patient
    selectPatient(targetPatientId);

    // Note (Principle 3): Acknowledging a NEWS alert NEVER starts the 60-minute Sepsis bundle countdown.
    // The 60-minute timer starts only when the doctor explicitly confirms Sepsis in Phase 2.
    const alreadyLogged = Boolean(
      targetPatient?.treatmentStatus?.acknowledged ||
      targetPatient?.treatmentStatus?.countdown_started_at
    );

    if (!alreadyLogged) {
      const nowIso = new Date().toISOString();
      const patient = targetPatient;
      const newsScore = patient?.latestNewsScore ?? alertNewsScore ?? 0;
      const riskLevel = patient?.currentRiskLevel ?? 'low';
      const arrivalIso = patient?.arrivalTime || nowIso;
      const arrivalTime = patient?.arrivalTime
        ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      useRTSASStore.getState().addTimelineEvent(
        `🏥 ผู้ป่วยมาถึง ER เวลา ${arrivalTime} น.`,
        'blue',
        'ระบบ',
        undefined,
        arrivalIso,
        targetPatientId
      );

      const calcIso = patient?.latestNewsResult?.calculatedAt || nowIso;
      useRTSASStore.getState().addTimelineEvent(
        `🧮 ระบบคำนวณ NEWS Score = ${newsScore}${patient?.latestNewsResult?.isComplete === false ? ' (ข้อมูลยังไม่ครบ)' : ''} (${riskLevel === 'high' ? 'เสี่ยงสูง' : riskLevel === 'medium' ? 'เสี่ยงปานกลาง' : 'เสี่ยงต่ำ'})`,
        newsScore >= 5 ? 'red' : 'orange',
        'ระบบ RTSAS',
        undefined,
        calcIso,
        targetPatientId
      );
    }

    advanceQueue();

    if (
      useRTSASStore.getState().pendingAlerts.length === 0 &&
      targetPatient &&
      requiresInitialAvpuO2Gate(targetPatient, useRTSASStore.getState().patientData)
    ) {
      useRTSASStore.getState().openModal('avpu_assessment', {
        patientId: targetPatient.id,
        hn: targetPatient.hn,
        gcs: targetPatient.latestVitals.gcs,
        patientName: targetPatient.fullName,
        isInitialGate: true,
      });
    }
  };

  const handleClose = () => {
    const targetHn = alertedPatient?.hn ?? alertHN;
    useRTSASStore.getState().markAlertDismissed(targetHn);
    advanceQueue();
  };

  return (
    <AlertModalContent
      patient={patient}
      alertNewsScore={alertNewsScore}
      pendingCount={pendingAlerts.length}
      onAcknowledge={handleAcknowledge}
      onClose={handleClose}
    />
  );
}

export function AlertModalContent({
  patient,
  alertNewsScore,
  pendingCount,
  onAcknowledge,
  onClose,
}: AlertModalContentProps) {
  const genderLabel = patient?.gender === 'male' ? 'เพศชาย' : patient?.gender === 'female' ? 'เพศหญิง' : 'ไม่ระบุ';
  const arrivalTimeStr = patient
    ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  const breakdownItems = filterDisplayBreakdownItems(patient?.latestNewsResult?.breakdown);
  const criticalParams = breakdownItems.filter((p) => p.score === 3);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
    >
      {/* Queue badge — shows how many more alerts are waiting */}
      {pendingCount > 0 && (
        <div style={{
          position: 'absolute', top: '20px', right: '20px',
          background: '#dc2626', color: '#fff',
          borderRadius: '999px', padding: '6px 14px',
          fontSize: '12px', fontWeight: 700,
          boxShadow: '0 4px 12px rgba(220,38,38,.4)',
          zIndex: 110,
        }}>
          🔔 รอแจ้งเตือนอีก {pendingCount} ราย
        </div>
      )}
      <div
        className="animate-slideUp"
        style={{
          width: '520px',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(220, 38, 38, .35), 0 0 0 1px rgba(220, 38, 38, .15)',
        }}
      >
        {/* ─── Red Top Accent Bar ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #dc2626, #f97316, #dc2626)' }} />

        {/* ─── Header ─── */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fef2f2 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(252, 165, 165, .5)',
        }}>
          {/* Pulsing alarm icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', flexShrink: 0,
            boxShadow: '0 6px 20px rgba(220, 38, 38, .4)',
          }} className="animate-shake">
            🚨
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#dc2626', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              🔴 แจ้งเตือน — เสี่ยงติดเชื้อในกระแสเลือด
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>
              ระบบตรวจพบคะแนน NEWS เกินเกณฑ์ — ต้องประเมินทันที
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid #fca5a5', background: '#fff',
              color: '#dc2626', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dc2626'; }}
          >✕</button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '20px 24px 24px' }}>

          {/* Patient Info Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #fef2f2, #fff5f5)',
            border: '1px solid #fecaca', marginBottom: '16px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: '#fef2f2', border: '2px solid #fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
            }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.2px' }}>
                {maskHN(patient?.hn || 'N/A')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                {genderLabel}{patient?.age ? ` · อายุ ${patient.age} ปี` : ''} · เวลาคัดกรอง {arrivalTimeStr}
              </div>
              {patient?.chiefComplaint && patient.chiefComplaint !== 'ไม่ระบุ' && (
                <div style={{
                  fontSize: '11px', color: '#991b1b', marginTop: '5px',
                  lineHeight: '1.45', wordBreak: 'break-word', overflowWrap: 'break-word',
                  whiteSpace: 'normal', background: '#fff', border: '1px solid #fecaca',
                  borderRadius: '6px', padding: '4px 8px',
                }}>
                  <span style={{ fontWeight: 700 }}>🩺 อาการสำคัญ: </span>
                  <span>{patient.chiefComplaint}</span>
                </div>
              )}
            </div>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: '#dc2626',
              background: '#fff', border: '1.5px solid #fca5a5', borderRadius: '8px',
              padding: '6px 10px', textAlign: 'center', lineHeight: 1.5,
              flexShrink: 0,
            }}>
              🔴 เสี่ยง<br />ติดเชื้อในกระแสเลือด
            </div>
          </div>

          {/* NEWS Score Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '18px',
            padding: '16px 18px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
            border: '1px solid #fecaca', marginBottom: '16px',
          }}>
            {/* Big score */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(220, 38, 38, .3)',
            }}>
              <span style={{ fontSize: '34px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{alertNewsScore}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                NEWS Score
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', marginTop: '3px' }}>
                ⚠ เสี่ยงติดเชื้อในกระแสเลือด
              </div>
              {patient?.latestNewsResult?.isComplete === false && (
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#b45309', marginTop: '2px' }}>
                  ⚠️ ข้อมูล AVPU / O₂ ยังไม่ครบถ้วน (แจ้งเตือนทันทีจากคะแนนที่มี ≥ 5)
                </div>
              )}
              <NewsBreakdownChips items={breakdownItems} />
            </div>
          </div>

          {criticalParams.length > 0 && (
            <div
              data-testid="alert-critical-params-box"
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#fef2f2',
                border: '1.5px solid #dc2626',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#b91c1c', marginBottom: '6px' }}>
                🚨 พารามิเตอร์ที่เข้าเงื่อนไขวิกฤต (+3 คะแนน):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {criticalParams.map((cp) => (
                  <span
                    key={cp.parameter}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#b91c1c',
                      background: '#fff',
                      border: '1.5px solid #dc2626',
                      borderRadius: '8px',
                      padding: '3px 8px',
                    }}
                  >
                    <span>{PARAM_LABELS_TH[cp.parameter] || cp.label}: {cp.displayValue}</span>
                    <span style={{ background: '#dc2626', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontSize: '10px' }}>
                      +3
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alert message */}
          <div style={{
            padding: '12px 14px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
            border: '1px solid #fed7aa', marginBottom: '18px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
              background: 'linear-gradient(to bottom, #f97316, #ea580c)',
              borderRadius: '12px 0 0 12px',
            }} />
            <div style={{ paddingLeft: '10px', fontSize: '12px', color: '#475569', lineHeight: 1.8 }}>
              <strong style={{ color: '#ea580c' }}>เกณฑ์:</strong> NEWS ≥ 5 (หรือคะแนนจากองค์ประกอบที่ทราบแล้ว ≥ 5) → เสี่ยงติดเชื้อในกระแสเลือด — แจ้งเตือนทันที<br />
              <strong style={{ color: '#ea580c' }}>ขั้นตอนต่อไป:</strong> ประเมิน AVPU / O₂ ให้ครบถ้วน → นำเข้าห้อง ER → รายงานแพทย์เวร <strong>(เริ่มจับเวลา 60 นาทีเมื่อแพทย์ยืนยัน Sepsis ใน Phase 2)</strong>
            </div>
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f6e9a1ff)',
            border: '1px solid #fed7aa', marginBottom: '18px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ paddingLeft: '10px', fontSize: '12px', color: '#475569', lineHeight: 1.8 }}>
              <strong style={{ color: '#000000ff' }}>หมายเหตุ:</strong> คะแนน NEWS เป็นเครื่องมือประเมินความเสี่ยงต่อการทรุดลงทางคลินิก ไม่ใช่เครื่องมือวินิจฉัยภาวะติดเชื้อในกระแสเลือด การวินิจฉัยต้องอาศัยการประเมินของแพทย์<br />
            </div>
          </div>
          

          {/* Acknowledge Button */}
          <button
            id="alert-acknowledge-btn"
            onClick={onAcknowledge}
            style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: '14px',
              fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              color: '#fff',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              boxShadow: '0 6px 20px -4px rgba(220, 38, 38, .4)',
              transition: 'all 0.25s ease',
              letterSpacing: '-0.2px',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(220, 38, 38, .5)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(220, 38, 38, .4)'; }}
          >
            ✅ รับทราบ — เริ่มกระบวนการดูแลภาวะติดเชื้อในกระแสเลือด
          </button>
        </div>
      </div>
    </div>
  );
}
