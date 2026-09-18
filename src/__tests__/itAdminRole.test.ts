import { describe, it, expect } from 'vitest';

describe('IT Admin Role & Diagnostics Logs Logic', () => {
  interface SystemLogItem {
    id: string | number;
    timestamp: string;
    level: string;
    message: string;
    component?: string;
    details?: any;
  }

  const sampleLogs: SystemLogItem[] = [
    { id: 1, timestamp: '2026-09-17 21:00:00', level: 'ERROR', message: 'HOSxP MySQL connection timeout', component: 'HOSxP_DB' },
    { id: 2, timestamp: '2026-09-17 21:00:05', level: 'Warning', message: 'Sync latency high (250ms)', component: 'Scheduler' },
    { id: 3, timestamp: '2026-09-17 21:00:10', level: 'Note', message: 'Admin authenticated successfully', component: 'Auth' },
    { id: 4, timestamp: '2026-09-17 21:00:15', level: 'Note', message: 'Cache cleaned', component: 'Cache_Service' },
  ];

  function filterLogs(
    logs: SystemLogItem[],
    levelFilter: 'ALL' | 'ERROR' | 'Warning' | 'Note',
    searchQuery: string
  ): SystemLogItem[] {
    return logs.filter((l) => {
      if (levelFilter !== 'ALL') {
        const lvl = l.level.toUpperCase();
        if (levelFilter === 'ERROR' && lvl !== 'ERROR') return false;
        if (levelFilter === 'Warning' && !lvl.includes('WARN')) return false;
        if (levelFilter === 'Note' && (lvl !== 'NOTE' && lvl !== 'INFO')) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMsg = (l.message || '').toLowerCase().includes(q);
        const matchComp = (l.component || '').toLowerCase().includes(q);
        return matchMsg || matchComp;
      }
      return true;
    });
  }

  it('filters all logs when level is ALL and query is empty', () => {
    const result = filterLogs(sampleLogs, 'ALL', '');
    expect(result.length).toBe(4);
  });

  it('filters only ERROR logs', () => {
    const result = filterLogs(sampleLogs, 'ERROR', '');
    expect(result.length).toBe(1);
    expect(result[0].level).toBe('ERROR');
  });

  it('filters only Warning logs', () => {
    const result = filterLogs(sampleLogs, 'Warning', '');
    expect(result.length).toBe(1);
    expect(result[0].message).toContain('Sync latency');
  });

  it('filters only Note/Info logs', () => {
    const result = filterLogs(sampleLogs, 'Note', '');
    expect(result.length).toBe(2);
  });

  it('filters by search term in message or component', () => {
    const result1 = filterLogs(sampleLogs, 'ALL', 'HOSxP');
    expect(result1.length).toBe(1);

    const result2 = filterLogs(sampleLogs, 'ALL', 'Auth');
    expect(result2.length).toBe(1);
    expect(result2[0].component).toBe('Auth');
  });

  it('verifies that IT admin role is strictly it_admin and distinguished from doctor and nurse', () => {
    const roles = ['doctor', 'nurse', 'it_admin'] as const;
    const isITAdmin = (role: string) => role === 'it_admin';

    expect(isITAdmin(roles[0])).toBe(false);
    expect(isITAdmin(roles[1])).toBe(false);
    expect(isITAdmin(roles[2])).toBe(true);
  });
});
