import { useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { VitalSigns, AVPULevel } from '../types';
import { showToast } from './Toast';
import { maskHN } from '../utils/hnMask';

function calcNEWSScore(rr: number, spo2: number, temp: number, sbp: number, hr: number, avpu: string) {
  let sc = 0;
  const bd: string[] = [];
  const rrP = rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3; sc += rrP; bd.push(`RR(${rrP})`);
  const spoP = spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0; sc += spoP; bd.push(`SpO₂(${spoP})`);
  const tmpP = temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2; sc += tmpP; bd.push(`Temp(${tmpP})`);
  const sbpP = sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3; sc += sbpP; bd.push(`SBP(${sbpP})`);
  const hrP = hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3; sc += hrP; bd.push(`HR(${hrP})`);
  const avpuP = avpu === 'A' ? 0 : 3; sc += avpuP; bd.push(`AVPU(${avpuP})`);
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
  const { ui, closeModal, completeAssessment, selectedPatient, assessmentSchedule } = useRTSASStore();

  const [rr, setRR] = useState('');
  const [spo2, setSpo2] = useState('');
  const [sbp, setSBP] = useState('');
  const [dbp, setDBP] = useState('');
  const [hr, setHR] = useState('');
  const [bt, setBT] = useState('');
  const [avpu, setAVPU] = useState('');

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
  const allFilled = !isNaN(rrN) && !isNaN(spo2N) && !isNaN(sbpN) && !isNaN(hrN) && !isNaN(btN) && avpu;
  const liveNews = allFilled ? calcNEWSScore(rrN, spo2N, btN, sbpN, hrN, avpu) : null;

  let riskLabel = 'กรอกข้อมูลเพื่อคำนวณ';
  let riskColor = '#94a3b8';
  let riskBg = 'rgba(148, 163, 184, .12)';
  if (liveNews) {
    if (liveNews.score >= 7) { riskLabel = '🔴 สูง — ต้องการการดูแลเร่งด่วน'; riskColor = '#ef4444'; riskBg = 'rgba(239, 68, 68, .12)'; }
    else if (liveNews.score >= 5) { riskLabel = '🟡 ปานกลาง — ติดตามใกล้ชิด'; riskColor = '#f97316'; riskBg = 'rgba(249, 115, 22, .12)'; }
    else if (liveNews.score >= 1) { riskLabel = '🟢 ต่ำ-ปานกลาง'; riskColor = '#22c55e'; riskBg = 'rgba(34, 197, 94, .12)'; }
    else { riskLabel = '🟢 ปกติ — NEWS = 0'; riskColor = '#22c55e'; riskBg = 'rgba(34, 197, 94, .12)'; }
  }

  const filledCount = [rr, spo2, sbp, hr, bt, avpu].filter(Boolean).length;

  const handleSave = () => {
    if (!allFilled) {
      showToast('กรุณากรอกข้อมูลสัญญาณชีพให้ครบถ้วน', 'error');
      return;
    }

    const vitals: VitalSigns = {
      respiratoryRate: rrN,
      spO2: spo2N,
      oxygenSupplementation: 'room_air',
      temperature: btN,
      systolicBP: sbpN,
      heartRate: hrN,
      avpu: avpu as AVPULevel,
    };

    completeAssessment(data.entryId, vitals, 'พย.สุกัญญา');
    showToast(`บันทึกการประเมินครั้งที่ ${data.sequence} สำเร็จ`, 'success');
    closeModal();

    // Reset fields
    setRR(''); setSpo2(''); setSBP(''); setDBP(''); setHR(''); setBT(''); setAVPU('');
  };

  const handleClose = () => {
    closeModal();
    setRR(''); setSpo2(''); setSBP(''); setDBP(''); setHR(''); setBT(''); setAVPU('');
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
            marginLeft: 'auto', fontSize: '10px', fontWeight: 600, color: '#2563eb',
            background: '#eff6ff', borderRadius: '6px', padding: '2px 8px',
          }}>
            {filledCount}/6 ช่อง
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

          {/* AVPU - full width */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ ...labelStyle, marginBottom: '5px' }}>
              🧠 ระดับความรู้สึกตัว (AVPU)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[
                { value: 'A', label: 'Alert', desc: 'รู้สึกตัวดี', color: '#22c55e' },
                { value: 'V', label: 'Voice', desc: 'ตอบสนองเสียง', color: '#f59e0b' },
                { value: 'P', label: 'Pain', desc: 'ตอบสนองปวด', color: '#f97316' },
                { value: 'U', label: 'Unresponsive', desc: 'ไม่ตอบสนอง', color: '#ef4444' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAVPU(opt.value)}
                  style={{
                    padding: '10px 6px', borderRadius: '12px', cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'center',
                    border: avpu === opt.value ? `2px solid ${opt.color}` : '1.5px solid #e2e8f0',
                    background: avpu === opt.value ? `${opt.color}10` : '#fff',
                    transition: 'all 0.2s',
                    boxShadow: avpu === opt.value ? `0 2px 8px ${opt.color}25` : 'none',
                  }}
                >
                  <div style={{
                    fontSize: '18px', fontWeight: 900, color: avpu === opt.value ? opt.color : '#475569',
                    lineHeight: 1,
                  }}>{opt.value}</div>
                  <div style={{
                    fontSize: '9px', fontWeight: 600,
                    color: avpu === opt.value ? opt.color : '#94a3b8',
                    marginTop: '3px',
                  }}>{opt.desc}</div>
                </button>
              ))}
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
            <button
              type="button"
              onClick={handleClose}
              style={{
                flex: 1, padding: '14px', borderRadius: '14px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                color: '#64748b', border: '1px solid #e2e8f0', background: '#f8fafc',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
