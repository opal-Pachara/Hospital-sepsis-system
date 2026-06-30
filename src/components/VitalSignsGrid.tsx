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

function VitalCard({ param }: { param: NEWSParameterScore }) {
  const config = paramConfig[param.parameter] || { icon: '📊', label: param.label, unit: '' };
  const scoreTag = scoreTagColors[Math.min(param.score, 3)];
  const valColor = valueColors[Math.min(param.score, 3)];

  const isAvpu = param.parameter === 'avpu';
  const borderClass = param.score >= 3 ? 'border-[#fca5a5] bg-[#fef2f2]'
    : param.score >= 1 ? 'border-[#fdba74] bg-[#fff7ed]'
    : 'border-[#e2e8f0] bg-[#f8fafc]';

  return (
    <div className={`vital-card rounded-[10px] border p-2.5 text-center relative ${borderClass}`}>
      {/* Score tag circle */}
      <div
        className="absolute top-1 right-1 text-[9px] font-extrabold w-[18px] h-[18px] rounded-full flex items-center justify-center"
        style={{ background: scoreTag.bg, color: scoreTag.color }}
      >
        {param.score}
      </div>

      <div className="text-[9px] text-[#64748b] uppercase tracking-wider font-semibold">{config.label}</div>
      <div
        className="text-xl font-extrabold tabular-nums my-1"
        style={{
          color: valColor,
          ...(isAvpu ? { fontSize: '16px', marginTop: '6px' } : {}),
        }}
      >
        {param.displayValue}
      </div>
      <div className="text-[9px] text-text-secondary">{isAvpu ? (param.displayValue === 'A' ? 'Alert' : param.displayValue) : config.unit}</div>
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
        <div className="text-[10px] text-text-muted">🔵 ตัวเลขในวงกลม = คะแนน NEWS</div>
      </div>
      <div className="section-card-body">
        <div className="grid grid-cols-3 gap-2">
          {displayParams.map((param) => (
            <VitalCard key={param.parameter} param={param} />
          ))}
        </div>
      </div>
    </div>
  );
}
