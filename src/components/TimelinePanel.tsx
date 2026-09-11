import { useRTSASStore, isTreatmentTimelineEvent } from '../store/useRTSASStore';
import type { TimelineEvent, TimelineEventColor } from '../types';
import { showToast } from './Toast';
import { maskHN } from '../utils/hnMask';

const dotColorMap: Record<TimelineEventColor, string> = {
  green: '#16a34a',
  blue: '#2563eb',
  orange: '#ea580c',
  red: '#dc2626',
  gray: '#64748b',
};

function TimelineEntry({
  event,
  isLast,
  stepNumber,
}: {
  event: TimelineEvent;
  isLast: boolean;
  stepNumber: number;
}) {
  const time = new Date(event.timestamp).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const isSkipped = event.actionText.startsWith('⏭ ข้าม');
  const color = isSkipped ? '#64748b' : (dotColorMap[event.color] || '#2563eb');

  return (
    <div className="flex gap-3 py-2.5 relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[13px] top-[26px] bottom-[-6px] w-[2px] bg-border-light" />
      )}
      {/* Step Number Badge */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 text-[11px] font-bold shadow-xs"
        style={{
          background: isSkipped ? '#f8fafc' : '#eff6ff',
          color: color,
          border: `1.5px solid ${color}`,
        }}
        title={`ขั้นตอนที่ ${stepNumber}`}
      >
        {stepNumber}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-text-muted tracking-wide">
            {isSkipped ? `ขั้นตอนที่ ${stepNumber} (ข้าม)` : `ขั้นตอนที่ ${stepNumber}`}
          </span>
          <span className="text-[10px] text-text-muted font-mono bg-surface-base px-1.5 py-0.5 rounded border border-border-light">
            {time}
          </span>
        </div>
        <div className="text-sm font-medium text-text-primary mt-1 leading-snug break-words">
          {event.actionText}
        </div>
        {event.actor && (
          <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1.5">
            <span className="opacity-75">ผู้ปฏิบัติ:</span>
            <span className="font-medium text-text-secondary">{event.actor}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimelinePanel() {
  const { timeline, getTimelineText, selectedPatient } = useRTSASStore();
  const treatmentEvents = (timeline || []).filter(isTreatmentTimelineEvent);

  const handleCopyToHIS = () => {
    const text = getTimelineText();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast('คัดลอกขั้นตอนการรักษาสำเร็จ — พร้อมวางใน HIS', 'success');
      })
      .catch(() => {
        showToast('ไม่สามารถคัดลอกอัตโนมัติได้', 'error');
      });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Timeline entries */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {treatmentEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted text-center px-4">
            <div className="text-3xl mb-3 opacity-40">📋</div>
            <p className="text-sm font-semibold text-text-secondary">ยังไม่มีขั้นตอนการรักษาที่บันทึก</p>
            <p className="text-xs mt-1.5 max-w-[260px] text-text-muted leading-relaxed">
              เมื่อเริ่มปฏิบัติตาม Checklist หรือบันทึกสัญญาณชีพ ระบบจะนับและแสดงลำดับขั้นตอนการรักษาที่นี่โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between py-2 px-0.5 border-b border-border-light mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  📅 ขั้นตอนการรักษา
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {maskHN(selectedPatient?.hn || '')}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {treatmentEvents.length} ขั้นตอน
              </span>
            </div>
            {treatmentEvents.map((event, i) => (
              <TimelineEntry
                key={event.id}
                event={event}
                stepNumber={i + 1}
                isLast={i === treatmentEvents.length - 1}
              />
            ))}
          </>
        )}
      </div>

      {/* Copy bar */}
      {treatmentEvents.length > 0 && (
        <div className="px-3 py-2.5 border-t border-border-default bg-surface-elevated flex-shrink-0">
          <button
            onClick={handleCopyToHIS}
            className="w-full py-2.5 rounded-lg text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors hover:bg-[#0f172a]"
            style={{ background: '#1e293b' }}
          >
            📋 คัดลอกขั้นตอนการรักษาเพื่อบันทึกใน HIS
          </button>
          <div className="text-xs text-text-muted text-center mt-1.5">
            คัดลอก → วางใน HIS เป็นบันทึกการพยาบาล (รวม {treatmentEvents.length} ขั้นตอน)
          </div>
        </div>
      )}
    </div>
  );
}
