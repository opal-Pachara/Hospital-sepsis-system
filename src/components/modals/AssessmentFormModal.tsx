import { useState } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import type { VitalSigns, TimelineEvent } from '../../types';
import { gcsToAVPU } from '../../types';
import { showToast } from '../common/Toast';
import { maskHN } from '../../utils/hnMask';
import { calculateNEWS } from '../../utils/newsCalculator';

function calcNEWSScore(rr: number, spo2: number, temp: number, sbp: number, hr: number, gcs: number) {
  let sc = 0;
  const bd: string[] = [];
  const rrP = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3; sc += rrP; bd.push(`RR(${rrP})`);
  const spoP = spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0; sc += spoP; bd.push(`SpO₂(${spoP})`);
  const tmpP = temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2; sc += tmpP; bd.push(`Temp(${tmpP})`);
  const sbpP = sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3; sc += sbpP; bd.push(`SBP(${sbpP})`);
  const hrP = hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3; sc += hrP; bd.push(`HR(${hrP})`);
  const avpu = gcsToAVPU(gcs);
  const avpuP = avpu === 'A' ? 0 : 3; sc += avpuP; bd.push(`GCS${gcs}→${avpu}(${avpuP})`);
  return { score: sc, breakdown: bd.join(' + ') + ' = ' + sc };
}

/* ── Shared input style constant ── */
const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '12px',
  fontSize: '15px', fontWeight: 700, color: '#1e293b',
  fontVariantNumeric: 'tabular-nums', width: '100%',
  border: '1.5px solid #e2e8f0', background: '#fff',
  fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

/* ── Shared label style ── */
const labelStyle: React.CSSProperties = {
  fontSize: '12px', fontWeight: 700, color: '#475569',
  display: 'flex', alignItems: 'baseline', gap: '4px',
};

const unitStyle: React.CSSProperties = {
  fontSize: '10px', fontWeight: 400, color: '#94a3b8',
};

