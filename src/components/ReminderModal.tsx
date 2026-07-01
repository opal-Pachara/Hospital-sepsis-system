import { useRTSASStore } from '../store/useRTSASStore';

export default function ReminderModal() {
  const { ui, closeModal, openModal, selectedPatient } = useRTSASStore();

  if (ui.modal.activeModal !== 'reminder') return null;

  const data = ui.modal.modalData as {
    entryId: string;
    sequence: number;
    scheduledTime: string;
  } | null;

  if (!data) return null;

  const timeStr = data.scheduledTime
    ? new Date(data.scheduledTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const handleRecord = () => {
    closeModal();
    openModal('assessment_form', {
      entryId: data.entryId,
      sequence: data.sequence,
    });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-white border-2 rounded-[14px] w-[360px] overflow-hidden animate-slideUp"
        style={{ borderColor: '#ea580c', boxShadow: '0 8px 24px rgba(234,88,12,.2)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-4 border-b"
          style={{ background: 'linear-gradient(135deg, #fff7ed, #fed7aa)', borderColor: '#fdba74' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl animate-shake"
            style={{ background: '#ea580c' }}>
            🔔
          </div>
          <div className="flex-1">
            <div className="text-lg font-black" style={{ color: '#ea580c' }}>
              ถึงเวลาประเมินสัญญาณชีพ — รอบที่ {data.sequence}
            </div>
            <div className="text-sm text-text-secondary mt-1">
              เวลาเป้าหมาย {timeStr} น.
            </div>
          </div>
          <button
            className="rounded-lg px-3 py-2 cursor-pointer text-base"
            style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#ea580c' }}
            onClick={closeModal}
          >✕</button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="rounded-lg p-3 mb-4 text-sm text-text-secondary leading-relaxed"
            style={{ background: '#fff7ed', border: '1px solid #fdba74' }}>
            <strong>{selectedPatient?.hn || 'N/A'}</strong> — ถึงเวลาประเมินสัญญาณชีพซ้ำ<br />
            กรุณากรอกข้อมูลสัญญาณชีพเพื่อคำนวณ NEWS score อัตโนมัติ
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleRecord}
              className="flex-[2] py-3 rounded-lg text-white text-base font-bold cursor-pointer"
              style={{ background: '#ea580c' }}
            >
              📝 บันทึกสัญญาณชีพ
            </button>
            <button
              onClick={closeModal}
              className="flex-1 py-3 rounded-lg text-text-secondary text-sm font-semibold cursor-pointer"
              style={{ background: 'transparent', border: '1px solid #cbd5e1' }}
            >
              เลื่อนออกไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
