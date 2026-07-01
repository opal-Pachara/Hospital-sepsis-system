import { useEffect, useRef } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';

export default function Header() {
  const { ui, updateCurrentTime } = useRTSASStore();
  const intervalRef = useRef<number | null>(null);

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

  return (
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

      {/* Right — Status & Clock */}
      <div className="flex items-center gap-3.5">
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
  );
}
