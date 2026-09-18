import { useRTSASStore } from '../../store/useRTSASStore';
import { maskHN } from '../../utils/hnMask';

export default function AlertModal() {
  const { ui, closeModal, selectedPatient, completeChecklistItem, pendingAlerts, selectPatient } = useRTSASStore();

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

  const genderLabel = patient?.gender === 'male' ? 'เพศชาย' : patient?.gender === 'female' ? 'เพศหญิง' : 'ไม่ระบุ';
  const arrivalTimeStr = patient
    ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

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

    // If the alerted patient is not currently selected, select them first
    if (alertedPatient && alertedPatient.id !== selectedPatient?.id) {
      selectPatient(alertedPatient.id);
    }

    // Check if countdown is already running for this patient
    const targetPatientId = alertedPatient?.id ?? selectedPatient?.id ?? '';
    const existingTimer = targetPatientId ? useRTSASStore.getState().patientData[targetPatientId]?.countdownTimer : undefined;
    const alreadyRunning = Boolean(
      existingTimer?.isActive ||
      alertedPatient?.treatmentStatus?.countdown_started_at ||
      selectedPatient?.treatmentStatus?.countdown_started_at
    );

    if (!alreadyRunning) {
      // Start 60-minute bundle countdown immediately
      const nowIso = new Date().toISOString();
      useRTSASStore.getState().startCountdown(nowIso, targetPatientId);

      // Auto-record visit time + NEWS calculation in timeline with real timestamps
      const patient = alertedPatient ?? selectedPatient;
      const newsScore = patient?.latestNewsScore ?? 0;
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
        arrivalIso
      );

      const calcIso = patient?.latestNewsResult?.calculatedAt || nowIso;
      useRTSASStore.getState().addTimelineEvent(
        `🧮 ระบบคำนวณ NEWS Score = ${newsScore} (${riskLevel === 'high' ? 'เสี่ยงสูง' : riskLevel === 'medium' ? 'เสี่ยงปานกลาง' : 'เสี่ยงต่ำ'})`,
        newsScore >= 5 ? 'red' : 'orange',
        'ระบบ RTSAS',
        undefined,
        calcIso
      );
    }

    advanceQueue();
  };

  const handleClose = () => {
    const targetHn = alertedPatient?.hn ?? alertHN;
    useRTSASStore.getState().markAlertDismissed(targetHn);
    advanceQueue();
  };

  // Build breakdown rows from patient's NEWS result
  const breakdownItems = patient?.latestNewsResult?.breakdown
    .filter((p) => p.parameter !== 'oxygenSupplementation') || [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
    >
      {/* Queue badge — shows how many more alerts are waiting */}
      {pendingAlerts.length > 0 && (
        <div style={{
          position: 'absolute', top: '20px', right: '20px',
          background: '#dc2626', color: '#fff',
          borderRadius: '999px', padding: '6px 14px',
          fontSize: '12px', fontWeight: 700,
          boxShadow: '0 4px 12px rgba(220,38,38,.4)',
          zIndex: 110,
        }}>
          🔔 รอแจ้งเตือนอีก {pendingAlerts.length} ราย
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
            onClick={handleClose}
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
              {/* Parameter breakdown chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                {breakdownItems.map((p) => (
                  <span key={p.parameter} style={{
                    fontSize: '9px', fontWeight: 600, color: '#dc2626',
                    background: '#fff', border: '1px solid #fecaca', borderRadius: '6px',
                    padding: '2px 6px', whiteSpace: 'nowrap',
                  }}>
                    {p.displayValue} <span style={{ opacity: 0.7 }}>+{p.score}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

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
              <strong style={{ color: '#ea580c' }}>เกณฑ์:</strong> NEWS ≥ 5 → เสี่ยงติดเชื้อในกระแสเลือด<br />
              <strong style={{ color: '#ea580c' }}>ขั้นตอนต่อไป:</strong> ประเมินซ้ำที่จุดคัดแยก → นำเข้าห้อง ER → รายงานแพทย์เวรทันที
            </div>
          </div>

          {/* Acknowledge Button */}
          <button
            id="alert-acknowledge-btn"
            onClick={handleAcknowledge}
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
