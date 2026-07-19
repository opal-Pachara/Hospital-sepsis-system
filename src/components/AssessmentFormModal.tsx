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
  const seqLabel = totalInPhase ? `${data?.sequence}/${totalInPhase} (${intervalLabel})` : `${data?.sequence} ${intervalLabel ? `(${intervalLabel})` : ''}`;

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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>

      <div className="bg-white rounded-3xl w-[520px] max-h-[95vh] overflow-y-auto animate-slideUp shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 flex items-start gap-4 border-b border-blue-100/50"
          style={{ background: '#f4f7fb' }}>
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-sm">
            📊
          </div>
          <div className="flex-1 mt-0.5">
            <div className="text-xl font-bold text-slate-800 tracking-tight">
              บันทึกสัญญาณชีพ — ครั้งที่ {seqLabel}
            </div>
            <div className="text-sm font-medium text-slate-500 mt-1">
              HN {maskHN(selectedPatient?.hn || 'N/A')} {currentEntry?.scheduledTime ? `· เวลาเป้าหมาย ${new Date(currentEntry.scheduledTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : ''}
            </div>
          </div>
          <button
            type="button"
            className="rounded-xl w-10 h-10 flex items-center justify-center cursor-pointer text-lg text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
            onClick={handleClose}
          >✕</button>
        </div>

        {/* Form body */}
        <div className="p-6 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-600">
                อัตราการหายใจ (RR) <span className="text-xs font-normal text-slate-400 ml-0.5">ครั้ง/นาที</span>
              </label>
              <input type="number" value={rr} onChange={(e) => setRR(e.target.value)}
                min="1" max="60" placeholder="--"
                className="py-2.5 px-3 rounded-xl text-base font-bold text-slate-800 tabular-nums w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-600">
                O₂ Saturation (SpO₂) <span className="text-xs font-normal text-slate-400 ml-0.5">%</span>
              </label>
              <input type="number" value={spo2} onChange={(e) => setSpo2(e.target.value)}
                min="50" max="100" placeholder="--"
                className="py-2.5 px-3 rounded-xl text-base font-bold text-slate-800 tabular-nums w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-600">
                BP Systolic (SBP) <span className="text-xs font-normal text-slate-400 ml-0.5">mmHg</span>
              </label>
              <input type="number" value={sbp} onChange={(e) => setSBP(e.target.value)}
                min="40" max="300" placeholder="--"
                className="py-2.5 px-3 rounded-xl text-base font-bold text-slate-800 tabular-nums w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-600">
                BP Diastolic (DBP) <span className="text-xs font-normal text-slate-400 ml-0.5">mmHg</span>
              </label>
              <input type="number" value={dbp} onChange={(e) => setDBP(e.target.value)}
                min="20" max="200" placeholder="--"
                className="py-2.5 px-3 rounded-xl text-base font-bold text-slate-800 tabular-nums w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-600">
                ชีพจร (P) <span className="text-xs font-normal text-slate-400 ml-0.5">ครั้ง/นาที</span>
              </label>
              <input type="number" value={hr} onChange={(e) => setHR(e.target.value)}
                min="20" max="250" placeholder="--"
                className="py-2.5 px-3 rounded-xl text-base font-bold text-slate-800 tabular-nums w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-600">
                อุณหภูมิ (BT) <span className="text-xs font-normal text-slate-400 ml-0.5">°C</span>
              </label>
              <input type="number" value={bt} onChange={(e) => setBT(e.target.value)}
                min="30" max="43" step="0.1" placeholder="--"
                className="py-2.5 px-3 rounded-xl text-base font-bold text-slate-800 tabular-nums w-full bg-white border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-sm font-bold text-slate-600">ระดับความรู้สึกตัว (AVPU)</label>
              <div className="relative">
                <select value={avpu} onChange={(e) => setAVPU(e.target.value)}
                  className="appearance-none py-2.5 px-4 rounded-xl text-base font-medium text-slate-800 bg-white w-full cursor-pointer border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none">
                  <option value="">-- เลือก --</option>
                  <option value="A">A — Alert (รู้สึกตัวดี)</option>
                  <option value="V">V — Voice (ตอบสนองต่อเสียง)</option>
                  <option value="P">P — Pain (ตอบสนองต่อความเจ็บปวด)</option>
                  <option value="U">U — Unresponsive (ไม่ตอบสนอง)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"></path></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Live NEWS Score */}
          <div className="rounded-[18px] px-6 py-5 flex items-center justify-between shadow-sm relative overflow-hidden"
            style={{ background: '#11294d' }}>
            <div className="relative z-10">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">NEWS Score (คำนวณอัตโนมัติ)</div>
              <div className="text-5xl font-extrabold text-white tabular-nums leading-none">
                {liveNews ? liveNews.score : '--'}
              </div>
            </div>
            <div className="text-right relative z-10 flex flex-col items-end">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">ระดับความเสี่ยง</div>
              <div className="text-sm font-bold" style={{ color: riskColor }}>
                {riskLabel}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSave}
              className="flex-[2] py-3.5 rounded-xl text-white text-base font-bold cursor-pointer transition-all bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
            >
              💾 บันทึกการประเมิน
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3.5 rounded-xl text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 text-base font-bold cursor-pointer transition-all active:scale-[0.98]"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
