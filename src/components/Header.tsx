import { useEffect, useRef, useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import AuthModal from './AuthModal';

export default function Header() {
  const { ui, updateCurrentTime, isAuthenticated, currentUser, logoutUser } = useRTSASStore();
  const intervalRef = useRef<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  const roleLabel = currentUser?.role === 'doctor' ? 'แพทย์' : currentUser?.role === 'nurse' ? 'พยาบาล' : currentUser?.role === 'researcher' ? 'ผู้วิจัย' : 'IT';

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between flex-shrink-0 relative overflow-hidden z-20" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #2563eb, #0891b2, #2563eb)' }} />

        {/* Left — Hospital Logo & Name */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)', boxShadow: '0 4px 14px rgba(37,99,235,.3)' }}>
            🏥
          </div>
          <div>
            <div className="text-xl font-black text-slate-800 tracking-tight">โรงพยาบาลบางคล้า</div>
            <div className="text-sm font-semibold text-slate-500 mt-0.5">ห้องอุบัติเหตุและฉุกเฉิน · จังหวัดฉะเชิงเทรา</div>
          </div>
        </div>

        {/* Center — System Title */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <div className="text-2xl font-black text-blue-700 tracking-tight">ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (RTSAS)</div>
          <div className="text-sm font-medium text-slate-400 mt-1 uppercase tracking-widest">Real-Time Sepsis Alert System</div>
        </div>

        {/* Right — Auth Status + Status & Clock */}
        <div className="flex items-center gap-3.5">
          {/* Auth indicator */}
          {isAuthenticated && currentUser ? (
            <div className="flex items-center gap-2">
              <div style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '10px',
                background: '#dcfce7', border: '1px solid #bbf7d0', color: '#16a34a',
                fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <span style={{ fontSize: '12px' }}>🔐</span>
                {currentUser.name} ({roleLabel})
              </div>
              <button
                type="button"
                onClick={logoutUser}
                style={{
                  padding: '4px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626',
                }}
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <span style={{ fontSize: '12px' }}>🔓</span>
              เข้าสู่ระบบ
            </button>
          )}

          <div className="flex items-center gap-1.5 text-sm text-status-success">
            <div className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse-green" style={{ boxShadow: '0 0 6px rgba(22,163,74,.5)' }} />
            <span>ออนไลน์</span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-primary tabular-nums">{timeStr}</div>
            <div className="text-xs text-text-secondary">{dateStr}</div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
}
