import { useRTSASStore } from '../store/useRTSASStore';
import { maskHN } from '../utils/hnMask';

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

  // Build breakdown rows from patient's NEWS result
  const breakdownItems = patient?.latestNewsResult?.breakdown
    .filter((p) => p.parameter !== 'oxygenSupplementation') || [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.7)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '520px',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(220, 38, 38, .35), 0 0 0 1px rgba(220, 38, 38, .15)',
        }}
      >
        {/* ─── Red Top Accent Bar ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #dc2626, #f97316, #dc2626)' }} />

        {/* ─── Header ─── */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 50%, #fef2f2 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(252, 165, 165, .5)',
        }}>
          {/* Pulsing alarm icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', flexShrink: 0,
            boxShadow: '0 6px 20px rgba(220, 38, 38, .4)',
          }} className="animate-shake">
            🚨
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#dc2626', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              🔴 แจ้งเตือน — เสี่ยงติดเชื้อในกระแสเลือด
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>
              ระบบตรวจพบคะแนน NEWS เกินเกณฑ์ — ต้องประเมินทันที
            </div>
          </div>
          <button
            onClick={closeModal}
            style={{
              width: '36px', height: '36px', borderRadius: '10px',
              border: '1px solid #fca5a5', background: '#fff',
              color: '#dc2626', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#dc2626'; }}
          >✕</button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '20px 24px 24px' }}>

          {/* Patient Info Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '14px 16px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #fef2f2, #fff5f5)',
            border: '1px solid #fecaca', marginBottom: '16px',
          }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: '#fef2f2', border: '2px solid #fca5a5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0,
            }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.2px' }}>
                {maskHN(patient?.hn || 'N/A')}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                {genderLabel} · อายุ {patient?.age || '—'} ปี · เวลาคัดกรอง {arrivalTimeStr}
              </div>
            </div>
            <div style={{
              fontSize: '10px', fontWeight: 700, color: '#dc2626',
              background: '#fff', border: '1.5px solid #fca5a5', borderRadius: '8px',
              padding: '6px 10px', textAlign: 'center', lineHeight: 1.5,
              flexShrink: 0,
            }}>
              🔴 เสี่ยง<br />ติดเชื้อในกระแสเลือด
            </div>
          </div>

          {/* NEWS Score Card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '18px',
            padding: '16px 18px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #fef2f2, #fff1f2)',
            border: '1px solid #fecaca', marginBottom: '16px',
          }}>
            {/* Big score */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '18px',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(220, 38, 38, .3)',
            }}>
              <span style={{ fontSize: '34px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{data.newsScore}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                NEWS Score
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', marginTop: '3px' }}>
                ⚠ HIGH RISK — เสี่ยงติดเชื้อในกระแสเลือด
              </div>
              {/* Parameter breakdown chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                {breakdownItems.map((p) => (
                  <span key={p.parameter} style={{
                    fontSize: '9px', fontWeight: 600, color: '#dc2626',
                    background: '#fff', border: '1px solid #fecaca', borderRadius: '6px',
                    padding: '2px 6px', whiteSpace: 'nowrap',
                  }}>
                    {p.displayValue} <span style={{ opacity: 0.7 }}>+{p.score}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Alert message */}
          <div style={{
            padding: '12px 14px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
            border: '1px solid #fed7aa', marginBottom: '18px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
              background: 'linear-gradient(to bottom, #f97316, #ea580c)',
              borderRadius: '12px 0 0 12px',
            }} />
            <div style={{ paddingLeft: '10px', fontSize: '12px', color: '#475569', lineHeight: 1.8 }}>
              <strong style={{ color: '#ea580c' }}>เกณฑ์:</strong> NEWS ≥ 5 → เสี่ยงติดเชื้อในกระแสเลือด<br />
              <strong style={{ color: '#ea580c' }}>ขั้นตอนต่อไป:</strong> ประเมินซ้ำที่จุดคัดแยก → นำเข้าห้อง ER → รายงานแพทย์เวรทันที
            </div>
          </div>

          {/* Acknowledge Button */}
          <button
            id="alert-acknowledge-btn"
            onClick={handleAcknowledge}
            style={{
              width: '100%', padding: '14px', border: 'none', borderRadius: '14px',
              fontSize: '14px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              color: '#fff',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              boxShadow: '0 6px 20px -4px rgba(220, 38, 38, .4)',
              transition: 'all 0.25s ease',
              letterSpacing: '-0.2px',
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(220, 38, 38, .5)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(220, 38, 38, .4)'; }}
          >
            ✅ รับทราบ — เริ่มกระบวนการดูแลภาวะติดเชื้อในกระแสเลือด
          </button>
        </div>
      </div>
    </div>
  );
}
