import { useRTSASStore } from '../store/useRTSASStore';

export default function StatusBar() {
  const { openModal, resetChecklist, clearTimeline, resetCountdown, ui, setConnectionStatus } = useRTSASStore();

  const handleTriggerAlert = () => {
    const patient = useRTSASStore.getState().selectedPatient;
    openModal('alert', {
      newsScore: patient?.latestNewsScore ?? 12,
      riskLevel: 'high',
      patientName: patient?.fullName ?? 'Demo',
    });
  };

  const handleTriggerReminder = () => {
    openModal('reminder', {
      entryId: 'demo',
      sequence: 1,
      scheduledTime: new Date().toISOString(),
    });
  };

  const handleReset = () => {
    resetChecklist();
    clearTimeline();
    resetCountdown();
  };

  return (
    <>
      {/* Demo Bar */}
      <div className="bg-white border-t border-border-default flex items-center gap-2.5 flex-shrink-0"
        style={{ padding: '5px 14px' }}>
        <span className="text-[10px] text-text-muted flex items-center gap-1">🧪 ทดสอบ:</span>
        <button
          onClick={handleTriggerAlert}
          className="text-[11px] font-semibold cursor-pointer transition-all"
          style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #dc2626', color: '#dc2626', background: '#fef2f2', fontFamily: 'inherit' }}
        >
          🚨 Alert Pop-up
        </button>
        <button
          onClick={handleTriggerReminder}
          className="text-[11px] font-semibold cursor-pointer transition-all"
          style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #ea580c', color: '#ea580c', background: '#fff7ed', fontFamily: 'inherit' }}
        >
          🔔 จำลองแจ้งเตือนประเมิน
        </button>
        <button
          onClick={handleReset}
          className="text-[11px] font-semibold cursor-pointer transition-all"
          style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #2563eb', color: '#2563eb', background: '#eff6ff', fontFamily: 'inherit' }}
        >
          🔄 รีเซ็ต
        </button>
        <button
          onClick={() => setConnectionStatus(ui.connectionStatus === 'connected' ? 'disconnected' : 'connected')}
          className="text-[11px] font-semibold cursor-pointer transition-all"
          style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#475569', background: '#f8fafc', fontFamily: 'inherit' }}
        >
          {ui.connectionStatus === 'connected' ? '🔌 ตัดการเชื่อมต่อ' : '🔗 เชื่อมต่อ'}
        </button>
      </div>

      {/* Status Bar */}
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
    </>
  );
}
