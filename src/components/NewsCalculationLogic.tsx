import type { NEWSResult, RiskLevel } from '../types';

const paramLabels: Record<string, { icon: string; label: string; normalRange: string }> = {
  respiratoryRate: { icon: '🫁', label: 'อัตราการหายใจ (RR)', normalRange: '12–20' },
  spO2: { icon: '💉', label: 'SpO₂', normalRange: '≥ 96%' },
  temperature: { icon: '🌡️', label: 'อุณหภูมิร่างกาย', normalRange: '36.1–38.0' },
  systolicBP: { icon: '❤️', label: 'SBP', normalRange: '111–219' },
  heartRate: { icon: '🫀', label: 'ชีพจร (HR)', normalRange: '51–90' },
  avpu: { icon: '🧠', label: 'GCS/ระดับความรู้สึกตัว', normalRange: 'GCS 15 (A)' },
  oxygenSupplementation: { icon: '🔵', label: 'O₂ Supplement', normalRange: 'Room Air' },
};

const riskLabels: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'ปกติ', color: '#16a34a' },
  low_medium: { label: 'ปกติ', color: '#16a34a' },
  medium: { label: 'เฝ้าระวัง', color: '#ea580c' },
  high: { label: '⚠ เสี่ยงติดเชื้อ', color: '#ef4444' },
};

const ptsClasses: Record<number, string> = {
  0: 'text-[#16a34a]',
  1: 'text-[#ca8a04]',
  2: 'text-[#ea580c]',
  3: 'text-[#dc2626]',
};

export default function NewsCalculationLogic({ newsResult }: { newsResult: NEWSResult }) {
  const risk = riskLabels[newsResult.riskLevel];

  // Filter out oxygenSupplementation for display (mockup doesn't show it)
  const displayParams = newsResult.breakdown.filter(
    (p) => p.parameter !== 'oxygenSupplementation'
  );

  // Calculate visible score (sum of displayed params only) to avoid mismatch
  const visibleScore = displayParams.reduce((sum, p) => sum + p.score, 0);
  // Max possible score for displayed params (6 params × max 3 each = 18)
  const maxScore = displayParams.length * 3;

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title"><span>🔍</span> การคำนวณ NEWS — Transparent Rule-Based</div>
        <div style={{ fontSize: '9px', color: '#0891b2', background: '#ecfeff', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a5f3fc' }}>
          ✅ ตรวจสอบย้อนกลับได้
        </div>
      </div>
      <div className="section-card-body">
        <div className="flex flex-col gap-2.5">
          {/* NEWS Score Box */}
          <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: '1px solid #dde3ed' }}>
            {/* Score Header */}
            <div className="flex items-center justify-between" style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #dde3ed' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.3 }}>
                  National Early Warning Score (NEWS)
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '2px' }}>Royal College of Physicians, 2017</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1, color: risk.color }}>{newsResult.totalScore}</div>
                <div style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px', color: risk.color }}>{risk.label}</div>
              </div>
            </div>

            {/* Table header */}
            <div className="flex items-center" style={{
              padding: '5px 12px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
              fontSize: '9px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              <span className="flex-1">พารามิเตอร์</span>
              <span style={{ width: '90px', textAlign: 'center' }}>ค่าที่วัดได้</span>
              <span style={{ width: '72px', textAlign: 'center' }}>เกณฑ์ปกติ</span>
              <span style={{ width: '40px', textAlign: 'center' }}>คะแนน</span>
            </div>

            {/* Rows */}
            {displayParams.map((param) => {
              const config = paramLabels[param.parameter] || { icon: '📊', label: param.label, normalRange: '—' };
              const isHighlight = param.score >= 3;
              const ptsClass = ptsClasses[Math.min(param.score, 3)];

              return (
                <div
                  key={param.parameter}
                  className="flex items-center"
                  style={{
                    padding: '5px 12px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '11px',
                    ...(isHighlight ? { background: '#fef2f2' } : {}),
                  }}
                >
                  <span className="flex-1" style={{ color: '#475569' }}>
                    {config.icon} {config.label}
                  </span>
                  <span style={{ width: '90px', textAlign: 'center', fontWeight: 600 }}>{param.displayValue}</span>
                  <span style={{ width: '72px', textAlign: 'center', fontSize: '9px', color: '#94a3b8' }}>{config.normalRange}</span>
                  <span className={`${ptsClass}`} style={{ width: '40px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                    +{param.score}
                  </span>
                </div>
              );
            })}

            {/* Total row */}
            <div className="flex justify-between items-center" style={{
              padding: '8px 12px', background: '#fef2f2', borderTop: '1px solid #fca5a5',
            }}>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>รวม NEWS Score</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#ef4444' }}>
                {newsResult.totalScore} / {maxScore}
              </span>
            </div>
          </div>

          {/* Rule Logic Box */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔎</span> Logic การแจ้งเตือน
            </div>
            <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
              <span style={{ color: '#2563eb', fontWeight: 700 }}>IF</span> NEWS ≥ 5<br />
              <span style={{ color: '#2563eb', fontWeight: 700 }}>→</span>{' '}
              <span style={{ color: '#dc2626', fontWeight: 700 }}>เสี่ยงติดเชื้อในกระแสเลือด 🔴</span>
              <br /><br />
              NEWS = <span style={{ color: '#2563eb', fontWeight: 700 }}>{newsResult.totalScore}</span>{' '}
              ({newsResult.totalScore >= 5 ? '≥ 5 ✓' : '< 5'})
              <div style={{
                marginTop: '6px', padding: '4px 8px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 700,
                ...(newsResult.totalScore >= 5
                  ? { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }
                  : { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }),
              }}>
                {newsResult.totalScore >= 5
                  ? '🔴 เสี่ยงติดเชื้อในกระแสเลือด'
                  : '🟢 ไม่พบความเสี่ยง'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
