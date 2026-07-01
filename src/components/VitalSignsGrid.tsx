import type { NEWSResult, NEWSParameterScore } from '../types';

const paramConfig: Record<string, { icon: string; label: string; unit: string }> = {
  respiratoryRate: { icon: '🫁', label: 'RR', unit: 'ครั้ง/นาที' },
  spO2: { icon: '💉', label: 'SpO₂', unit: '%' },
  temperature: { icon: '🌡️', label: 'Temp', unit: '°C' },
  systolicBP: { icon: '❤️', label: 'SBP', unit: 'mmHg' },
  heartRate: { icon: '🫀', label: 'HR', unit: 'ครั้ง/นาที' },
  avpu: { icon: '🧠', label: 'AVPU', unit: '' },
  oxygenSupplementation: { icon: '🔵', label: 'O₂', unit: '' },
};

const scoreTagColors: Record<number, { bg: string; color: string }> = {
  0: { bg: '#dcfce7', color: '#16a34a' },
  1: { bg: '#fef9c3', color: '#ca8a04' },
  2: { bg: '#ffedd5', color: '#ea580c' },
  3: { bg: '#fee2e2', color: '#dc2626' },
};

const valueColors: Record<number, string> = {
  0: '#22c55e',
  1: '#eab308',
  2: '#f97316',
  3: '#ef4444',
};

/**
 * Extract only the numeric portion from displayValue
 * e.g. "28 bpm" → "28", "91%" → "91", "39.5°C" → "39.5", "V" → "V"
 */
function extractNumericValue(displayValue: string, parameter: string): string {
  if (parameter === 'avpu') return displayValue;
  // Remove known unit suffixes
  return displayValue
    .replace(/\s*bpm$/i, '')
    .replace(/%$/, '')
    .replace(/°C$/i, '')
    .replace(/\s*mmHg$/i, '')
    .trim();
}

function VitalCard({ param }: { param: NEWSParameterScore }) {
  const config = paramConfig[param.parameter] || { icon: '📊', label: param.label, unit: '' };
  const scoreTag = scoreTagColors[Math.min(param.score, 3)];
  const valColor = valueColors[Math.min(param.score, 3)];

  const isAvpu = param.parameter === 'avpu';
  const borderClass = param.score >= 3 ? 'border-[#fca5a5] bg-[#fef2f2]'
    : param.score >= 1 ? 'border-[#fdba74] bg-[#fff7ed]'
      : 'border-[#e2e8f0] bg-[#f8fafc]';

  // Extract clean numeric value — prevent duplicate units
  const cleanValue = extractNumericValue(param.displayValue, param.parameter);

  // Unit label for below the value
  let unitLabel = config.unit;
  if (isAvpu) {
    unitLabel = cleanValue === 'A' ? 'Alert' : cleanValue === 'V' ? 'Voice' : cleanValue === 'P' ? 'Pain' : cleanValue === 'U' ? 'Unresponsive' : cleanValue;
  }

  return (
    <div className={`rounded-[10px] border text-center relative overflow-hidden ${borderClass}`}
      style={{ padding: '10px 8px' }}>
      {/* Score tag circle */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: '4px', right: '4px',
          width: '18px', height: '18px',
          borderRadius: '50%',
          fontSize: '9px', fontWeight: 800,
          background: scoreTag.bg, color: scoreTag.color,
        }}
      >
        {param.score}
      </div>

      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
        {config.label}
      </div>
      <div
        style={{
          fontSize: isAvpu ? '16px' : '20px',
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          margin: '4px 0 2px',
          color: valColor,
        }}
      >
        {cleanValue}
      </div>
      <div style={{ fontSize: '9px', color: '#475569' }}>{unitLabel}</div>
    </div>
  );
}

export default function VitalSignsGrid({ newsResult }: { newsResult: NEWSResult }) {
  const timeStr = new Date(newsResult.calculatedAt).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Filter out oxygenSupplementation for the grid display (mockup doesn't show it)
  const displayParams = newsResult.breakdown.filter(
    (p) => p.parameter !== 'oxygenSupplementation'
  );

  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title">
          <span>📊</span> สัญญาณชีพ — ณ เวลา {timeStr} น.
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8' }}>🔵 ตัวเลขในวงกลม = คะแนน NEWS</div>
      </div>
      <div className="section-card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {displayParams.map((param) => (
            <VitalCard key={param.parameter} param={param} />
          ))}
        </div>
      </div>
    </div>
  );
}
