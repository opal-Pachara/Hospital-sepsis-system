import { useRTSASStore } from '../store/useRTSASStore';
import type { TimelineEvent, TimelineEventColor } from '../types';
import { showToast } from './Toast';
import { maskHN } from '../utils/hnMask';

const dotColorMap: Record<TimelineEventColor, string> = {
  green: '#16a34a',
  blue: '#2563eb',
  orange: '#f97316',
  red: '#dc2626',
  gray: '#475569',
};

function TimelineEntry({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const time = new Date(event.timestamp).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const color = dotColorMap[event.color] || '#475569';

  return (
    <div className="flex gap-2.5 py-1.5 relative">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[14px] top-[22px] bottom-[-5px] w-px bg-border-light" />
      )}
      {/* Dot */}
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 relative z-10"
        style={{
          background: color,
          ...(isLast ? { boxShadow: `0 0 5px ${color}` } : {}),
        }}
      />
      <div className="flex-1">
        <div className="text-xs text-text-muted">{time}</div>
        <div className="text-sm text-text-secondary mt-0.5 leading-snug">{event.actionText}</div>
      </div>
    </div>
  );
}

export default function TimelinePanel() {
  const { timeline, getTimelineText, selectedPatient } = useRTSASStore();

  const handleCopyToHIS = () => {
    const text = getTimelineText();
    navigator.clipboard.writeText(text).then(() => {
      showToast('คัดลอกสำเร็จแล้ว — พร้อมวางใน HIS', 'success');
    }).catch(() => {
      showToast('ไม่สามารถคัดลอกอัตโนมัติได้', 'error');
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Timeline entries */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {timeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <div className="text-3xl mb-3 opacity-30">📅</div>
            <p className="text-sm">ยังไม่มีข้อมูล</p>
            <p className="text-xs mt-1">การดำเนินการจะปรากฏที่นี่อัตโนมัติ</p>
          </div>
        ) : (
          <>
            <div className="text-xs font-bold text-text-muted uppercase tracking-wider py-2 px-0 border-b border-border-light mb-2">
              📅 บันทึกเหตุการณ์ {maskHN(selectedPatient?.hn || '')}
            </div>
            {timeline.map((event, i) => (
              <TimelineEntry key={event.id} event={event} isLast={i === timeline.length - 1} />
            ))}
          </>
        )}
      </div>

      {/* Copy bar */}
      {timeline.length > 0 && (
        <div className="px-3 py-2.5 border-t border-border-default bg-surface-elevated flex-shrink-0">
          <button
            onClick={handleCopyToHIS}
            className="w-full py-2.5 rounded-lg text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-colors hover:bg-[#0f172a]"
            style={{ background: '#1e293b' }}
          >
            📋 คัดลอก Timeline เพื่อบันทึกใน HIS
          </button>
          <div className="text-xs text-text-muted text-center mt-1.5">
            คัดลอก → วางใน HIS เพื่อเป็นบันทึกการพยาบาล
          </div>
        </div>
      )}
    </div>
  );
}
