import { useState, useCallback } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { VitalSigns, AVPULevel } from '../types';
import { showToast } from './Toast';

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

export default function AssessmentFormModal() {
  const { ui, closeModal, completeAssessment, selectedPatient } = useRTSASStore();

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

  if (!data) return null;

  // Live NEWS calculation
  const rrN = parseFloat(rr), spo2N = parseFloat(spo2), sbpN = parseFloat(sbp),
    hrN = parseFloat(hr), btN = parseFloat(bt);
  const allFilled = !isNaN(rrN) && !isNaN(spo2N) && !isNaN(sbpN) && !isNaN(hrN) && !isNaN(btN) && avpu;
  const liveNews = allFilled ? calcNEWSScore(rrN, spo2N, btN, sbpN, hrN, avpu) : null;

  let riskLabel = 'กรอกข้อมูลเพื่อคำนวณ';
  let riskColor = '#94a3b8';
  if (liveNews) {
    if (liveNews.score >= 7) { riskLabel = '🔴 สูง — ต้องการการดูแลเร่งด่วน'; riskColor = '#ef4444'; }
    else if (liveNews.score >= 5) { riskLabel = '🟡 ปานกลาง — ติดตามใกล้ชิด'; riskColor = '#f97316'; }
    else if (liveNews.score >= 1) { riskLabel = '🟢 ต่ำ-ปานกลาง'; riskColor = '#22c55e'; }
    else { riskLabel = '🟢 ปกติ — NEWS = 0'; riskColor = '#22c55e'; }
  }

  const handleSave = useCallback(() => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFilled, rrN, spo2N, btN, sbpN, hrN, avpu, data?.entryId, data?.sequence]);

  const handleClose = () => {
    closeModal();
    setRR(''); setSpo2(''); setSBP(''); setDBP(''); setHR(''); setBT(''); setAVPU('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>

      <div className="bg-white rounded-[14px] w-[460px] max-h-[92vh] overflow-y-auto animate-slideUp"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,.15)', border: '1px solid #e2e8f0' }}>

        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 border-b"
          style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderColor: '#bfdbfe' }}>
          <div className="w-[38px] h-[38px] bg-brand-primary rounded-[10px] flex items-center justify-center text-[18px] flex-shrink-0">
            📊
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-text-primary">
              บันทึกสัญญาณชีพ — ครั้งที่ {data.sequence}
            </div>
            <div className="text-[10px] text-text-secondary mt-0.5">{selectedPatient?.hn || 'N/A'}</div>
          </div>
          <button
            className="rounded-lg px-2.5 py-1.5 cursor-pointer text-[14px]"
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569' }}
            onClick={handleClose}
          >✕</button>
        </div>

        {/* Form body */}
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-secondary">
                อัตราการหายใจ (RR) <span className="text-[9px] text-text-muted font-normal">ครั้ง/นาที</span>
              </label>
              <input type="number" value={rr} onChange={(e) => setRR(e.target.value)}
                min="1" max="60" placeholder="--"
                className="py-1.5 px-2.5 rounded-lg text-[15px] font-bold text-text-primary tabular-nums w-full"
                style={{ border: '1.5px solid #e2e8f0' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-secondary">
                O₂ Saturation (SpO₂) <span className="text-[9px] text-text-muted font-normal">%</span>
              </label>
              <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)}
                min="50" max="100" placeholder="--"
                className="py-1.5 px-2.5 rounded-lg text-[15px] font-bold text-text-primary tabular-nums w-full"
                style={{ border: '1.5px solid #e2e8f0' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-secondary">
                BP Systolic (SBP) <span className="text-[9px] text-text-muted font-normal">mmHg</span>
              </label>
              <input type="number" value={sbp} onChange={(e) => setSBP(e.target.value)}
                min="40" max="300" placeholder="--"
                className="py-1.5 px-2.5 rounded-lg text-[15px] font-bold text-text-primary tabular-nums w-full"
                style={{ border: '1.5px solid #e2e8f0' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-secondary">
                BP Diastolic (DBP) <span className="text-[9px] text-text-muted font-normal">mmHg</span>
              </label>
              <input type="number" value={dbp} onChange={(e) => setDBP(e.target.value)}
                min="20" max="200" placeholder="--"
                className="py-1.5 px-2.5 rounded-lg text-[15px] font-bold text-text-primary tabular-nums w-full"
                style={{ border: '1.5px solid #e2e8f0' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-secondary">
                ชีพจร (P) <span className="text-[9px] text-text-muted font-normal">ครั้ง/นาที</span>
              </label>
              <input type="number" value={hr} onChange={(e) => setHR(e.target.value)}
                min="20" max="250" placeholder="--"
                className="py-1.5 px-2.5 rounded-lg text-[15px] font-bold text-text-primary tabular-nums w-full"
                style={{ border: '1.5px solid #e2e8f0' }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-text-secondary">
                อุณหภูมิ (BT) <span className="text-[9px] text-text-muted font-normal">°C</span>
              </label>
              <input type="number" value={bt} onChange={(e) => setBT(e.target.value)}
                min="30" max="43" step="0.1" placeholder="--"
                className="py-1.5 px-2.5 rounded-lg text-[15px] font-bold text-text-primary tabular-nums w-full"
                style={{ border: '1.5px solid #e2e8f0' }} />
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[11px] font-semibold text-text-secondary">ระดับความรู้สึกตัว (AVPU)</label>
              <select value={avpu} onChange={(e) => setAVPU(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg text-[13px] text-text-primary bg-white w-full cursor-pointer"
                style={{ border: '1.5px solid #e2e8f0' }}>
                <option value="">-- เลือก --</option>
                <option value="A">A — Alert (รู้สึกตัวดี)</option>
                <option value="V">V — Voice (ตอบสนองต่อเสียง)</option>
                <option value="P">P — Pain (ตอบสนองต่อความเจ็บปวด)</option>
                <option value="U">U — Unresponsive (ไม่ตอบสนอง)</option>
              </select>
            </div>
          </div>

          {/* Live NEWS Score */}
          <div className="rounded-[10px] px-4 py-3 flex items-center justify-between mb-3.5"
            style={{ background: 'linear-gradient(135deg, #1e293b, #0f3460)' }}>
            <div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.5)' }}>NEWS Score (คำนวณอัตโนมัติ)</div>
              <div className="text-[40px] font-black text-white tabular-nums leading-none">
                {liveNews ? liveNews.score : '--'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.5)' }}>ระดับความเสี่ยง</div>
              <div className="text-xs font-extrabold mt-0.5" style={{ color: riskColor }}>{riskLabel}</div>
              {liveNews && (
                <div className="text-[9px] mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,.45)' }}>
                  {liveNews.breakdown}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-[2] py-2.5 bg-brand-primary hover:bg-brand-secondary text-white text-[13px] font-bold rounded-lg cursor-pointer transition-colors"
            >
              💾 บันทึกการประเมิน
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-lg text-text-secondary text-xs font-semibold cursor-pointer transition-colors"
              style={{ border: '1px solid #cbd5e1' }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