export default function AssessmentFormModal() {
  const {
    ui,
    closeModal,
    completeAssessment,
    selectedPatient,
    assessmentSchedule,
    currentUser,
    patientData,
    countdownTimer,
    timeline,
    patients,
    checklist,
  } = useRTSASStore();

  const [rr, setRR] = useState('');
  const [spo2, setSpo2] = useState('');
  const [sbp, setSBP] = useState('');
  const [dbp, setDBP] = useState('');
  const [hr, setHR] = useState('');
  const [bt, setBT] = useState('');
  const [gcsInput, setGCSInput] = useState('');
  const [isConfirmingComplete, setIsConfirmingComplete] = useState(false);

  if (ui.modal.activeModal !== 'assessment_form') return null;

  const data = ui.modal.modalData as {
    entryId: string;
    sequence: number;
  } | null;

  const currentEntry = data ? assessmentSchedule?.entries.find((e) => e.id === data.entryId) : null;
  const intervalLabel = currentEntry?.intervalType === 'Q15' ? 'ทุก 15 นาที' : currentEntry?.intervalType === 'Q30' ? 'ทุก 30 นาที' : '';
  const totalInPhase = currentEntry?.intervalType === 'Q15' ? 4 : '';
  const seqLabel = totalInPhase ? `${data?.sequence}/${totalInPhase}` : `${data?.sequence}`;
  const timeLabel = currentEntry?.scheduledTime
    ? new Date(currentEntry.scheduledTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : null;

  if (!data) return null;

  // Live NEWS calculation
  const rrN = parseFloat(rr), spo2N = parseFloat(spo2), sbpN = parseFloat(sbp),
    hrN = parseFloat(hr), btN = parseFloat(bt);
  const gcsN = parseInt(gcsInput);
  const allFilled = !isNaN(rrN) && !isNaN(spo2N) && !isNaN(sbpN) && !isNaN(hrN) && !isNaN(btN) && !isNaN(gcsN) && gcsN >= 3 && gcsN <= 15;
  const liveNews = allFilled ? calcNEWSScore(rrN, spo2N, btN, sbpN, hrN, gcsN) : null;

  let riskLabel = 'กรอกข้อมูลเพื่อคำนวณ';
  let riskColor = '#94a3b8';
  let riskBg = 'rgba(148, 163, 184, .12)';
  if (liveNews) {
    if (liveNews.score >= 7) { riskLabel = '🔴 สูง — ต้องการการดูแลเร่งด่วน'; riskColor = '#ef4444'; riskBg = 'rgba(239, 68, 68, .12)'; }
    else if (liveNews.score >= 5) { riskLabel = '🟡 ปานกลาง — ติดตามใกล้ชิด'; riskColor = '#f97316'; riskBg = 'rgba(249, 115, 22, .12)'; }
    else if (liveNews.score >= 1) { riskLabel = '🟢 ต่ำ-ปานกลาง'; riskColor = '#22c55e'; riskBg = 'rgba(34, 197, 94, .12)'; }
    else { riskLabel = '🟢 ปกติ — NEWS = 0'; riskColor = '#22c55e'; riskBg = 'rgba(34, 197, 94, .12)'; }
  }

  const filledCount = [rr, spo2, sbp, hr, bt, gcsInput].filter(Boolean).length;

  const handleSave = () => {
    if (!allFilled) {
      showToast('กรุณากรอกข้อมูลสัญญาณชีพให้ครบถ้วน', 'error');
      return;
    }

    const derivedAVPU = gcsToAVPU(gcsN);
    const vitals: VitalSigns = {
      respiratoryRate: rrN,
      spO2: spo2N,
      oxygenSupplementation: 'room_air',
      temperature: btN,
      systolicBP: sbpN,
      diastolicBP: !isNaN(parseFloat(dbp)) ? parseFloat(dbp) : null,
      heartRate: hrN,
      gcs: gcsN,
      avpu: derivedAVPU,
    };

    const actor = currentUser?.name || 'พยาบาลห้องฉุกเฉิน';
    completeAssessment(data.entryId, vitals, actor);
    showToast(`บันทึกการประเมินครั้งที่ ${data.sequence} สำเร็จ`, 'success');
    closeModal();

    // Reset fields
    setRR(''); setSpo2(''); setSBP(''); setDBP(''); setHR(''); setBT(''); setGCSInput('');
  };

  const handleCompleteTreatment = () => {
    if (!allFilled) {
      showToast('กรุณากรอกข้อมูลสัญญาณชีพให้ครบถ้วนก่อนสิ้นสุดการรักษา', 'error');
      return;
    }

    if (!isConfirmingComplete) {
      setIsConfirmingComplete(true);
      return;
    }

    if (!selectedPatient) return;
    const actor = currentUser?.name || 'พยาบาลห้องฉุกเฉิน';
    const now = new Date().toISOString();
    const derivedAVPU = gcsToAVPU(gcsN);
    const vitals: VitalSigns = {
      respiratoryRate: rrN,
      spO2: spo2N,
      oxygenSupplementation: 'room_air',
      temperature: btN,
      systolicBP: sbpN,
      diastolicBP: !isNaN(parseFloat(dbp)) ? parseFloat(dbp) : null,
      heartRate: hrN,
      gcs: gcsN,
      avpu: derivedAVPU,
    };
    const fullNews = calculateNEWS(vitals);

    // 1. Update assessmentSchedule: mark current sequence completed, cancel subsequent
    const currentSchedule = patientData[selectedPatient.id]?.assessmentSchedule || assessmentSchedule;
    let updatedSchedule = currentSchedule;

    if (currentSchedule && currentSchedule.entries.length > 0) {
      const targetSeq = data.sequence;
      updatedSchedule = {
        ...currentSchedule,
        entries: currentSchedule.entries.map((entry) => {
          if (entry.sequence === targetSeq || entry.id === data.entryId) {
            return {
              ...entry,
              isCompleted: true,
              completedAt: now,
              completedBy: actor,
              vitalSigns: vitals,
              newsResult: fullNews,
              isCanceled: true,
              canceledReason: 'สิ้นสุดการรักษา',
            };
          } else if (entry.sequence > targetSeq) {
            return {
              ...entry,
              isCanceled: true,
              canceledReason: 'สิ้นสุดการรักษา',
            };
          }
          return entry;
        }),
      };
    }

    // 2. Timeline events
    const timelineEventVitals: TimelineEvent = {
      id: `tl_vitals_${Date.now()}`,
      timestamp: now,
      actionText: `🩺 บันทึกสัญญาณชีพสิ้นสุดการรักษา (ครั้งที่ ${data.sequence}) — BP ${sbpN}/${!isNaN(parseFloat(dbp)) ? dbp : '—'} mmHg, HR ${hrN} bpm, RR ${rrN}/min, SpO2 ${spo2N}%, Temp ${btN}°C (NEWS: ${fullNews.totalScore} คะแนน - ${riskLabel})`,
      color: fullNews.totalScore >= 5 ? 'orange' : 'blue',
      actor,
    };

    const timelineEventComplete: TimelineEvent = {
      id: `tl_comp_${Date.now() + 1}`,
      timestamp: now,
      actionText: `✅ สิ้นสุดการรักษา — ผู้ป่วยได้รับการรักษาครบถ้วนแล้ว`,
      color: 'green',
      actor,
    };

    const existingTimeline = timeline || patientData[selectedPatient.id]?.timeline || [];
    const updatedTimeline = [...existingTimeline, timelineEventVitals, timelineEventComplete];

    // 3. Stop countdown timer and update patient
    const patientId = selectedPatient.id;
    const currentTimer = patientData[patientId]?.countdownTimer || countdownTimer;
    const updatedTimer = {
      ...currentTimer,
      isActive: false,
    };

    const updatedPatient = {
      ...selectedPatient,
      latestVitals: vitals,
      newsScore: fullNews.totalScore,
      treatmentStatus: {
        ...(selectedPatient.treatmentStatus || {}),
        treatment_completed: true,
        treatment_completed_at: now,
        treatment_completed_by: actor,
      },
    };

    const updatedPatients = (patients || []).map((p) =>
      p.id === selectedPatient.id || p.hn === selectedPatient.hn ? updatedPatient : p
    );

    const updatedPatientData = {
      ...patientData,
      [patientId]: {
        ...(patientData[patientId] || {}),
        treatmentCompleted: true,
        treatmentCompletedAt: now,
        treatmentCompletedBy: actor,
        latestVitals: vitals,
        newsScore: fullNews.totalScore,
        countdownTimer: updatedTimer,
        assessmentSchedule: updatedSchedule,
        timeline: updatedTimeline,
      },
      ...(selectedPatient.hn && selectedPatient.hn !== patientId ? {
        [selectedPatient.hn]: {
          ...(patientData[selectedPatient.hn] || {}),
          treatmentCompleted: true,
          treatmentCompletedAt: now,
          treatmentCompletedBy: actor,
          latestVitals: vitals,
          newsScore: fullNews.totalScore,
          countdownTimer: updatedTimer,
          assessmentSchedule: updatedSchedule,
          timeline: updatedTimeline,
        }
      } : {})
    };

    useRTSASStore.setState({
      selectedPatient: updatedPatient,
      patients: updatedPatients,
      patientData: updatedPatientData,
      treatmentCompleted: true,
      treatmentCompletedAt: now,
      countdownTimer: updatedTimer,
      assessmentSchedule: updatedSchedule,
      timeline: updatedTimeline,
    });

    // 4. Backend sync
    const hn = selectedPatient.hn;
    fetch('/api/treatment-status/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hn,
        completed_by: actor,
        timeline_json: JSON.stringify(updatedTimeline),
      }),
    }).catch((err) => console.warn('Failed to sync complete to backend:', err));

    fetch('/api/treatment-status/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hn,
        checklist_json: JSON.stringify(checklist),
      }),
    }).catch((err) => console.warn('Failed to sync checklist to backend:', err));

    showToast('✅ สิ้นสุดการรักษาและบันทึกข้อมูลไปยัง Dashboard สำเร็จ', 'success');
    closeModal();
    setIsConfirmingComplete(false);
    setRR(''); setSpo2(''); setSBP(''); setDBP(''); setHR(''); setBT(''); setGCSInput('');
  };

  const handleClose = () => {
    closeModal();
    setIsConfirmingComplete(false);
    setRR(''); setSpo2(''); setSBP(''); setDBP(''); setHR(''); setBT(''); setGCSInput('');
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#3b82f6';
    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, .1)';
  };
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#e2e8f0';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '520px', maxHeight: '95vh',
          background: '#fff', borderRadius: '20px',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px -12px rgba(37, 99, 235, .25), 0 0 0 1px rgba(37, 99, 235, .1)',
        }}
      >
        {/* ─── Blue Top Accent Bar ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563eb, #06b6d4, #2563eb)', flexShrink: 0 }} />

        {/* ─── Header ─── */}
        <div style={{
          padding: '18px 24px 14px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(191, 219, 254, .6)',
          flexShrink: 0,
        }}>
          {/* Icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', flexShrink: 0,
            boxShadow: '0 6px 20px rgba(37, 99, 235, .35)',
          }}>
            📊
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e40af', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              บันทึกสัญญาณชีพ
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#2563eb',
                background: '#fff', border: '1.5px solid #93c5fd', borderRadius: '8px',
                padding: '2px 8px',
              }}>
                ครั้งที่ {seqLabel}
              </span>
              {intervalLabel && (
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: '#64748b',
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                  padding: '2px 8px',
                }}>
                  {intervalLabel}
                </span>
              )}
              {timeLabel && (
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  เป้าหมาย {timeLabel} น.
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid #93c5fd', background: '#fff',
              color: '#2563eb', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#2563eb'; }}
          >✕</button>
        </div>

        {/* ─── Patient Info Bar ─── */}
        <div style={{
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '10px',
          background: '#f8fafc', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}>
          <div style={{ fontSize: '16px' }}>👤</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
            {maskHN(selectedPatient?.hn || 'N/A')}
          </div>
          <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {selectedPatient?.gender === 'male' ? 'ชาย' : selectedPatient?.gender === 'female' ? 'หญิง' : '—'} · อายุ {selectedPatient?.age || '—'} ปี
          </div>
          <div style={{
            marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
            color: allFilled ? '#16a34a' : '#2563eb',
            background: allFilled ? '#dcfce7' : '#eff6ff',
            borderRadius: '6px', padding: '2px 8px',
          }}>
            {allFilled ? '✓ ครบ 6 ช่อง' : `${filledCount}/6 ช่อง`}
          </div>
        </div>

        {/* ─── Scrollable Form Body ─── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 24px' }}>

          {/* Input Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>

            {/* RR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>
                🫁 อัตราการหายใจ (RR) <span style={unitStyle}>ครั้ง/นาที</span>
              </label>
              <input type="number" value={rr} onChange={(e) => setRR(e.target.value)}
                min="1" max="60" placeholder="--"
                style={inputStyle}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
            </div>

            {/* SpO2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>
                ✓ SpO₂ <span style={unitStyle}>%</span>
              </label>
              <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)}
                min="50" max="100" placeholder="--"
                style={inputStyle}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
            </div>

            {/* SBP */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>
                ❤ BP Systolic (SBP) <span style={unitStyle}>mmHg</span>
              </label>
              <input type="number" value={sbp} onChange={(e) => setSBP(e.target.value)}
                min="40" max="300" placeholder="--"
                style={inputStyle}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
            </div>

            {/* DBP */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>
                💜 BP Diastolic (DBP) <span style={unitStyle}>mmHg</span>
              </label>
              <input type="number" value={dbp} onChange={(e) => setDBP(e.target.value)}
                min="20" max="200" placeholder="--"
                style={inputStyle}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
            </div>

            {/* HR */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>
                💓 ชีพจร (HR) <span style={unitStyle}>ครั้ง/นาที</span>
              </label>
              <input type="number" value={hr} onChange={(e) => setHR(e.target.value)}
                min="20" max="250" placeholder="--"
                style={inputStyle}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
            </div>

            {/* BT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={labelStyle}>
                🌡 อุณหภูมิ (BT) <span style={unitStyle}>°C</span>
              </label>
              <input type="number" value={bt} onChange={(e) => setBT(e.target.value)}
                min="30" max="43" step="0.1" placeholder="--"
                style={inputStyle}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
            </div>
          </div>

          {/* GCS / AVPU - full width */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ ...labelStyle, marginBottom: '5px' }}>
              🧠 GCS Score <span style={unitStyle}>(3-15) → แปลง AVPU อัตโนมัติ</span>
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                min={3}
                max={15}
                value={gcsInput}
                onChange={(e) => setGCSInput(e.target.value)}
                placeholder="เช่น 15"
                style={{ ...inputStyle, flex: 1 }}
                onFocus={handleInputFocus} onBlur={handleInputBlur}
              />
              {/* Auto-derived AVPU badge */}
              {!isNaN(gcsN) && gcsN >= 3 && gcsN <= 15 && (() => {
                const derivedAVPU = gcsToAVPU(gcsN);
                const avpuConfig: Record<string, { label: string; desc: string; color: string; score: number }> = {
                  A: { label: 'A', desc: 'Alert', color: '#22c55e', score: 0 },
                  V: { label: 'V', desc: 'Voice', color: '#f59e0b', score: 3 },
                  P: { label: 'P', desc: 'Pain', color: '#f97316', score: 3 },
                  U: { label: 'U', desc: 'Unresponsive', color: '#ef4444', score: 3 },
                };
                const cfg = avpuConfig[derivedAVPU];
                return (
                  <div style={{
                    padding: '8px 14px', borderRadius: '12px',
                    border: `2px solid ${cfg.color}`,
                    background: `${cfg.color}10`,
                    textAlign: 'center', minWidth: '90px',
                    flexShrink: 0,
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 900, color: cfg.color, lineHeight: 1 }}>
                      {cfg.label}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 600, color: cfg.color, marginTop: '3px' }}>
                      {cfg.desc} (+{cfg.score})
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>
              GCS 15 = A (0 คะแนน) | GCS 9-14 = V (+3) | GCS 4-8 = P (+3) | GCS 3 = U (+3)
            </div>
          </div>

          {/* ─── Live NEWS Score Card ─── */}
          <div style={{
            borderRadius: '16px', padding: '18px 20px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e3a5f 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '18px', position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative glow */}
            <div style={{
              position: 'absolute', right: '-20px', top: '-20px',
              width: '100px', height: '100px', borderRadius: '50%',
              background: riskColor, opacity: 0.08, filter: 'blur(30px)',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,.45)',
                textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px',
              }}>NEWS Score</div>
              <div style={{
                fontSize: '44px', fontWeight: 900, color: '#fff',
                fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              }}>
                {liveNews ? liveNews.score : '--'}
              </div>
              {!liveNews && (
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.35)', marginTop: '4px' }}>
                  คำนวณอัตโนมัติ
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
              <div style={{
                fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,.45)',
                textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px',
              }}>ระดับความเสี่ยง</div>
              <div style={{
                fontSize: '12px', fontWeight: 800, color: riskColor,
                padding: '4px 10px', borderRadius: '8px', background: riskBg,
                display: 'inline-block',
              }}>
                {riskLabel}
              </div>
              {liveNews && (
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.35)', marginTop: '6px', lineHeight: 1.5 }}>
                  {liveNews.breakdown}
                </div>
              )}
            </div>
          </div>

          {/* ─── Incomplete Fields Alert Banner ─── */}
          {!allFilled && (
            <div
              id="alert-incomplete-vitals"
              style={{
                marginBottom: '14px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(245, 158, 11, 0.08)',
              }}
            >
              <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#b45309' }}>
                  ยังกรอกข้อมูลไม่ครบถ้วน ({filledCount}/6 ช่อง)
                </div>
                <div style={{ fontSize: '9.5px', color: '#d97706', marginTop: '1px' }}>
                  กรุณากรอกสัญญาณชีพให้ครบทุกช่องเพื่อคำนวณคะแนน NEWS และบันทึกข้อมูล
                </div>
              </div>
            </div>
          )}

          {/* ─── Action Buttons ─── */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSave}
              style={{
                flex: 2, padding: '14px', borderRadius: '14px',
                fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                color: '#fff', border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: '0 6px 20px -4px rgba(37, 99, 235, .4)',
                transition: 'all 0.25s ease',
                letterSpacing: '-0.2px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(37, 99, 235, .5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(37, 99, 235, .4)'; }}
            >
              💾 บันทึกการประเมิน
            </button>
            {isConfirmingComplete ? (
              <div style={{ display: 'flex', gap: '6px', flex: 2 }}>
                <button
                  type="button"
                  id="btn-confirm-complete-treatment"
                  onClick={handleCompleteTreatment}
                  style={{
                    flex: 1, padding: '14px 6px', borderRadius: '14px',
                    fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    color: '#fff', border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 4px 14px rgba(220, 38, 38, .4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  ⚠️ ยืนยันเสร็จสิ้น
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingComplete(false)}
                  style={{
                    padding: '14px 8px', borderRadius: '14px',
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    color: '#64748b', border: '1px solid #cbd5e1', background: '#f8fafc',
                  }}
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-trigger-complete-treatment"
                onClick={handleCompleteTreatment}
                style={{
                  flex: 2, padding: '14px', borderRadius: '14px',
                  fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  color: '#fff', border: 'none',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 6px 20px -4px rgba(16, 185, 129, .4)',
                  transition: 'all 0.25s ease',
                  letterSpacing: '-0.2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(16, 185, 129, .5)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(16, 185, 129, .4)'; }}
              >
                ✅ รักษาเสร็จแล้ว
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

