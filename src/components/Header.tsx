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
    <header className="bg-white border-b-2 border-border-default px-5 py-2 flex items-center justify-between flex-shrink-0 relative overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      {/* Top gradient bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #2563eb, #0891b2, #2563eb)' }} />

      {/* Left — Hospital Logo & Name */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[22px] font-black text-white" style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)', boxShadow: '0 2px 8px rgba(37,99,235,.3)' }}>
          🏥
        </div>
        <div>
          <div className="text-[15px] font-bold text-text-primary">โรงพยาบาลบางคล้า</div>
          <div className="text-[11px] text-text-secondary">ห้องอุบัติเหตุและฉุกเฉิน · จังหวัดฉะเชิงเทรา</div>
        </div>
      </div>

      {/* Center — System Title */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center">
        <div className="text-[16px] font-bold text-brand-primary tracking-wide">ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (RTSAS)</div>
        <div className="text-[10px] text-text-muted">Real-Time Sepsis Alert System · Rule-Based · Transparent · Auditable</div>
      </div>

      {/* Right — Status & Clock */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1.5 text-[11px] text-status-success">
          <div className="w-2 h-2 rounded-full bg-status-success animate-pulse-green" style={{ boxShadow: '0 0 6px rgba(22,163,74,.5)' }} />
          <span>ออนไลน์</span>
        </div>
        <div className="text-right">
          <div className="text-[20px] font-bold text-brand-primary tabular-nums">{timeStr}</div>
          <div className="text-[10px] text-text-secondary">{dateStr}</div>
        </div>
      </div>
    </header>
  );
}
