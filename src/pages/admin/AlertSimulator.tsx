import { useState } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import { showToast } from '../../components/common/Toast';

export function AlertSimulator() {
  const { queueAlert, startCountdown, resetCountdown, selectedPatient } = useRTSASStore();
  const [testHn, setTestHn] = useState<string>('HN100194');
  const [testScore, setTestScore] = useState<number>(16);

  // Trigger Sepsis Emergency Alert Modal
  const handleTriggerAlert = () => {
    queueAlert(testHn, testScore);
    showToast(`🚨 จำลองส่งการแจ้งเตือน Sepsis Alert สำหรับ ${testHn} (NEWS ${testScore})`, 'warning', 4000);
  };

  // Trigger Multiple Alert Queue
  const handleTriggerMultiAlert = () => {
    queueAlert('HN100191', 16);
    queueAlert('HN100187', 14);
    queueAlert('HN100194', 16);
    showToast('🚨🚨 จำลองส่งการแจ้งเตือนฉุกเฉินพร้อมกัน 3 เคส (Multi-Alert Queue)', 'warning', 5000);
  };

  // Test 60-min countdown timer
  const handleStartTimer = () => {
    if (!selectedPatient) {
      showToast('กรุณาเลือกผู้ป่วยในระบบก่อนเริ่มจับเวลา', 'info');
      return;
    }
    startCountdown(60);
    showToast(`⏱️ เริ่มนับถอยหลัง 60 นาที (1-Hour Sepsis Bundle) สำหรับ ${selectedPatient.hn}`, 'info', 4000);
  };

  const handleResetTimer = () => {
    resetCountdown();
    showToast('⏹ รีเซ็ตตัวนับเวลาถอยหลังเรียบร้อย', 'info');
  };

  // Test Audio buzzer
  const handleTestAudio = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
      showToast('🔊 ทดสอบเล่นเสียงสัญญาณเตือนภัยฉุกเฉิน (Audio Test OK)', 'success');
    } catch (e: any) {
      showToast(`ไม่สามารถเล่นเสียงได้: ${e.message}`, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md shadow-red-500/25">
            🚨
          </div>
          <div>
            <div className="text-base font-black text-slate-800">
              เครื่องมือจำลองการแจ้งเตือนวิกฤต (Sepsis Alert & Timer Simulator)
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              ทดสอบระบบ Modal แจ้งเตือนฉุกเฉิน, ระบบเสียงเตือนภัย (Alarm), คิวแจ้งเตือนหลายเคส และระบบจับเวลา 60 นาที
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Alert Popups */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              🔔 Emergency Modals
            </span>
            <div className="text-base font-black text-slate-800">
              ทดสอบหน้าต่างแจ้งเตือน Sepsis ฉุกเฉิน
            </div>
            <div className="text-xs text-slate-600 mt-2 leading-relaxed">
              จำลองส่งสัญญาณเตือนภัยเข้าสู่หน้าจอ เพื่อทดสอบว่าหน้าต่างแจ้งเตือน (Modal) เด้งขึ้นมาและมีปุ่มยืนยันรับทราบสำหรับทีมแพทย์/พยาบาลหรือไม่
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">รหัสผู้ป่วย (HN)</label>
                <input
                  type="text"
                  value={testHn}
                  onChange={(e) => setTestHn(e.target.value)}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">คะแนน NEWS</label>
                <input
                  type="number"
                  min="5"
                  max="20"
                  value={testScore}
                  onChange={(e) => setTestScore(Number(e.target.value))}
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleTriggerAlert}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-all shadow-md shadow-red-500/25 flex items-center justify-center gap-2"
            >
              <span>🚨</span>
              <span>ยิง Alert ฉุกเฉินเคสเดี่ยว (Single Alert)</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerMultiAlert}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <span>🚨🚨</span>
              <span>ยิง Alert พร้อมกันหลายเคส (Multi-Alert Queue)</span>
            </button>
            <button
              type="button"
              onClick={handleTestAudio}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <span>🔊</span>
              <span>ทดสอบเสียงสัญญาณเตือน (Audio Buzzer)</span>
            </button>
          </div>
        </div>

        {/* Card 2: 60-Minute Bundle Timer */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              ⏱️ Bundle Countdown Timer
            </span>
            <div className="text-base font-black text-slate-800">
              ทดสอบระบบจับเวลานับถอยหลัง 60 นาที
            </div>
            <div className="text-xs text-slate-600 mt-2 leading-relaxed">
              ทดสอบการเริ่มต้นและการนับเวลาถอยหลังของกระบวนการ 1-Hour Sepsis Bundle ตามมาตรฐานสากล
            </div>

            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">ผู้ป่วยที่ถูกเลือกในระบบ:</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedPatient ? `HN ${selectedPatient.hn}` : 'ยังไม่ได้เลือก'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleStartTimer}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              <span>▶️</span>
              <span>เริ่มนับถอยหลัง 60 นาที (Start Countdown)</span>
            </button>
            <button
              type="button"
              onClick={handleResetTimer}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors flex items-center justify-center gap-2"
            >
              <span>⏹</span>
              <span>รีเซ็ตตัวนับเวลา (Reset Timer)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
