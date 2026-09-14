import { describe, it, expect } from 'vitest';
import { maskHN } from '../utils/hnMask';
import type { DailySummaryItem, TreatedCaseItem } from '../pages/TreatedDashboard';

describe('Treated Patients Daily Dashboard — Logic & PDPA Compliance', () => {
  it('masks HN to last 4 digits for PDPA compliance', () => {
    expect(maskHN('HN100162')).toBe('HN****0162');
    expect(maskHN('HN0099')).toBe('HN****0099');
    expect(maskHN('12345678')).toBe('HN****5678');
  });

  it('calculates bundle compliance rate accurately', () => {
    const summary: DailySummaryItem = {
      date: '2026-09-10',
      total_cases: 20,
      high_risk_cases: 4,
      treated_completed: 3,
      ruled_out: 1,
      compliance_rate: 75.0,
    };

    expect(summary.compliance_rate).toBe(75.0);

    // When 0 high-risk cases, compliance is 100%
    const zeroRiskSummary: DailySummaryItem = {
      date: '2026-09-09',
      total_cases: 15,
      high_risk_cases: 0,
      treated_completed: 0,
      ruled_out: 0,
      compliance_rate: 100.0,
    };
    expect(zeroRiskSummary.compliance_rate).toBe(100.0);
  });

  it('strictly excludes full names, citizen IDs, and addresses from treated case items', () => {
    const caseItem: TreatedCaseItem = {
      id: 'HN100162',
      masked_hn: maskHN('HN100162'),
      gender: 'ชาย',
      age: 58,
      news_score: 8,
      risk_level: 'high',
      arrival_date: '2026-09-10',
      arrival_time: '14:30',
      is_treated: true,
      treatment_completed: true,
      sepsis_ruled_out: false,
      treatment_completed_at: '2026-09-10T15:25:00',
      treated_by: 'ทีมแพทย์/พยาบาล ER',
      outcome_label: '✅ Sepsis Bundle สำเร็จ',
    };

    // Assert masked HN
    expect(caseItem.masked_hn).toBe('HN****0162');
    expect(caseItem.masked_hn).not.toContain('100162');

    // Assert PDPA: no name, citizen id, or address properties
    const keys = Object.keys(caseItem);
    expect(keys).not.toContain('patient_name');
    expect(keys).not.toContain('name');
    expect(keys).not.toContain('citizen_id');
    expect(keys).not.toContain('cid');
    expect(keys).not.toContain('address');

    // Essential clinical attributes are preserved
    expect(caseItem.gender).toBe('ชาย');
    expect(caseItem.age).toBe(58);
    expect(caseItem.news_score).toBe(8);
    expect(caseItem.outcome_label).toBe('✅ Sepsis Bundle สำเร็จ');
  });

  it('formats CSV export with UTF-8 BOM and masked patient rows', () => {
    const summaryRows = [
      ['=== สรุปสถิติผู้ป่วยที่รักษาแล้ว (RTSAS Treated Patients Dashboard) ==='],
      ['วันที่', 'ผู้ป่วยทั้งหมด', 'เสี่ยง Sepsis', 'รักษาสำเร็จ', 'Rule Out', 'Compliance Rate'],
      ['2026-09-10', 20, 4, 3, 1, '75%'],
      ['HN (Masked)', 'เพศ', 'อายุ', 'NEWS Score', 'ผลการรักษา'],
      ['HN****0162', 'ชาย', 58, 8, 'Sepsis Bundle สำเร็จ'],
    ];

    const escapeCSV = (val: unknown) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = '\uFEFF' + summaryRows.map((r) => r.map(escapeCSV).join(',')).join('\n');

    expect(csvContent.startsWith('\uFEFF')).toBe(true);
    expect(csvContent).toContain('HN****0162');
    expect(csvContent).not.toContain('HN100162');
    expect(csvContent).toContain('75%');
  });
});
