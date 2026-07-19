import { useEffect, useState } from 'react';
import type { Patient } from '../types';
import { maskHN } from '../utils/hnMask';
import { useRTSASStore } from '../store/useRTSASStore';
import AuthModal from './AuthModal';

export default function PatientInfoBar({ patient }: { patient: Patient }) {
  const [erElapsed, setErElapsed] = useState('00:00');
  const { isAuthenticated, isHNRevealed, currentUser, revealHN, hideHN } = useRTSASStore();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(patient.arrivalTime).getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setErElapsed(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [patient.arrivalTime]);

  const arrivalTimeStr = new Date(patient.arrivalTime).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const genderIcon = patient.gender === 'male' ? '♂' : patient.gender === 'female' ? '♀' : '⚥';
  const genderLabel = patient.gender === 'male' ? 'ชาย' : patient.gender === 'female' ? 'หญิง' : 'อื่นๆ';
  const isHighRisk = patient.currentRiskLevel === 'high' || patient.currentRiskLevel === 'medium';

  // EC Privacy: Show masked or full HN
  const displayHN = isAuthenticated && isHNRevealed ? patient.hn : maskHN(patient.hn);

  const handleRevealClick = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    } else if (!isHNRevealed) {
      revealHN();
    } else {
      hideHN();
    }
  };

  return (
    <>
      <div
        className="bg-white border border-[#dde3ed] rounded-xl relative overflow-hidden"
        style={{ padding: '10px 14px 10px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}
      >
        {/* Left gradient bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[5px]"
          style={{
            background: isHighRisk
              ? 'linear-gradient(to bottom, #dc2626, #ea580c)'
              : 'linear-gradient(to bottom, #16a34a, #22c55e)',
            borderRadius: '12px 0 0 12px',
          }}
        />

        {/* Row 1: HN + Reveal button + Alert badge */}
        <div className="flex items-center justify-between gap-2" style={{ marginBottom: '5px' }}>
          <div className="flex items-center gap-2">
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>{displayHN}</div>
            {/* Reveal/Hide HN button */}
            <button
              type="button"
              onClick={handleRevealClick}
              title={
                !isAuthenticated
                  ? 'ยืนยันตัวตนเพื่อดู HN เต็ม'
                  : isHNRevealed
                  ? 'ซ่อน HN'
                  : 'ดู HN เต็ม'
              }
              style={{
                padding: '2px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid #bfdbfe',
                background: isHNRevealed ? '#dbeafe' : '#eff6ff',
                color: '#2563eb',
                display: 'flex', alignItems: 'center', gap: '3px',
                transition: 'all 0.2s',
              }}
            >
              {isHNRevealed ? '🔒 ซ่อน' : '🔓 ดู HN เต็ม'}
            </button>
            {/* Auth status indicator */}
            {isAuthenticated && currentUser && (
              <span style={{
                fontSize: '8px', fontWeight: 600, color: '#16a34a',
                background: '#dcfce7', padding: '1px 5px', borderRadius: '4px',
                border: '1px solid #bbf7d0',
              }}>
                ✓ {currentUser.name}
              </span>
            )}
          </div>
          {patient.hasSepsisAlert && (
            <div
              className="animate-pulse-red flex-shrink-0"
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 800,
                textAlign: 'center',
                background: '#fef2f2',
                border: '2px solid #dc2626',
                color: '#dc2626',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              เสี่ยงติดเชื้อในกระแสเลือด — ต้องประเมินทันที
            </div>
          )}
        </div>

        {/* Row 2: Detail */}
        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '5px' }}>
          คัดกรอง: {arrivalTimeStr} น. &nbsp;·&nbsp; {patient.location}
        </div>

        {/* Row 3: Badges + ER time */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 8px',
              borderRadius: '10px', background: '#eff6ff', border: '1px solid #93c5fd', color: '#2563eb',
              whiteSpace: 'nowrap',
            }}>
              {genderIcon} {genderLabel}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 8px',
              borderRadius: '10px', background: '#ecfeff', border: '1px solid #67e8f9', color: '#0891b2',
              whiteSpace: 'nowrap',
            }}>
              {patient.age} ปี
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 600, padding: '2px 8px',
              borderRadius: '10px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
              whiteSpace: 'nowrap',
            }}>
              {patient.chiefComplaint}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span style={{ fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              เวลาใน ER
            </span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
              {erElapsed} นาที
            </span>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          // After auth success, auto-reveal HN
          setTimeout(() => useRTSASStore.getState().revealHN(), 100);
        }}
      />
    </>
  );
}
