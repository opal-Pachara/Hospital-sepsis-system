import { useEffect, useRef } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';

export default function CountdownBanner() {
  const { countdownTimer, tickCountdown } = useRTSASStore();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (countdownTimer.isActive && !countdownTimer.isExpired) {
      intervalRef.current = window.setInterval(() => {
        tickCountdown();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [countdownTimer.isActive, countdownTimer.isExpired, tickCountdown]);

  // Don't show when not active
  if (!countdownTimer.isActive) return null;

  const minutes = Math.floor(countdownTimer.remainingSeconds / 60);
  const seconds = countdownTimer.remainingSeconds % 60;
  const isCritical = countdownTimer.isCritical;
  const isExpired = countdownTimer.isExpired;
  const isWarning = countdownTimer.isWarning;

  const confirmTimeStr = countdownTimer.startedAt
    ? new Date(countdownTimer.startedAt).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  const bannerBg = isExpired
    ? '#7f1d1d'
    : isWarning || isCritical
      ? 'linear-gradient(135deg, #7c2d12, #b91c1c)'
      : 'linear-gradient(135deg, #1e293b, #0f3460)';

  return (
    <div
      className="px-3.5 py-2 flex items-center justify-between flex-shrink-0 border-b"
      style={{
        background: bannerBg,
        borderColor: '#334155',
      }}
    >
      <div>
        <div className="text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.6)' }}>
          ⏱ เวลาที่เหลือ — เป้าหมายยาปฏิชีวนะ
        </div>
        <div className="text-3xl font-black text-white tabular-nums leading-tight">
          {isExpired
            ? 'หมดเวลา!'
            : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs" style={{ color: 'rgba(255,255,255,.6)' }}>แพทย์ยืนยัน</div>
        <div className="text-sm font-bold text-right" style={{ color: '#fbbf24' }}>{confirmTimeStr} น.</div>
        <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.6)' }}>เป้าหมาย ยา ≤ 60 นาที</div>
      </div>
    </div>
  );
}
