import { useRTSASStore } from '../../store/useRTSASStore';

export default function MultiAlertModal() {
  const { ui, closeModal, patients, completeChecklistItem, pendingAlerts, selectPatient } = useRTSASStore();

  if (ui.modal.activeModal !== 'multi_alert') return null;

  const handleAcknowledge = (hn: string) => {
    const patient = patients.find(p => p.hn === hn);
    if (!patient) return;

    useRTSASStore.getState().markAlertDismissed(hn);

    // Sync acknowledgement to backend MySQL
    fetch('/api/treatment-status/acknowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hn,
        acknowledged_by: 'Nurse/System',
        vn: patient.vn,
      }),
    }).catch((err) => console.warn('[MultiAlertModal] Failed to sync acknowledge to backend:', err));

    const currentSelectedId = useRTSASStore.getState().ui.selectedPatientId;

    // Switch context to target patient
    selectPatient(patient.id);

    const alreadyRunning = Boolean(
      existingTimer?.isActive ||
      patient?.treatmentStatus?.countdown_started_at
    );

    if (!alreadyRunning) {
      const newsScore = patient?.latestNewsScore ?? 0;
      const riskLevel = patient?.currentRiskLevel ?? 'low';
      const arrivalTime = patient?.arrivalTime
        ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      useRTSASStore.getState().addTimelineEvent(
        `🏥 ผู้ป่วยมาถึง ER เวลา ${arrivalTime} น.`,
        'blue',
        'ระบบ'
      );
      useRTSASStore.getState().addTimelineEvent(
        `🧮 ระบบคำนวณ NEWS Score = ${newsScore} (${riskLevel === 'high' ? 'เสี่ยงสูง' : riskLevel === 'medium' ? 'เสี่ยงปานกลาง' : 'เสี่ยงต่ำ'})`,
        newsScore >= 5 ? 'red' : 'orange',
        'ระบบ RTSAS'
      );
      completeChecklistItem('triage', 'ระบบ/พยาบาล');
    }

    // Switch back
    if (currentSelectedId && currentSelectedId !== patient.id) {
      selectPatient(currentSelectedId);
    }

    // Remove from queue
    useRTSASStore.setState((s) => ({
      pendingAlerts: s.pendingAlerts.filter(a => a.hn !== hn)
    }));

    // If queue is now empty, close modal
    if (useRTSASStore.getState().pendingAlerts.length === 0) {
      closeModal();
    }
  };

  const handleAcknowledgeAll = () => {
    // Copy array because we mutate it in handleAcknowledge
    const alertsToAck = [...pendingAlerts];
    alertsToAck.forEach(alert => {
      handleAcknowledge(alert.hn);
    });
    closeModal();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '600px',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(220, 38, 38, .35), 0 0 0 1px rgba(220, 38, 38, .15)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
        }}
      >
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #dc2626, #f97316, #dc2626)' }} />

        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b', margin: 0 }}>🚨 คิวผู้ป่วยเสี่ยง Sepsis ระดับสูง</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>พบผู้ป่วย {pendingAlerts.length} ราย ที่ต้องได้รับการประเมินทันที</p>
          </div>
          <button
            onClick={closeModal}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#f1f5f9', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingAlerts.map(alert => {
              const patient = patients.find(p => p.hn === alert.hn);
              const name = patient?.fullName || alert.hn;
              const genderLabel = patient?.gender === 'male' ? 'ชาย' : patient?.gender === 'female' ? 'หญิง' : 'ไม่ระบุ';
              const ageLabel = patient?.age ? `${patient.age} ปี` : '';

              return (
                <div key={alert.hn} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px', background: '#f8fafc', borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                      HN {name} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 400 }}>({genderLabel} {ageLabel})</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
                      NEWS Score: {alert.newsScore}
                    </div>
                    {patient?.chiefComplaint && patient.chiefComplaint !== 'ไม่ระบุ' && (
                      <div style={{
                        fontSize: '11px', color: '#64748b', marginTop: '3px',
                        lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'break-word',
                        whiteSpace: 'normal', maxWidth: '380px',
                      }}>
                        🩺 {patient.chiefComplaint}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleAcknowledge(alert.hn)}
                    style={{
                      background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px',
                      padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    รับทราบ
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={closeModal}
            style={{
              padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              background: '#fff', color: '#64748b', border: '1px solid #cbd5e1', cursor: 'pointer'
            }}
          >
            ปิด
          </button>
          <button
            onClick={handleAcknowledgeAll}
            style={{
              padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
              background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer'
            }}
          >
            ✅ รับทราบทั้งหมด ({pendingAlerts.length} ราย)
          </button>
        </div>
      </div>
    </div>
  );
}
