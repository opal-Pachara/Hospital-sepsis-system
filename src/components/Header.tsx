import { useEffect, useRef, useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import AuthModal from './AuthModal';
import ExportReportModal from './ExportReportModal';

export default function Header({ onNavigateAdmin }: { onNavigateAdmin?: () => void }) {
  const { ui, updateCurrentTime, isAuthenticated, currentUser, logoutUser } = useRTSASStore();
  const intervalRef = useRef<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [showExportModal, setShowExportModal] = useState(false);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      updateCurrentTime();
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateCurrentTime]);

  const now = new Date(ui.currentTime);
  const timeStr = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const dateStr = now.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const roleLabel = currentUser?.role === 'doctor' ? 'แพทย์' : currentUser?.role === 'nurse' ? 'พยาบาล' : 'เจ้าหน้าที่ IT';
  const roleIcon = currentUser?.role === 'doctor' ? '🩺' : currentUser?.role === 'nurse' ? '💉' : '💻';

  const isConnected = ui.connectionStatus === 'connected';

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0 relative overflow-hidden z-20" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #2563eb, #0891b2, #2563eb)' }} />

        {/* Left — Hospital Logo & Name */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)', boxShadow: '0 4px 14px rgba(37,99,235,.3)' }}>
            🏥
          </div>
          <div>
            <div className="text-lg font-black text-slate-800 tracking-tight">โรงพยาบาลบางคล้า</div>
            <div className="text-xs font-semibold text-slate-500">ห้องอุบัติเหตุและฉุกเฉิน · จังหวัดฉะเชิงเทรา</div>
          </div>
        </div>

        {/* Center — System Title */}
        <div className="hidden md:block text-center">
          <div className="text-xl font-black text-blue-700 tracking-tight">ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (RTSAS)</div>
          <div className="text-xs font-medium text-slate-400 mt-0.5 uppercase tracking-wider">Real-Time Sepsis Alert System</div>
        </div>

        {/* Right — Auth Status + Connection Status & Clock */}
        <div className="flex items-center gap-3">
          {/* Auth indicator or Top-Right Login/Register buttons */}
          {isAuthenticated && currentUser ? (
            <div className="flex items-center gap-2">
              {/* IT Admin Panel button — only for it_admin */}
              {currentUser.role === 'it_admin' && onNavigateAdmin && (
                <button
                  type="button"
                  id="btn-admin-panel"
                  onClick={onNavigateAdmin}
                  title="IT Admin Panel"
                  style={{
                    padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid #c4b5fd', background: '#f5f3ff', color: '#6d28d9',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    boxShadow: '0 1px 3px rgba(109,40,217,0.08)', transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#6d28d9'; e.currentTarget.style.color = '#fff'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.color = '#6d28d9'; }}
                >
                  <span>💻</span>
                  <span>Admin Panel</span>
                </button>
              )}

              {/* Export Report button — for authenticated users */}
              <button
                type="button"
                id="btn-export-report"
                onClick={() => setShowExportModal(true)}
                title="ออกรายงาน Shift"
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: '0 1px 3px rgba(22,163,74,0.08)', transition: 'all 0.15s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#16a34a'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#15803d'; }}
              >
                <span>📊</span>
                <span>รายงาน Shift</span>
              </button>

              <div style={{
                padding: '5px 12px', borderRadius: '10px', fontSize: '11px',
                background: '#ecfeff', border: '1px solid #a5f3fc', color: '#0891b2',
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <span style={{ fontSize: '13px' }}>{roleIcon}</span>
                <span>{currentUser.name}</span>
                <span style={{
                  fontSize: '9px', background: '#0891b2', color: '#fff',
                  padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase',
                }}>
                  {roleLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={logoutUser}
                title="ออกจากระบบ"
                style={{
                  padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-header-login"
                onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: '0 1px 3px rgba(37,99,235,0.08)',
                }}
              >
                <span>🔐</span>
                <span>เข้าสู่ระบบ</span>
              </button>
              <button
                type="button"
                id="btn-header-register"
                onClick={() => { setAuthModalMode('register'); setShowAuthModal(true); }}
                style={{
                  padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a',
                  display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: '0 1px 3px rgba(22,163,74,0.08)',
                }}
              >
                <span>📝</span>
                <span>สมัครสมาชิก</span>
              </button>
            </div>
          )}

          {/* Connection Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
            style={{
              background: isConnected ? '#f0fdf4' : '#fffbeb',
              border: isConnected ? '1px solid #bbf7d0' : '1px solid #fed7aa',
              color: isConnected ? '#16a34a' : '#d97706',
            }}>
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-status-success animate-pulse-green' : 'bg-amber-500'}`}
              style={{ boxShadow: isConnected ? '0 0 6px rgba(22,163,74,.5)' : 'none' }}
            />
            <span>{isConnected ? 'เชื่อมต่อ HIS' : 'ไม่ได้เชื่อมต่อ HIS'}</span>
          </div>

          {/* Time & Date */}
          <div className="text-right pl-1">
            <div className="text-xl font-bold text-brand-primary tabular-nums leading-tight">{timeStr}</div>
            <div className="text-[10px] text-text-secondary leading-tight">{dateStr}</div>
          </div>
        </div>
      </header>

      {/* Auth Modal (Login / Register popup) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authModalMode}
      />

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </>
  );
}
