import type { NEWSResult, RiskLevel } from '../types';

const paramLabels: Record<string, { icon: string; label: string; normalRange: string }> = {
  respiratoryRate: { icon: '🫁', label: 'อัตราการหายใจ (RR)', normalRange: '12–20' },
  spO2: { icon: '💉', label: 'SpO₂', normalRange: '≥ 96%' },
  temperature: { icon: '🌡️', label: 'อุณหภูมิร่างกาย', normalRange: '36.1–38.0' },
  systolicBP: { icon: '❤️', label: 'SBP', normalRange: '111–219' },
  heartRate: { icon: '🫀', label: 'ชีพจร (HR)', normalRange: '51–90' },
  avpu: { icon: '🧠', label: 'ระดับความรู้สึกตัว', normalRange: 'Alert' },
  oxygenSupplementation: { icon: '🔵', label: 'O₂ Supplement', normalRange: 'Room Air' },
};

const riskLabels: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: 'LOW RISK', color: '#16a34a' },
  low_medium: { label: 'LOW-MEDIUM', color: '#ca8a04' },
  medium: { label: 'MEDIUM RISK', color: '#ea580c' },
  high: { label: '⚠ HIGH RISK', color: '#ef4444' },
};

const ptsClasses: Record<number, string> = {
  0: 'text-[#16a34a]',
  1: 'text-[#ca8a04]',
  2: 'text-[#ea580c]',
  3: 'text-[#dc2626]',
};

export default function NewsCalculationLogic({ newsResult }: { newsResult: NEWSResult }) {
  const risk = riskLabels[newsResult.riskLevel];
  const displayParams = newsResult.breakdown.filter(
    (p) => p.parameter !== 'oxygenSupplementation'
  );

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title"><span>🔍</span> การคำนวณ NEWS — Transparent Rule-Based</div>
        <div className="text-[9px] py-0.5 px-2 rounded-md"
          style={{ color: '#0891b2', background: '#ecfeff', border: '1px solid #a5f3fc' }}>
          ✅ ตรวจสอบย้อนกลับได้
        </div>
      </div>
      <div className="section-card-body">
        <div className="flex flex-col gap-2.5">
          {/* NEWS Score Box */}
          <div className="bg-white rounded-[10px] overflow-hidden border border-border-default">
            {/* Score Header */}
            <div className="px-3 py-2 bg-surface-elevated flex items-center justify-between border-b border-border-default">
              <div>
                <div className="text-[10px] font-bold text-text-secondary uppercase tracking-wider leading-snug">
                  National Early Warning Score (NEWS)
                </div>
                <div className="text-[9px] text-text-muted mt-0.5">Royal College of Physicians, 2017</div>
              </div>
              <div className="text-right">
                <div className="text-[28px] font-black leading-none" style={{ color: risk.color }}>{newsResult.totalScore}</div>
                <div className="text-[9px] font-semibold mt-0.5" style={{ color: risk.color }}>{risk.label}</div>
              </div>
            </div>

            {/* Table header */}
            <div className="flex items-center px-3 py-1.5 text-[9px] font-bold text-text-secondary uppercase tracking-wider border-b"
              style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
              <span className="flex-1">พารามิเตอร์</span>
              <span className="w-[90px] text-center">ค่าที่วัดได้</span>
              <span className="w-[72px] text-center">เกณฑ์ปกติ</span>
              <span className="w-[40px] text-center">คะแนน</span>
            </div>

            {/* Rows */}
            {displayParams.map((param) => {
              const config = paramLabels[param.parameter] || { icon: '📊', label: param.label, normalRange: '—' };
              const isHighlight = param.score >= 3;
              const ptsClass = ptsClasses[Math.min(param.score, 3)];

              return (
                <div
                  key={param.parameter}
                  className="flex items-center px-3 py-1.5 border-b border-[#f1f5f9] text-[11px]"
                  style={isHighlight ? { background: '#fef2f2' } : {}}
                >
                  <span className="flex-1 text-text-secondary">
                    {config.icon} {config.label}
                  </span>
                  <span className="w-[90px] text-center font-semibold">{param.displayValue}</span>
                  <span className="w-[72px] text-center text-[9px] text-text-muted">{config.normalRange}</span>
                  <span className={`w-[40px] text-center font-extrabold text-[13px] ${ptsClass}`}>
                    +{param.score}
                  </span>
                </div>
              );
            })}

            {/* Total row */}
            <div className="px-3 py-2 flex justify-between items-center border-t"
              style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
              <span className="text-[11px] text-text-secondary font-semibold">รวม NEWS Score</span>
              <span className="text-[22px] font-black" style={{ color: '#ef4444' }}>
                {newsResult.totalScore} / 18
              </span>
            </div>
          </div>

          {/* Rule Logic Box */}
          <div className="rounded-[10px] p-2.5 px-3"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              style={{ color: '#0891b2' }}>
              <span>🔎</span> Logic การแจ้งเตือน
            </div>
            <div className="text-[11px] text-text-secondary leading-relaxed">
              <span className="text-brand-primary font-bold">IF</span> NEWS ≥ 5<br />
              <span className="text-brand-primary font-bold">→</span>{' '}
              <span className="text-status-error font-bold">เสี่ยงติดเชื้อในกระแสเลือด 🔴</span>
              <br /><br />
              NEWS = <span className="text-brand-primary font-bold">{newsResult.totalScore}</span>{' '}
              ({newsResult.totalScore >= 5 ? '≥ 5 ✓' : '< 5'})
              <div className="mt-1.5 py-1 px-2 rounded-md text-center text-xs font-bold"
                style={
                  newsResult.totalScore >= 5
                    ? { background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626' }
                    : { background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a' }
                }>
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
