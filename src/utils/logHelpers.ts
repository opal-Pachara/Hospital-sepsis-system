export type LogCategory = 'ALL' | 'SYNC' | 'CLINICAL' | 'DB' | 'ADMIN';

export interface LogRecordLike {
  id?: string | number;
  timestamp: string;
  pid?: number;
  level: string;
  component?: string;
  message: string;
  details?: Record<string, any> | null;
}

export const LOG_CATEGORIES: { id: LogCategory; label: string; shortLabel: string }[] = [
  { id: 'ALL', label: 'ทุกหมวด', shortLabel: 'ทั้งหมด' },
  { id: 'SYNC', label: '🏥 ดึงข้อมูล HOSxP', shortLabel: '🏥 HOSxP Sync' },
  { id: 'CLINICAL', label: '🩺 การรักษา/คลินิก', shortLabel: '🩺 คลินิก' },
  { id: 'DB', label: '🔌 ฐานข้อมูล/Failover', shortLabel: '🔌 ฐานข้อมูล' },
  { id: 'ADMIN', label: '⚙️ ผู้ดูแลระบบ', shortLabel: '⚙️ Admin' },
];

const CATEGORY_COMPONENT_MAP: Record<Exclude<LogCategory, 'ALL'>, string[]> = {
  SYNC: ['HOSxP_Sync', 'Scheduler'],
  CLINICAL: ['Clinical_Treatment', 'Dashboard_Archive'],
  DB: ['HOSxP_DB', 'Failover_Buffer'],
  ADMIN: ['Admin_DB_Insert', 'Admin_Dashboard', 'Admin'],
};

/** Match a log's component against a high-level category group. */
export function matchesLogCategory(component: string | undefined, category: LogCategory): boolean {
  if (category === 'ALL') return true;
  const targets = CATEGORY_COMPONENT_MAP[category];
  const comp = (component || '').trim();
  return targets.some((t) => t.toLowerCase() === comp.toLowerCase());
}

export interface LogSummaryBadge {
  key: string;
  text: string;
  tone: 'sky' | 'red' | 'amber' | 'green' | 'purple' | 'slate';
}

function formatHnBadge(rawHn: string): string {
  const s = String(rawHn).trim();
  const clean = s.toUpperCase().startsWith('HN') ? s.slice(2).trim() : s;
  return `🏥 HN ${clean}`;
}

