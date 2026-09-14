import { useEffect, useRef } from 'react';
import { useRTSASStore, isHistoricalPatient } from '../../store/useRTSASStore';

export default function CountdownBanner() {
  const { countdownTimer, tickCountdown, selectedPatient, patientData } = useRTSASStore();
  const intervalRef = useRef<number | null>(null);

  const isHistorical = isHistoricalPatient(selectedPatient, patientData);
  const currentData = selectedPatient ? patientData[selectedPatient.id] : null;
  const isCompleted = (currentData?.treatmentCompleted ?? false) || (currentData?.sepsisRuledOut ?? false);

  useEffect(() => {
    if ((countdownTimer.isActive || countdownTimer.isExpired) && countdownTimer.startedAt && !isHistorical && !isCompleted) {
      intervalRef.current = window.setInterval(() => {
        tickCountdown();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [countdownTimer.isActive, countdownTimer.isExpired, countdownTimer.startedAt, isHistorical, isCompleted, tickCountdown]);

  // Don't show when not started or when viewing historical/completed records
  if (!countdownTimer.startedAt || isHistorical || isCompleted) return null;

  const minutes = Math.floor(countdownTimer.remainingSeconds / 60);
  const seconds = countdownTimer.remainingSeconds % 60;
  const isCritical = countdownTimer.isCritical;
  const isExpired = countdownTimer.isExpired || countdownTimer.remainingSeconds === 0;
  const isWarning = countdownTimer.isWarning;

  const elapsedSecs = countdownTimer.startedAt
    ? Math.floor((Date.now() - new Date(countdownTimer.startedAt).getTime()) / 1000)
    : 3600;
  const overdueMins = Math.floor(Math.max(0, elapsedSecs - countdownTimer.totalDurationSeconds) / 60);

  const confirmTimeStr = countdownTimer.startedAt
    ? new Date(countdownTimer.startedAt).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  const bannerBg = isExpired
    ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
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
        <div className="text-xs uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.7)' }}>
          {isExpired ? '⚠️ เกินกำหนดเวลา 60 นาที (Sepsis Golden Hour)' : '⏱ เวลาที่เหลือ — เป้าหมายยาปฏิชีวนะ'}
        </div>
        <div className="text-3xl font-black text-white tabular-nums leading-tight flex items-center gap-2">
          {isExpired ? (
            <>
              <span>🚨 หมดเวลา!</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid #ef4444',
                  color: '#fecaca',
                }}
              >
                {overdueMins > 0 ? `เกินกำหนด ${overdueMins} นาที` : 'ครบ 60 นาทีแล้ว'}
              </span>
            </>
          ) : (
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          )}
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
