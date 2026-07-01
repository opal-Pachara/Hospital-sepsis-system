import { useRTSASStore } from '../store/useRTSASStore';

export default function AlertModal() {
  const { ui, closeModal, addTimelineEvent, selectedPatient } = useRTSASStore();

  if (ui.modal.activeModal !== 'alert') return null;

  const data = ui.modal.modalData as {
    newsScore: number;
    riskLevel: string;
    patientName: string;
  } | null;

  if (!data) return null;

  const patient = selectedPatient;
  const genderLabel = patient?.gender === 'male' ? 'เพศชาย' : patient?.gender === 'female' ? 'เพศหญิง' : 'ไม่ระบุ';
  const arrivalTimeStr = patient
    ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  const handleAcknowledge = () => {
    addTimelineEvent(
      `รับทราบการแจ้งเตือน — พยาบาลเริ่มกระบวนการดูแลภาวะติดเชื้อในกระแสเลือด`,
      'orange',
      'Nurse'
    );
    closeModal();
  };

  // Build breakdown string from patient's NEWS result
  const breakdownStr = patient?.latestNewsResult?.breakdown
    .filter((p) => p.parameter !== 'oxygenSupplementation')
    .map((p) => `${p.displayValue} (+${p.score})`)
    .join(' · ') || '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white border-2 border-status-error rounded-2xl w-[480px] overflow-hidden animate-slideUp"
        style={{ boxShadow: '0 8px 32px rgba(220,38,38,.15)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-4 border-b"
          style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', borderColor: '#fca5a5' }}>
          <div className="w-12 h-12 bg-status-error rounded-xl flex items-center justify-center text-3xl animate-shake"
            style={{ boxShadow: '0 4px 12px rgba(220,38,38,.4)' }}>
            🚨
          </div>
          <div className="flex-1">
            <div className="text-xl font-black text-status-error">🔴 แจ้งเตือน — เสี่ยงติดเชื้อในกระแสเลือด</div>
            <div className="text-sm text-text-secondary mt-1">ระบบตรวจพบคะแนน NEWS เกินเกณฑ์ — ต้องประเมินทันที</div>
          </div>
          <button
            className="rounded-lg px-3 py-2 cursor-pointer text-lg"
            style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}
            onClick={closeModal}
          >✕</button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Patient info */}
          <div className="rounded-[10px] px-4 py-3 flex items-center gap-4 mb-4"
            style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
            <div className="text-4xl">👤</div>
            <div className="flex-1">
              <div className="text-lg font-extrabold">{patient?.hn || 'N/A'}</div>
              <div className="text-sm text-text-secondary mt-1">
                {genderLabel} · อายุ {patient?.age || '—'} ปี · เวลาคัดกรอง {arrivalTimeStr}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-status-error py-1.5 px-2.5 rounded-md leading-snug"
                style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                🔴 เสี่ยง<br />ติดเชื้อในกระแสเลือด
              </div>
            </div>
          </div>

          {/* Score block */}
          <div className="rounded-[10px] px-4 py-3 flex items-center gap-5 mb-4"
            style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
            <div className="text-5xl font-black text-status-error leading-none">{data.newsScore}</div>
            <div>
              <div className="text-xs text-text-muted">NEWS Score</div>
              <div className="text-sm font-bold text-status-error mt-0.5">⚠ HIGH RISK — เสี่ยงติดเชื้อในกระแสเลือด</div>
              <div className="text-xs text-text-secondary mt-1 leading-relaxed">{breakdownStr}</div>
            </div>
          </div>

          {/* Alert message */}
          <div className="rounded-r-lg p-3 mb-4 text-sm text-text-secondary leading-relaxed"
            style={{ background: '#fff7ed', borderLeft: '4px solid #ea580c' }}>
            <strong>เกณฑ์:</strong> NEWS ≥ 5 → เสี่ยงติดเชื้อในกระแสเลือด<br />
            <strong>ขั้นตอนต่อไป:</strong> ประเมินซ้ำที่จุดคัดแยก → นำเข้าห้อง ER → รายงานแพทย์เวรทันที
          </div>

          <button
            id="alert-acknowledge-btn"
            onClick={handleAcknowledge}
            className="w-full py-3 bg-status-error hover:bg-red-700 text-white font-bold rounded-lg transition-colors text-base cursor-pointer"
          >
            ✅ รับทราบ — เริ่มกระบวนการดูแลภาวะติดเชื้อในกระแสเลือด
          </button>
        </div>
      </div>
    </div>
  );
}
