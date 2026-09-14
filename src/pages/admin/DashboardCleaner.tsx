import { useState, useMemo } from 'react';
import { useRTSASStore, isHistoricalPatient } from '../../store/useRTSASStore';
import { maskHN } from '../../utils/hnMask';
import { showToast } from '../../components/common/Toast';

interface DashboardCleanerProps {
  onNavigateTreatedDashboard?: () => void;
}

export function DashboardCleaner({ onNavigateTreatedDashboard }: DashboardCleanerProps) {
  const { patients, patientData, clearInactivePatientsMemory, clearTreatedPatients } = useRTSASStore();
  const [isResettingDashboard, setIsResettingDashboard] = useState<boolean>(false);
  const [isClearingMemory, setIsClearingMemory] = useState<boolean>(false);
  const [showConfirmReset, setShowConfirmReset] = useState<boolean>(false);

  // Compute safety audit for patient memory
  const memoryAudit = useMemo(() => {
    let activeTreatedCount = 0;
    let inactiveCount = 0;
    const retainedPatients: Array<{ id: string; hn: string; reasons: string[] }> = [];

    patients.forEach((p) => {
      const pData = patientData[p.id];
      const isHistorical = isHistoricalPatient(p, patientData);
      const isTreating = pData?.countdownTimer?.isActive && !pData.treatmentCompleted && !pData.sepsisRuledOut;

      if (isTreating && !isHistorical) {
        activeTreatedCount++;
        retainedPatients.push({
          id: p.id,
          hn: p.hn,
          reasons: ['⏱️ กำลังเดินเวลานับถอยหลัง Sepsis Bundle'],
        });
      } else {
        inactiveCount++;
      }
    });

    return {
      totalPatients: patients.length,
      activeTreatedCount,
      inactiveCount,
      retainedPatients,
    };
  }, [patients, patientData]);

  // Handle Full Dashboard Reset
  const handleResetDashboard = async () => {
    setIsResettingDashboard(true);
    try {
      const res = await fetch('/api/admin/reset-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (clearTreatedPatients) {
        clearTreatedPatients(data.cleared_hns);
      }
      clearInactivePatientsMemory();
      setShowConfirmReset(false);
      showToast(`✨ ล้างข้อมูล Dashboard สำเร็จ (เคลียร์ ${data.cleared_count || 0} เคส)`, 'success', 5000);
    } catch (err: any) {
      console.error('Failed to reset dashboard:', err);
      showToast(`ไม่สามารถล้างข้อมูล Dashboard ได้: ${err.message || err}`, 'error');
    } finally {
      setIsResettingDashboard(false);
    }
  };

  // Handle Memory Cleanup
  const handleClearMemory = () => {
    setIsClearingMemory(true);
    try {
      const result = clearInactivePatientsMemory();
      showToast(`🧹 ล้างหน่วยความจำสำเร็จ: ล้าง ${result.clearedCount} ราย, คุ้มครอง ${result.retainedCount} ราย`, 'success', 4000);
    } catch (err: any) {
      showToast(`เกิดข้อผิดพลาด: ${err.message || err}`, 'error');
    } finally {
      setIsClearingMemory(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Overview Notice */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md shadow-blue-500/25">
            🧹
          </div>
          <div>
            <div className="text-base font-black text-slate-800">
              ศูนย์จัดการและล้างข้อมูลจำลอง (Dashboard & Data Cleaner)
            </div>
            <div className="text-xs text-slate-600 mt-1 leading-relaxed">
              เครื่องมือสำหรับล้างข้อมูลตัวอย่างที่ใช้ในการทดสอบ, เคลียร์เคสผู้ป่วยที่รักษาแล้วในตารางฐานข้อมูลกลาง และคืนพื้นที่หน่วยความจำ RAM เพื่อให้ระบบสะอาดพร้อมสำหรับการใช้งานจริง (Production Deployment)
            </div>
          </div>
        </div>
      </div>

      {/* Grid: 2 Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Dashboard Reset */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                📊 Treated Dashboard Reset
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                ล้างข้อมูลกลาง
              </span>
            </div>

            <div className="text-lg font-black text-slate-800 mt-2">
              ล้างสถิติและประวัติการรักษาทั้งหมด
            </div>

            <div className="text-xs text-slate-600 mt-2 leading-relaxed">
              คำสั่งนี้จะล้างสถานะ <strong>Treatment Completed</strong> และ <strong>Rule Out Sepsis</strong> ในตารางกลาง <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[11px]">patient_treatment_status</code> และล้าง Cache เพื่อให้หน้า Dashboard กลับเป็น 0 สะอาดหมดจด
            </div>

            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              ⚠️ <strong>ข้อควรระวัง:</strong> เหมาะสำหรับใช้หลังจบการทดสอบ เพื่อล้างข้อมูลตัวอย่างทั้งหมดทิ้งก่อนขึ้นระบบจริง
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowConfirmReset(true)}
              disabled={isResettingDashboard}
              className="w-full py-3 px-4 rounded-xl text-xs font-black text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 cursor-pointer transition-all shadow-md shadow-red-500/25 flex items-center justify-center gap-2"
            >
              <span>🗑️</span>
              <span>ยืนยันล้างข้อมูล Dashboard ให้เป็น 0</span>
            </button>

            {onNavigateTreatedDashboard && (
              <button
                type="button"
                onClick={onNavigateTreatedDashboard}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <span>📊</span>
                <span>เปิดดูผลลัพธ์ที่หน้า Treated Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Memory RAM Cleanup with Active Sepsis Guard */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                🛡️ Patient Memory Cleanup
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                Active Guard
              </span>
            </div>

            <div className="text-lg font-black text-slate-800 mt-2">
              ล้าง RAM ผู้ป่วยที่ไม่ได้รักษา
            </div>

            <div className="text-xs text-slate-600 mt-2 leading-relaxed">
              ล้างประวัติผู้ป่วยที่ไม่ได้รักษาออกจากหน่วยความจำ Client Store เพื่อคืนพื้นที่ RAM ป้องกัน Memory Leak โดย <strong>คุ้มครองผู้ป่วยที่กำลังเดินเวลานับถอยหลัง Sepsis Bundle ไว้ 100%</strong>
            </div>

            {/* Audit Status Box */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">ผู้ป่วยทั้งหมดในหน่วยความจำ:</span>
                <span className="font-mono font-bold text-slate-800">{memoryAudit.totalPatients} ราย</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span>🛡️</span> คุ้มครองผู้ป่วยที่กำลังรักษา:
                </span>
                <span className="font-mono font-bold text-emerald-700">{memoryAudit.activeTreatedCount} ราย</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-700 font-bold flex items-center gap-1">
                  <span>🗑️</span> รายการที่จะถูกล้าง:
                </span>
                <span className="font-mono font-bold text-orange-700">{memoryAudit.inactiveCount} ราย</span>
              </div>

              {memoryAudit.retainedPatients.length > 0 && (
                <div className="mt-1 pt-2 border-t border-slate-200 text-[11px] text-emerald-800">
                  รายชื่อที่ได้รับการปกป้อง: {memoryAudit.retainedPatients.map((p) => `HN ${maskHN(p.hn)}`).join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleClearMemory}
              disabled={isClearingMemory || memoryAudit.inactiveCount === 0}
              className={`w-full py-3 px-4 rounded-xl text-xs font-black text-white cursor-pointer transition-all shadow-md flex items-center justify-center gap-2 ${
                memoryAudit.inactiveCount === 0
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-orange-500/25'
              }`}
            >
              {isClearingMemory ? (
                <>
                  <span className="animate-spin">🔄</span>
                  <span>กำลังล้างหน่วยความจำ...</span>
                </>
              ) : (
                <>
                  <span>🧹</span>
                  <span>ล้าง RAM ผู้ป่วยที่ไม่ได้รักษา ({memoryAudit.inactiveCount} ราย)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Confirm Modal for Dashboard Reset ─── */}
      {showConfirmReset && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(10, 10, 20, 0.65)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmReset(false);
          }}
        >
          <div className="bg-white rounded-2xl w-[440px] max-w-[90vw] overflow-hidden shadow-2xl border border-red-200 animate-slideUp">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-orange-500" />
            <div className="p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
                ⚠️
              </div>
              <div className="text-base font-black text-slate-800 text-center">
                ยืนยันการล้างข้อมูล Dashboard ทั้งหมด?
              </div>
              <div className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
                การดำเนินการนี้จะล้างประวัติการรักษาที่เสร็จสิ้นทั้งหมดในระบบ ทำให้สถิติของวันต่าง ๆ ในหน้า Treated Dashboard กลับไปเป็น 0 ทั้งหมดเพื่อเตรียมพร้อมสำหรับขึ้นระบบจริง
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  disabled={isResettingDashboard}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleResetDashboard}
                  disabled={isResettingDashboard}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-red-500/25"
                >
                  {isResettingDashboard ? '⏳ กำลังล้าง...' : '🗑️ ยืนยัน ล้างทันที'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
