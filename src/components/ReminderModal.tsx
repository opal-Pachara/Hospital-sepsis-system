import { useRTSASStore } from '../store/useRTSASStore';
import { maskHN } from '../utils/hnMask';

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
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '420px',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(234, 88, 12, .3), 0 0 0 1px rgba(234, 88, 12, .12)',
        }}
      >
        {/* ─── Orange Top Accent Bar ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #ea580c, #f59e0b, #ea580c)' }} />

        {/* ─── Header ─── */}
        <div style={{
          padding: '18px 22px 14px',
          background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 50%, #fed7aa 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(253, 186, 116, .5)',
        }}>
          {/* Bell icon */}
          <div
            className="animate-shake"
            style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #ea580c, #c2410c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
              boxShadow: '0 6px 18px rgba(234, 88, 12, .35)',
            }}
          >
            🔔
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#ea580c', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              ถึงเวลาประเมินสัญญาณชีพ
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#ea580c',
                background: '#fff', border: '1.5px solid #fdba74', borderRadius: '8px',
                padding: '2px 8px',
              }}>
                รอบที่ {data.sequence}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                เป้าหมาย {timeStr} น.
              </span>
            </div>
          </div>
          <button
            onClick={closeModal}
            style={{
              width: '34px', height: '34px', borderRadius: '10px',
              border: '1px solid #fdba74', background: '#fff',
              color: '#ea580c', fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#ea580c'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#ea580c'; }}
          >✕</button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '18px 22px 22px' }}>

          {/* Info message */}
          <div style={{
            padding: '14px 16px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
            border: '1px solid #fed7aa', marginBottom: '16px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
              background: 'linear-gradient(to bottom, #f97316, #ea580c)',
              borderRadius: '14px 0 0 14px',
            }} />
            <div style={{ paddingLeft: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                {maskHN(selectedPatient?.hn || 'N/A')}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>
                ถึงเวลาประเมินสัญญาณชีพซ้ำ<br />
                กรุณากรอกข้อมูลสัญญาณชีพเพื่อคำนวณ NEWS score อัตโนมัติ
              </div>
            </div>
          </div>

          {/* Progress indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px',
            padding: '8px 12px', borderRadius: '10px',
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '14px' }}>⏱</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
              กำหนดเวลาเป้าหมาย: <strong style={{ color: '#ea580c' }}>{timeStr} น.</strong>
            </div>
            <div style={{
              marginLeft: 'auto', fontSize: '9px', fontWeight: 700, color: '#ea580c',
              background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '6px',
              padding: '2px 6px',
            }}>
              ⚡ รอดำเนินการ
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleRecord}
              style={{
                flex: 2, padding: '13px', borderRadius: '14px',
                fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                color: '#fff', border: 'none',
                background: 'linear-gradient(135deg, #ea580c, #c2410c)',
                boxShadow: '0 6px 20px -4px rgba(234, 88, 12, .35)',
                transition: 'all 0.25s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(234, 88, 12, .45)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(234, 88, 12, .35)'; }}
            >
              📝 บันทึกสัญญาณชีพ
            </button>
            <button
              onClick={closeModal}
              style={{
                flex: 1, padding: '13px', borderRadius: '14px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                color: '#64748b', border: '1px solid #e2e8f0', background: '#f8fafc',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              เลื่อนออกไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
