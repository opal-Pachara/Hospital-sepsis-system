import { useRTSASStore } from '../../store/useRTSASStore';

export default function StatusBar() {
  const { ui } = useRTSASStore();

  return (
    <div className="flex items-center gap-5 flex-shrink-0"
      style={{ background: '#f1f5f9', borderTop: '1px solid #dde3ed', padding: '4px 16px', fontSize: '10px', color: '#94a3b8' }}>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse-green inline-block" />
        ระบบออนไลน์
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${ui.connectionStatus === 'connected' ? 'bg-status-success' : 'bg-status-error'}`} />
        {ui.connectionStatus === 'connected' ? 'เชื่อมต่อ HIS: ✓' : 'HIS: ✕ ไม่เชื่อมต่อ'}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-status-success inline-block" />
        Rule Engine: Active
      </div>
      <span>NEWS (RCP 2017)</span>
      <span className="ml-auto">v2.0 · โรงพยาบาลบางคล้า 2569</span>
    </div>
  );
}
