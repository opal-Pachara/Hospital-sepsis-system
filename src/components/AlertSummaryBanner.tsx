import { useRTSASStore } from '../store/useRTSASStore';

export default function AlertSummaryBanner() {
  const { pendingAlerts, openModal } = useRTSASStore();

  if (pendingAlerts.length === 0) return null;

  return (
    <div
      onClick={() => openModal('multi_alert')}
      className="fixed top-0 left-0 right-0 z-[200] cursor-pointer animate-slideDown flex items-center justify-center"
      style={{
        background: '#dc2626',
        color: '#fff',
        padding: '12px 24px',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
        fontWeight: 600,
        fontSize: '14px',
      }}
    >
      <div className="animate-pulse" style={{ fontSize: '18px' }}>🚨</div>
      <span>พบผู้ป่วยเสี่ยง Sepsis ระดับสูง จำนวน {pendingAlerts.length} ราย</span>
      <span style={{ 
        background: 'rgba(255,255,255,0.2)', 
        padding: '4px 12px', 
        borderRadius: '16px', 
        fontSize: '12px' 
      }}>
        คลิกเพื่อดูและรับทราบ
      </span>
    </div>
  );
}
