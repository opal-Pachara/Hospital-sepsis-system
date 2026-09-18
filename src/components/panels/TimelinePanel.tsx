import { useState } from 'react';
import { useRTSASStore, isTreatmentTimelineEvent, ensureInitialTimelineEvents } from '../../store/useRTSASStore';
import type { TimelineEvent, TimelineEventColor } from '../../types';
import { showToast } from '../common/Toast';
import { maskHN } from '../../utils/hnMask';

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
          {(() => {
            let text = (event.actionText || '')
              .replace(/\s*—\s*โดย\s+.*$/gi, '')
              .replace(/\s*\(โดย\s+[^)]+\)/gi, '')
              .replace(/\s*\[ผู้ปฏิบัติ:\s*[^\]]*\]/gi, '')
              .trim();
            if (text.includes('แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด')) {
              const match = text.match(/^(.*?\([^)]*น\.\))/);
              if (match) return match[1];
              return '✓ แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด';
            }
            return text;
          })()}
        </div>
      </div>
    </div>
  );
}

/** สรุปเวลาสำคัญในขั้นตอนการรักษา */
function TreatmentTimeSummary() {
  const { selectedPatient, patientData, timeline } = useRTSASStore();
  if (!selectedPatient) return null;

  const data = patientData[selectedPatient.id];
  const ts = selectedPatient.treatmentStatus;
  const rawTimeline = (timeline && timeline.length > 0) ? timeline : (data?.timeline || []);

  const formatThaiTime = (isoStr: string | null | undefined): string => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return '—'; }
  };

  // Helper to find timestamp in timeline events by text match
  const findEventTime = (predicate: (actionText: string) => boolean): string | null => {
    const ev = rawTimeline.find((e) => predicate(e.actionText || ''));
    return ev?.timestamp || null;
  };

  // Get checklist item's completedAt by ID
  const getItemTime = (itemId: string): string | null => {
    const item = data?.checklist?.flatMap((p) => p.items).find((i) => i.id === itemId);
    return item?.completedAt || null;
  };

  // 1. Check if NEWS score is complete
  const nr = selectedPatient.latestNewsResult;
  const isNewsComplete = Boolean(
    nr &&
    nr.missingDataCount === 0 &&
    nr.calculatedAt &&
    nr.riskLevel !== 'incomplete'
  );

  // 2. Real calculation time
  let newsEventTime: string | null = null;
  if (isNewsComplete) {
    newsEventTime =
      nr?.calculatedAt ||
      findEventTime((t) => t.startsWith('🧮') || t.includes('คำนวณ NEWS') || t.includes('คำนวณคะแนน NEWS'));
  }

  // 3. Visit time from patient's arrival or timeline
  let visitTime =
    selectedPatient.arrivalTime ||
    findEventTime((t) => t.startsWith('🏥') || t.includes('เข้ารับบริการ') || t.includes('เข้ารับการตรวจ') || t.includes('Triage') || t.includes('ลงทะเบียน'));

  // 🛑 LOGICAL AUDIT FIX: Visit time CANNOT be after NEWS calculation time!
  if (visitTime && newsEventTime) {
    const vDate = new Date(visitTime).getTime();
    const nDate = new Date(newsEventTime).getTime();
    if (!isNaN(vDate) && !isNaN(nDate) && vDate > nDate) {
      visitTime = newsEventTime;
    }
  }
  // Nurse reassessment
  const nurseReassessTime =
    getItemTime('nurse_reassess') ||
    findEventTime((t) => t.includes('พยาบาลประเมินซ้ำ') || t.includes('ประเมินซ้ำ') || t.includes('รับทราบการแจ้งเตือน'));
  // Report to doctor
  const reportDoctorTime =
    getItemTime('initial_report') ||
    findEventTime((t) => t.includes('รายงานแพทย์เวร') || t.includes('รายงานแพทย์'));
  // Doctor confirmed
  const doctorConfirmTime =
    ts?.countdown_started_at ||
    data?.countdownTimer?.startedAt ||
    getItemTime('doctor_confirm') ||
    findEventTime((t) => t.includes('แพทย์ยืนยัน') || t.includes('แพทย์เวรยืนยัน'));
  // Treatment completed time
  const completedTime =
    ts?.treatment_completed_at ||
    data?.treatmentCompletedAt ||
    findEventTime((t) =>
      t.includes('สิ้นสุดการรักษา') ||
      t.includes('สิ้นสุดกระบวนการ') ||
      t.includes('รักษาเสร็จสิ้น') ||
      t.includes('จบกระบวนการ') ||
      t.includes('Sepsis Bundle ครบถ้วน') ||
      t.includes('Bundle สำเร็จ')
    );

  const rows: { label: string; icon: string; time: string; color: string; step: number }[] = [
    {
      label: 'เวลามาถึง (Visit)',
      icon: '🏥',
      time: formatThaiTime(visitTime),
      color: '#2563eb',
      step: 1,
    },
    {
      label: 'ระบบคำนวณ NEWS',
      icon: isNewsComplete ? '🧮' : '⏳',
      time: isNewsComplete ? formatThaiTime(newsEventTime) : 'รอข้อมูลสัญญาณชีพครบ',
      color: isNewsComplete ? '#7c3aed' : '#f59e0b',
      step: 2,
    },
    {
      label: 'พยาบาลประเมินซ้ำ',
      icon: '👩‍⚕️',
      time: formatThaiTime(nurseReassessTime),
      color: '#0d9488',
      step: 3,
    },
    {
      label: 'รายงานแพทย์เวร',
      icon: '📋',
      time: formatThaiTime(reportDoctorTime),
      color: '#ea580c',
      step: 4,
    },
    {
      label: 'แพทย์เวรยืนยันติดเชื้อ',
      icon: '👨‍⚕️',
      time: formatThaiTime(doctorConfirmTime),
      color: '#dc2626',
      step: 5,
    },
  ];

  // Rule out time if applicable
  const ruledOutTime =
    ts?.sepsis_ruled_out || data?.sepsisRuledOut
      ? data?.ruledOutAt || findEventTime((t) => t.includes('แพทย์ไม่ยืนยัน') || t.includes('Rule Out'))
      : null;

  if (ruledOutTime) {
    rows.push({
      label: 'แพทย์ไม่ยืนยัน (Rule Out)',
      icon: '🟢',
      time: formatThaiTime(ruledOutTime),
      color: '#16a34a',
      step: 99,
    });
  } else if (completedTime) {
    rows.push({
      label: 'รักษาเสร็จสิ้น',
      icon: '✅',
      time: formatThaiTime(completedTime),
      color: '#16a34a',
      step: 99,
    });
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
      padding: '10px 12px',
      marginBottom: '10px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        <span>⏱</span> สรุปเวลาการรักษา
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {rows.map((row) => (
          <div key={row.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px', borderRadius: '6px',
            background: row.time !== '—' ? '#fff' : 'transparent',
            border: row.time !== '—' ? '1px solid #e2e8f0' : '1px solid transparent',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', color: '#334155', fontWeight: 500,
            }}>
              <span style={{
                width: '18px', height: '18px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700, flexShrink: 0,
                background: row.time !== '—' ? `${row.color}15` : '#f1f5f9',
                color: row.time !== '—' ? row.color : '#94a3b8',
                border: `1px solid ${row.time !== '—' ? row.color : '#cbd5e1'}`,
              }}>
                {row.step <= 10 ? row.step : '✓'}
              </span>
              <span style={{ fontSize: '13px' }}>{row.icon}</span>
              {row.label}
            </div>
            <span style={{
              fontSize: '11px', fontWeight: 700,
              fontFamily: 'monospace',
              color: row.time !== '—' ? row.color : '#94a3b8',
              background: row.time !== '—' ? `${row.color}10` : 'transparent',
              padding: '1px 6px', borderRadius: '4px',
            }}>
              {row.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TimelinePanel() {
  const { timeline, selectedPatient, patientData, isAuthenticated } = useRTSASStore();
  const data = selectedPatient ? patientData[selectedPatient.id] : null;
  const rawTimeline = (timeline && timeline.length > 0) ? timeline : (data?.timeline || []);
  const guaranteedTimeline = ensureInitialTimelineEvents(selectedPatient, rawTimeline);
  const treatmentEvents = guaranteedTimeline.filter(isTreatmentTimelineEvent);

  // Sort events chronologically so visit time is always <= calculation time
  treatmentEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const [showTextBox, setShowTextBox] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate HIS text from the actual treatmentEvents in view
  const formatHISRecordText = (): string => {
    if (!selectedPatient) return '';
    const displayHN = isAuthenticated ? selectedPatient.hn : maskHN(selectedPatient.hn || '');
    const patientName = selectedPatient.fullName ? ` (${selectedPatient.fullName})` : '';
    const header = `บันทึกขั้นตอนการรักษา (Clinical Treatment Steps) — HN: ${displayHN}${patientName}\n`;
    const separator = '='.repeat(60) + '\n';

    if (treatmentEvents.length === 0) {
      return header + separator + 'ยังไม่มีขั้นตอนการรักษาที่บันทึก\n' + separator;
    }

    const lines = treatmentEvents.map((event, index) => {
      const time = new Date(event.timestamp).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      let cleanAction = (event.actionText || '')
        .replace(/\s*—\s*โดย\s+.*$/gi, '')
        .replace(/\s*\(โดย\s+[^)]+\)/gi, '')
        .replace(/\s*\[ผู้ปฏิบัติ:\s*[^\]]*\]/gi, '')
        .trim();
      if (cleanAction.includes('แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด') || cleanAction.includes('แพทย์เวรยืนยัน')) {
        const match = cleanAction.match(/^(.*?\([^)]*น\.\))/);
        if (match) {
          cleanAction = match[1];
        } else {
          cleanAction = '✓ แพทย์เวรยืนยันติดเชื้อ';
        }
      }
      const isSkipped = cleanAction.startsWith('⏭ ข้าม');
      const stepLabel = isSkipped ? `ขั้นตอนที่ ${index + 1} (ข้าม)` : `ขั้นตอนที่ ${index + 1}`;
      const actorStr = ' [ผู้ปฏิบัติ: ]';
      return `[${time}] ${stepLabel}: ${cleanAction}${actorStr}`;
    });

    const footer = '\n' + separator + `รวมดำเนินการทั้งหมด: ${treatmentEvents.length} ขั้นตอน`;
    return header + separator + lines.join('\n') + footer;
  };

  const handleCopyToHIS = () => {
    const text = formatHISRecordText();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast('คัดลอกขั้นตอนการรักษาสำเร็จ — พร้อมวางใน HIS', 'success');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

            {/* ─── สรุปเวลาสำคัญในการรักษา ─── */}
            <TreatmentTimeSummary />

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

      {/* Export bar */}
      {treatmentEvents.length > 0 && (
        <div className="px-3 py-2.5 border-t border-border-default bg-surface-elevated flex-shrink-0">
          {/* Toggle show/hide text box */}
          <button
            onClick={() => setShowTextBox((v) => !v)}
            className="w-full py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-center gap-2 transition-all mb-1.5"
            style={{
              background: showTextBox ? '#eff6ff' : '#1e293b',
              color: showTextBox ? '#1e40af' : '#fff',
              border: showTextBox ? '1px solid #bfdbfe' : 'none',
            }}
          >
            {showTextBox ? '▲ ซ่อนกล่องข้อความ' : '📋 แสดงข้อความเพื่อวางใน HIS'}
          </button>

          {/* Expandable text area */}
          {showTextBox && (
            <div className="mb-1">
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                💡 คลิกในกล่องแล้วกด Ctrl+A → Ctrl+C เพื่อคัดลอก หรือกดปุ่มด้านล่าง
              </div>
              <textarea
                readOnly
                value={formatHISRecordText()}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                rows={6}
                style={{
                  width: '100%',
                  resize: 'vertical',
                  fontSize: '10px',
                  lineHeight: '1.7',
                  fontFamily: 'monospace',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'text',
                  display: 'block',
                }}
              />
              <button
                onClick={handleCopyToHIS}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '7px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: 'none',
                  background: copied ? '#16a34a' : '#2563eb',
                  color: '#fff',
                  transition: 'background 0.2s',
                }}
              >
                {copied ? '✅ คัดลอกแล้ว!' : '📋 คัดลอกอัตโนมัติ (Clipboard)'}
              </button>
            </div>
          )}

          {!showTextBox && (
            <div className="text-[10px] text-text-muted text-center">
              กด "แสดงข้อความ" → คลิกกล่อง → Ctrl+A → Ctrl+C แล้วนำไปวางใน HIS ({treatmentEvents.length} ขั้นตอน)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