/** Extract concise clinical and diagnostic summary badges from log.details JSON. */
export function extractLogSummaryBadges(details?: Record<string, any> | null): LogSummaryBadge[] {
  if (!details || typeof details !== 'object') return [];
  const badges: LogSummaryBadge[] = [];

  if (details.hn) {
    badges.push({ key: 'hn', text: formatHnBadge(details.hn), tone: 'sky' });
  }
  if (details.vn && details.vn !== '-') {
    badges.push({ key: 'vn', text: `VN ${details.vn}`, tone: 'slate' });
  }

  if (typeof details.news_score === 'number') {
    const score = details.news_score;
    const isComplete = details.is_complete !== false && details.news_is_complete !== false;
    badges.push({
      key: 'news',
      text: `📊 NEWS ${score} คะแนน${!isComplete ? ' (ยังไม่ครบ)' : ''}`,
      tone: score >= 7 ? 'red' : score >= 5 ? 'amber' : 'green',
    });
  }

  const missingList: string[] = Array.isArray(details.missing_parameters)
    ? details.missing_parameters
    : Array.isArray(details.news_missing_parameters)
    ? details.news_missing_parameters
    : [];
  if (missingList.length > 0) {
    const shortMissing = missingList
      .map((m) => (m.includes('AVPU') ? 'AVPU' : m.includes('ออกซิเจน') || m.includes('O₂') ? 'O₂' : m))
      .join(', ');
    badges.push({ key: 'missing', text: `⚠️ รอประเมิน: ${shortMissing}`, tone: 'amber' });
  }

  if (details.avpu) {
    const avpuScore = typeof details.avpu_score === 'number' ? details.avpu_score : details.avpu === 'A' ? 0 : 3;
    badges.push({
      key: 'avpu',
      text: `🧠 AVPU: ${details.avpu} (+${avpuScore})`,
      tone: avpuScore > 0 ? 'amber' : 'green',
    });
  }

  if (typeof details.supplemental_oxygen === 'boolean') {
    badges.push({
      key: 'o2',
      text: details.supplemental_oxygen ? '💨 O₂: ใช้ (+2)' : '🌿 Room Air (0)',
      tone: details.supplemental_oxygen ? 'sky' : 'green',
    });
  }

  const actor = details.actor || details.physician || details.confirmed_by || details.completed_by || details.acknowledged_by;
  if (actor) {
    badges.push({ key: 'actor', text: `👤 ${actor}`, tone: 'purple' });
  }

  if (details.checklist_item) {
    badges.push({
      key: 'chk',
      text: `☑️ ${details.checklist_item}${details.input_value ? `: ${details.input_value}` : ''}`,
      tone: details.event === 'checklist_item_skipped' ? 'amber' : 'green',
    });
  }

  if (typeof details.round_sequence === 'number' || typeof details.round_sequence === 'string') {
    badges.push({
      key: 'round',
      text: `🔄 รอบที่ ${details.round_sequence}`,
      tone: details.event === 'assessment_snoozed' ? 'amber' : 'sky',
    });
  }

  if (typeof details.snooze_minutes === 'number') {
    badges.push({
      key: 'snooze',
      text: `⏳ เลื่อน +${details.snooze_minutes} นาที`,
      tone: 'amber',
    });
  }

  if (typeof details.map === 'number') {
    badges.push({
      key: 'map',
      text: `🩸 MAP ${details.map} mmHg`,
      tone: details.map < 65 ? 'red' : 'green',
    });
  }

  if (typeof details.copied_steps === 'number') {
    badges.push({
      key: 'copy',
      text: `📋 คัดลอก ${details.copied_steps} ขั้นตอน`,
      tone: 'sky',
    });
  }

  if (details.countdown_started_at) {
    badges.push({ key: 'timer', text: `⏱️ เริ่มนับ 60 นาที: ${details.countdown_started_at}`, tone: 'red' });
  } else if (details.event === 'alert_acknowledged' && details.timer_started === false) {
    badges.push({ key: 'notimer', text: '⏳ รอแพทย์ยืนยันก่อนจับเวลา', tone: 'slate' });
  }

  if (details.outcome_label) {
    badges.push({ key: 'outcome', text: String(details.outcome_label), tone: 'green' });
  }

  if (details.written_by) {
    badges.push({ key: 'written_by', text: `✍️ เขียนโดย: ${details.written_by}`, tone: 'purple' });
  }

  if (details.er_note) {
    badges.push({ key: 'er_note', text: `📝 ${details.er_note}`, tone: 'sky' });
  }

  return badges;
}

export interface ClientLogEventPayload {
  level?: 'Note' | 'Warning' | 'ERROR';
  component?: string;
  message: string;
  details?: Record<string, any>;
}

/** Send a user/button action log event to the backend SQLite log database (non-blocking). */
export function logClientEvent(payload: ClientLogEventPayload): void {
  try {
    if (typeof fetch !== 'undefined') {
      fetch('/api/logs/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: payload.level || 'Note',
          component: payload.component || 'Clinical_Treatment',
          message: payload.message,
          details: payload.details || {},
        }),
      }).catch(() => {});
    }
  } catch {
    // Ignore logging transport errors so UI actions never fail
  }
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getExportDateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeCsvCell(val: unknown): string {
  const str = val == null ? '' : String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Export visible logs as UTF-8 BOM CSV file for Excel / hospital audit. */
export function exportLogsAsCSV(logs: LogRecordLike[]): void {
  const headers = ['ID', 'Timestamp', 'PID', 'Level', 'Component', 'Message', 'Details JSON'];
  const lines = [
    headers.join(','),
    ...logs.map((l) =>
      [
        escapeCsvCell(l.id ?? ''),
        escapeCsvCell(l.timestamp),
        escapeCsvCell(l.pid ?? 0),
        escapeCsvCell(l.level),
        escapeCsvCell(l.component || 'System'),
        escapeCsvCell(l.message),
        escapeCsvCell(l.details ? JSON.stringify(l.details) : ''),
      ].join(',')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerFileDownload(blob, `rtsas-logs-${getExportDateStamp()}.csv`);
}

/** Export visible logs as formatted JSON file. */
export function exportLogsAsJSON(logs: LogRecordLike[]): void {
  const payload = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      total_count: logs.length,
      logs,
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: 'application/json;charset=utf-8;' });
  triggerFileDownload(blob, `rtsas-logs-${getExportDateStamp()}.json`);
}
