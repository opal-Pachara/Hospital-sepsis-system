import { useState, useEffect } from 'react';
import { useRTSASStore, requiresInitialAvpuO2Gate } from '../../store/useRTSASStore';
import type { AVPULevel, OxygenStatus } from '../../types';
import { logClientEvent } from '../../utils/logHelpers';

export default function AVPUAssessmentModal() {
  const { ui, closeModal, assessAVPU, toggleOxygenSupplementation, patients, selectedPatient, patientData } = useRTSASStore();
  const [submitting, setSubmitting] = useState(false);
  const [selectedO2, setSelectedO2] = useState<OxygenStatus>('unassessed');
  const [pendingAvpu, setPendingAvpu] = useState<AVPULevel | null>(null);
  const [avpuExplicitlyPicked, setAvpuExplicitlyPicked] = useState(false);

  const isOpen = ui.modal.activeModal === 'avpu_assessment';
  const modalData = (ui.modal.modalData || {}) as {
    patientId?: string;
    hn?: string;
    gcs?: number;
    patientName?: string;
    mode?: 'avpu' | 'oxygen';
    isInitialGate?: boolean;
    previousPatientId?: string | null;
  };

  const patient =
    patients.find((p) => p.id === modalData.patientId || p.hn === modalData.hn) ||
    selectedPatient;

  const pData = patient ? (patientData[patient.id] || (patient.hn ? patientData[patient.hn] : undefined)) : undefined;
  const latestVitals = (pData as { latestVitals?: typeof patient extends { latestVitals: infer V } ? V : never } | undefined)?.latestVitals || patient?.latestVitals;
  const latestNews = pData?.latestNewsResult || patient?.latestNewsResult;

  useEffect(() => {
    if (isOpen && latestVitals) {
      setSelectedO2(latestVitals.oxygenSupplementation || 'unassessed');
      const gcsVal = modalData.gcs ?? latestVitals.gcs ?? 15;
      if (latestVitals.avpuStatus === 'confirmed' && latestVitals.avpu) {
        setPendingAvpu(latestVitals.avpu);
        setAvpuExplicitlyPicked(true);
      } else if (gcsVal === 15) {
        setPendingAvpu('A');
        setAvpuExplicitlyPicked(false);
      } else {
        setPendingAvpu(null);
        setAvpuExplicitlyPicked(false);
      }
    }
  }, [isOpen, patient?.id]);

  if (!isOpen) return null;

  const gcs = modalData.gcs ?? latestVitals?.gcs ?? 15;
  const hn = patient?.hn ?? modalData.hn ?? '';
  const patientName = patient?.fullName ?? modalData.patientName ?? hn;

  const isOxygenOnlyMode = modalData.mode === 'oxygen';

  // Calculate base score without AVPU and without O2
  const currentTotalScore = latestNews?.totalScore ?? 0;
  const currentO2Score = latestVitals?.oxygenSupplementation === 'supplemental' ? 2 : 0;
  const currentAvpuScore =
    latestVitals?.avpuStatus === 'pending_assessment' || latestVitals?.isAvpuConfirmed === false
      ? 0
      : latestVitals?.avpu && latestVitals.avpu !== 'A'
      ? 3
      : 0;
  const baseVitalsScore = Math.max(0, currentTotalScore - currentO2Score - currentAvpuScore);

  const submitCombinedAssessment = async (avpuLevel: AVPULevel, o2Status: 'room_air' | 'supplemental') => {
    if (!patient || submitting) return;
    setSubmitting(true);
    try {
      const isSupp = o2Status === 'supplemental';
      await assessAVPU(patient.id, avpuLevel, isSupp);
      const curUser = useRTSASStore.getState().currentUser;
      const actorName = curUser?.name || 'พยาบาลวิชาชีพ';
      const cleanHn = hn.toUpperCase().startsWith('HN') ? hn.slice(2).trim() : hn;
      logClientEvent({
        level: 'Note',
        component: 'Clinical_Treatment',
        message: `ยืนยันผลประเมิน AVPU (${avpuLevel}) และ O₂ (${isSupp ? 'ใช้ออกซิเจนเสริม +2' : 'Room Air 0'}) ก่อนเข้าหน้าประเมิน: ผู้ป่วย HN ${cleanHn || '-'} โดย ${actorName}`,
        details: {
          event: 'initial_avpu_o2_gate_completed',
          hn: hn || undefined,
          vn: patient.vn || undefined,
          avpu: avpuLevel,
          supplemental_oxygen: isSupp,
          actor: actorName,
        },
      });
      if (useRTSASStore.getState().ui.modal.activeModal === 'avpu_assessment') {
        closeModal();
      }
    } catch (err) {
      console.error('Error assessing AVPU + O2:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    const curState = useRTSASStore.getState();
    const stillNeedsGate = Boolean(
      patient &&
      modalData.mode !== 'oxygen' &&
      requiresInitialAvpuO2Gate(patient, curState.patientData)
    );
    closeModal();
    if (stillNeedsGate) {
      curState.selectPatient(modalData.previousPatientId ?? null);
    }
  };

  const handleSelectAvpu = async (level: AVPULevel) => {
    if (!patient || submitting) return;
    setPendingAvpu(level);
    setAvpuExplicitlyPicked(true);

    if (selectedO2 === 'unassessed') {
      return;
    }

    await submitCombinedAssessment(level, selectedO2);
  };

  const handleSelectO2 = async (status: 'room_air' | 'supplemental') => {
    if (!patient || submitting) return;
    setSelectedO2(status);

    if (isOxygenOnlyMode) {
      setSubmitting(true);
      try {
        await toggleOxygenSupplementation(patient.id, status === 'supplemental');
        if (useRTSASStore.getState().ui.modal.activeModal === 'avpu_assessment') {
          closeModal();
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Submit immediately if clinician explicitly chose an AVPU level in this modal
    if (pendingAvpu && avpuExplicitlyPicked) {
      await submitCombinedAssessment(pendingAvpu, status);
    }
  };

  const options: Array<{
    level: AVPULevel;
    title: string;
    desc: string;
    score: number;
    scoreBadgeColor: string;
    borderHoverColor: string;
    bgColor: string;
    icon: string;
  }> = [
    {
      level: 'A',
      title: 'Alert (รู้สึกตัวดี)',
      desc: 'ตื่นดี ลืมตาเอง สบตาและตอบสนองต่อสิ่งแวดล้อมได้เหมาะสม',
      score: 0,
      scoreBadgeColor: '#22c55e',
      borderHoverColor: '#16a34a',
      bgColor: 'rgba(34, 197, 94, 0.08)',
      icon: '👁️',
    },
    {
      level: 'V',
      title: 'Voice (ตอบสนองต่อเสียง)',
      desc: 'ลืมตาหรือขยับตอบสนองเมื่อได้ยินเสียงเรียกหรือสั่ง',
      score: 3,
      scoreBadgeColor: '#f59e0b',
      borderHoverColor: '#d97706',
      bgColor: 'rgba(245, 158, 11, 0.08)',
      icon: '🗣️',
    },
    {
      level: 'P',
      title: 'Pain (ตอบสนองต่อความเจ็บ)',
      desc: 'ไม่ตอบสนองต่อเสียง แต่ขยับหรือส่งเสียงเมื่อกระตุ้นด้วยความเจ็บปวด',
      score: 3,
      scoreBadgeColor: '#ea580c',
      borderHoverColor: '#c2410c',
      bgColor: 'rgba(234, 88, 12, 0.08)',
      icon: '⚡',
    },
    {
      level: 'U',
      title: 'Unresponsive (ไม่ตอบสนอง)',
      desc: 'หมดสติ ไม่มีการตอบสนองใดๆ ทั้งต่อเสียงและความเจ็บปวด',
      score: 3,
      scoreBadgeColor: '#dc2626',
      borderHoverColor: '#b91c1c',
      bgColor: 'rgba(220, 38, 38, 0.08)',
      icon: '⚠️',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) handleCancel();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: isOxygenOnlyMode ? 'rgba(14, 165, 233, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                border: isOxygenOnlyMode ? '1px solid rgba(14, 165, 233, 0.4)' : '1px solid rgba(249, 115, 22, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
              }}
            >
              {isOxygenOnlyMode ? '💨' : '🧠'}
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                {isOxygenOnlyMode
                  ? 'ระบุการได้รับออกซิเจนเสริม (NEWS 2012)'
                  : 'ประเมิน AVPU และออกซิเจนเสริม (O₂) ก่อนเข้าประเมิน'}
              </h2>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                ผู้ป่วย: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{patientName}</span>
                {gcs !== undefined && (
                  <span
                    style={{
                      marginLeft: '8px',
                      background: 'rgba(249, 115, 22, 0.25)',
                      color: '#fb923c',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    HOSxP GCS: {gcs}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleCancel}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Clinical Note / Notice */}
        <div
          style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '12px 24px',
            fontSize: '13px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>ℹ️</span>
          <span>
            {isOxygenOnlyMode
              ? baseVitalsScore === 3 || baseVitalsScore === 4
                ? `ผู้ป่วยมีคะแนนเบื้องต้น ${baseVitalsScore} คะแนน (ช่วง 3–4 คะแนน) โปรดระบุว่าได้รับออกซิเจนเสริมหรือไม่ก่อนสรุปผล`
                : `ผู้ป่วยมีคะแนนเบื้องต้น ${baseVitalsScore} คะแนน — โปรดระบุสถานะการได้รับออกซิเจนเสริม (O₂) เพื่อคำนวณ NEWS 2012 ให้ครบถ้วน`
              : pendingAvpu && selectedO2 === 'unassessed'
              ? avpuExplicitlyPicked
                ? `เลือก AVPU [${pendingAvpu}] แล้ว — กรุณาระบุการได้รับออกซิเจนเสริม (O₂) ด้านล่างเพื่อเข้าสู่หน้าประเมิน`
                : `GCS = ${gcs} (แนะนำ AVPU = ${pendingAvpu}) — กรุณาเลือกสถานะการได้รับออกซิเจนเสริม (O₂) แล้วกดยืนยันก่อนเข้าหน้าประเมิน`
              : pendingAvpu && selectedO2 !== 'unassessed'
              ? `เลือก AVPU [${pendingAvpu}] และ ${selectedO2 === 'supplemental' ? 'ใช้ออกซิเจนเสริม (+2)' : 'ไม่ใช้ออกซิเจนเสริม (0)'} พร้อมเข้าสู่หน้าประเมินแล้ว`
              : selectedO2 !== 'unassessed'
              ? 'เลือกสถานะ O₂ แล้ว — กรุณาเลือกระดับความรู้สึกตัว AVPU (A / V / P / U) เพื่อเข้าสู่หน้าประเมิน'
              : `ผู้ป่วยมี GCS ${gcs} (< 15) — กรุณาประเมินทั้ง AVPU และออกซิเจนเสริม (O₂) ให้ครบถ้วนก่อนเข้าหน้าประเมิน`}
          </span>
        </div>

        {isOxygenOnlyMode ? (
          /* Oxygen-Only Prompt Options (when GCS=15 and score is 3–4) */
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              disabled={submitting}
              onClick={() => handleSelectO2('room_air')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '14px',
                border: '2px solid #e2e8f0',
                background: 'rgba(34, 197, 94, 0.08)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#16a34a';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  🌿
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                    ไม่ได้รับออกซิเจนเสริม (Room Air)
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    หายใจด้วยอากาศปกติ ณ เวลาที่ประเมินสัญญาณชีพ (คะแนนรวม = {baseVitalsScore} คะแนน)
                  </div>
                </div>
              </div>
              <div
                style={{
                  background: '#22c55e',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  marginLeft: '12px',
                }}
              >
                +0 คะแนน
              </div>
            </button>

            <button
              disabled={submitting}
              onClick={() => handleSelectO2('supplemental')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: '14px',
                border: '2px solid #e2e8f0',
                background: 'rgba(14, 165, 233, 0.08)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0284c7';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  💨
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                    ได้รับออกซิเจนเสริม (Supplemental O₂)
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    ได้รับออกซิเจนเสริม ณ เวลาที่ประเมินสัญญาณชีพ (คะแนนรวม = {baseVitalsScore + 2} คะแนน)
                  </div>
                </div>
              </div>
              <div
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  marginLeft: '12px',
                }}
              >
                +2 คะแนน
              </div>
            </button>
          </div>
        ) : (
          /* AVPU Options List + Supplemental Oxygen Strip */
          <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Supplemental Oxygen Selector Strip inside AVPU Modal */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: pendingAvpu ? '#fff7ed' : '#f8fafc',
                border: pendingAvpu ? '2px solid #f97316' : '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: pendingAvpu ? '#c2410c' : '#475569',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>💨 การได้รับออกซิเจนเสริม ณ เวลาประเมินสัญญาณชีพ</span>
                {selectedO2 === 'unassessed' && (
                  <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>
                    {pendingAvpu ? '⚠️ กรุณาเลือกเพื่อสรุปผล' : 'ยังไม่ระบุ (เลือกพร้อมกันได้)'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSelectO2('room_air')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: selectedO2 === 'room_air' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    background: selectedO2 === 'room_air' ? '#dcfce7' : '#ffffff',
                    color: selectedO2 === 'room_air' ? '#15803d' : '#475569',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🌿 ไม่ได้รับออกซิเจนเสริม (0 คะแนน)
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSelectO2('supplemental')}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '10px',
                    border: selectedO2 === 'supplemental' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: selectedO2 === 'supplemental' ? '#e0f2fe' : '#ffffff',
                    color: selectedO2 === 'supplemental' ? '#0369a1' : '#475569',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  💨 ได้รับออกซิเจนเสริม (+2 คะแนน)
                </button>
              </div>
            </div>

            {options.map((opt) => {
              const isSelectedPending = pendingAvpu === opt.level;
              return (
                <button
                  key={opt.level}
                  disabled={submitting}
                  onClick={() => handleSelectAvpu(opt.level)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    border: isSelectedPending ? `2px solid ${opt.borderHoverColor}` : '2px solid #e2e8f0',
                    background: opt.bgColor,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = opt.borderHoverColor;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = isSelectedPending ? opt.borderHoverColor : '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      }}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>[{opt.level}] {opt.title}</span>
                        {gcs === 15 && opt.level === 'A' && (
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                          }}>
                            แนะนำ (GCS 15)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                        {opt.desc}
                      </div>
                    </div>
                  </div>

                  {/* Score Badge */}
                  <div
                    style={{
                      background: opt.scoreBadgeColor,
                      color: '#ffffff',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontWeight: 700,
                      fontSize: '13px',
                      whiteSpace: 'nowrap',
                      marginLeft: '12px',
                    }}
                  >
                    +{opt.score} คะแนน
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px 20px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#475569',
              fontWeight: 600,
              fontSize: '14px',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            ยกเลิก
          </button>
          {!isOxygenOnlyMode && (
            <button
              id="btn-confirm-avpu-o2"
              type="button"
              disabled={submitting || !pendingAvpu || selectedO2 === 'unassessed'}
              onClick={() => {
                if (pendingAvpu && selectedO2 !== 'unassessed') {
                  submitCombinedAssessment(pendingAvpu, selectedO2);
                }
              }}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                background:
                  pendingAvpu && selectedO2 !== 'unassessed'
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : '#e2e8f0',
                color: pendingAvpu && selectedO2 !== 'unassessed' ? '#ffffff' : '#94a3b8',
                fontWeight: 700,
                fontSize: '13px',
                cursor:
                  submitting || !pendingAvpu || selectedO2 === 'unassessed'
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow:
                  pendingAvpu && selectedO2 !== 'unassessed'
                    ? '0 4px 12px rgba(37, 99, 235, 0.25)'
                    : 'none',
              }}
            >
              {pendingAvpu && selectedO2 !== 'unassessed'
                ? `✅ ยืนยันผล AVPU (${pendingAvpu}) + O₂ — เข้าสู่หน้าประเมิน`
                : 'เลือก AVPU และ O₂ ให้ครบเพื่อเข้าประเมิน'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
