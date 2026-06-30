import { useRTSASStore } from '../store/useRTSASStore';

export default function StatusBar() {
  const { openModal, resetChecklist, clearTimeline, ui, setConnectionStatus } = useRTSASStore();
  
  return (
    <div className="bg-surface-elevated border-t border-border-default px-4 py-2 flex items-center justify-between text-[11px] flex-shrink-0 z-10">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-secondary">System Status:</span>
          <span className={`flex items-center gap-1.5 ${ui.connectionStatus === 'connected' ? 'text-status-success' : 'text-status-error'}`}>
            <span className={`w-2 h-2 rounded-full ${ui.connectionStatus === 'connected' ? 'bg-status-success animate-pulse-green' : 'bg-status-error animate-pulse-red'}`} />
            {ui.connectionStatus === 'connected' ? 'Connected to HIS' : 'Disconnected'}
          </span>
        </div>
        <span className="text-border-default">|</span>
        <span className="text-text-muted">v1.2.0 (Build 8a9b2c)</span>
        <span className="text-border-default">|</span>
        <span className="text-text-muted">Last sync: {new Date(ui.currentTime).toLocaleTimeString('th-TH')}</span>
      </div>
      
      <div className="flex items-center gap-2">
        <span className="font-semibold text-text-secondary mr-2">Demo Tools:</span>
        <button 
          onClick={() => openModal('alert', { newsScore: 9, riskLevel: 'High', patientName: 'Demo Patient' })}
          className="px-2 py-1 bg-status-error/10 text-status-error hover:bg-status-error/20 rounded border border-status-error/20 transition-colors focus:outline-none"
        >
          Trigger Alert
        </button>
        <button 
          onClick={() => {
            resetChecklist();
            clearTimeline();
          }}
          className="px-2 py-1 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 rounded border border-brand-primary/20 transition-colors focus:outline-none"
        >
          Reset State
        </button>
        <button 
          onClick={() => setConnectionStatus(ui.connectionStatus === 'connected' ? 'disconnected' : 'connected')}
          className="px-2 py-1 bg-surface-base text-text-secondary hover:text-text-primary rounded border border-border-default transition-colors focus:outline-none"
        >
          Toggle Connection
        </button>
      </div>
    </div>
  );
}
