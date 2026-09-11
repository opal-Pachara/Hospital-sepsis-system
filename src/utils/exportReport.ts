/**
 * exportReport.ts
 *
 * Utilities for generating Shift Summary Reports and exporting to CSV / PDF.
 * No external library required — PDF uses the browser's print dialog with
 * a prebuilt HTML string injected into a hidden iframe.
 */

import type { PatientData } from '../store/useRTSASStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShiftName = 'เช้า (07:00–15:00)' | 'บ่าย (15:00–23:00)' | 'ดึก (23:00–07:00)';

export interface SepsisCase {
  hn: string;
  confirmedAt: string | null;
  completedAt: string | null;
  bundleMinutes: number | null;
  checklistCompletionPct: number;
  ruledOut: boolean;
}

export interface ShiftSummary {
  shiftName: ShiftName;
  reportDate: string;
  totalPatients: number;
  sepsisConfirmedCases: number;
  ruledOutCases: number;
  avgBundleMinutes: number | null;
  avgChecklistPct: number;
  cases: SepsisCase[];
}

// ---------------------------------------------------------------------------
// Build Summary from Zustand patientData
// ---------------------------------------------------------------------------

export function buildShiftSummary(
  shiftName: ShiftName,
  patients: { id: string; hn: string }[],
  patientData: Record<string, PatientData>
): ShiftSummary {
  const reportDate = new Date().toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const cases: SepsisCase[] = patients.map((p) => {
    const data = patientData[p.id];
    if (!data) {
      return {
        hn: p.hn,
        confirmedAt: null,
        completedAt: null,
        bundleMinutes: null,
        checklistCompletionPct: 0,
        ruledOut: false,
      };
    }

    // Find doctor_confirm item to get confirmedAt
    let confirmedAt: string | null = null;
    const completedAt: string | null = data.treatmentCompletedAt ?? null;
    for (const phase of data.checklist) {
      for (const item of phase.items) {
        if (item.id === 'doctor_confirm' && item.status === 'completed') {
          confirmedAt = item.completedAt;
        }
      }
    }

    // Bundle time in minutes (from doctor_confirm → treatment complete)
    let bundleMinutes: number | null = null;
    if (confirmedAt && completedAt) {
      const start = new Date(confirmedAt).getTime();
      const end = new Date(completedAt).getTime();
      if (end > start) {
        bundleMinutes = Math.round((end - start) / 60000);
      }
    }

    // Checklist completion %
    const allItems = data.checklist.flatMap((ph) => ph.items).filter((i) => !i.isOptional);
    const completedItems = allItems.filter((i) => i.status === 'completed' || i.status === 'skipped');
    const pct = allItems.length > 0 ? Math.round((completedItems.length / allItems.length) * 100) : 0;

    return {
      hn: p.hn,
      confirmedAt,
      completedAt,
      bundleMinutes,
      checklistCompletionPct: pct,
      ruledOut: data.sepsisRuledOut ?? false,
    };
  });

  const confirmedCases = cases.filter((c) => c.confirmedAt && !c.ruledOut);
  const ruledOutCases = cases.filter((c) => c.ruledOut).length;

  const bundleTimes = confirmedCases.map((c) => c.bundleMinutes).filter((m): m is number => m !== null);
  const avgBundleMinutes =
    bundleTimes.length > 0
      ? Math.round(bundleTimes.reduce((a, b) => a + b, 0) / bundleTimes.length)
      : null;

  const avgChecklistPct =
    cases.length > 0
      ? Math.round(cases.reduce((a, c) => a + c.checklistCompletionPct, 0) / cases.length)
      : 0;

  return {
    shiftName,
    reportDate,
    totalPatients: patients.length,
    sepsisConfirmedCases: confirmedCases.length,
    ruledOutCases,
    avgBundleMinutes,
    avgChecklistPct,
    cases,
  };
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCSV(summary: ShiftSummary): void {
  const headers = [
    'HN (Masked)',
    'ยืนยัน Sepsis',
    'Rule Out',
    'เวลา Bundle (นาที)',
    'เช็คลิสต์ครบ (%)',
  ];

  const rows = summary.cases.map((c) => [
    maskHNForExport(c.hn),
    c.confirmedAt ? new Date(c.confirmedAt).toLocaleString('th-TH') : '-',
    c.ruledOut ? 'ใช่' : 'ไม่ใช่',
    c.bundleMinutes !== null ? c.bundleMinutes : '-',
    c.checklistCompletionPct + '%',
  ]);

  // Summary rows
  const summaryRows = [
    [],
    ['=== สรุปผล Shift ==='],
    [`Shift: ${summary.shiftName}`],
    [`วันที่รายงาน: ${summary.reportDate}`],
    [`ผู้ป่วยทั้งหมด: ${summary.totalPatients} ราย`],
    [`ยืนยัน Sepsis: ${summary.sepsisConfirmedCases} ราย`],
    [`Rule Out: ${summary.ruledOutCases} ราย`],
    [`เวลา Bundle เฉลี่ย: ${summary.avgBundleMinutes !== null ? summary.avgBundleMinutes + ' นาที' : 'ไม่มีข้อมูล'}`],
    [`เช็คลิสต์ครบเฉลี่ย: ${summary.avgChecklistPct}%`],
  ];

  const csvLines = [
    headers.map(escapeCSV).join(','),
    ...rows.map((r) => r.map(escapeCSV).join(',')),
    ...summaryRows.map((r) => r.map(escapeCSV).join(',')),
  ];

  const csvContent = '\uFEFF' + csvLines.join('\n'); // BOM for Thai Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `RTSAS_Shift_Report_${summary.shiftName.split(' ')[0]}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// PDF Export (browser print dialog)
// ---------------------------------------------------------------------------

export function exportPDF(summary: ShiftSummary): void {
  const caseRows = summary.cases.map((c) => `
    <tr>
      <td>${maskHNForExport(c.hn)}</td>
      <td>${c.confirmedAt ? new Date(c.confirmedAt).toLocaleString('th-TH') : '—'}</td>
      <td>${c.ruledOut ? '<span class="badge badge-green">Rule Out</span>' : (c.confirmedAt ? '<span class="badge badge-red">ยืนยัน Sepsis</span>' : '—')}</td>
      <td>${c.bundleMinutes !== null ? c.bundleMinutes + ' นาที' : '—'}</td>
      <td>${c.checklistCompletionPct}%</td>
    </tr>
  `).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8"/>
  <title>RTSAS Shift Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', sans-serif; color: #1e293b; background: #fff; padding: 32px; font-size: 13px; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .hospital { font-size: 20px; font-weight: 900; color: #1e40af; }
    .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
    .shift-badge { display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; margin-top: 8px; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-num { font-size: 28px; font-weight: 900; color: #2563eb; }
    .stat-label { font-size: 10px; color: #64748b; margin-top: 4px; }
    .stat-box.red .stat-num { color: #dc2626; }
    .stat-box.green .stat-num { color: #16a34a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
    th { background: #1e40af; color: #fff; padding: 8px 10px; text-align: left; font-weight: 700; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
    .badge-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .badge-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="hospital">🏥 โรงพยาบาลบางคล้า — ห้องอุบัติเหตุและฉุกเฉิน</div>
    <div class="sub">ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด (RTSAS) · รายงานสรุปประจำ Shift</div>
    <span class="shift-badge">🌐 ${summary.shiftName}</span>
    <span class="shift-badge" style="margin-left:8px;background:#fffbeb;border-color:#fde68a;color:#d97706;">📅 ${summary.reportDate}</span>
  </div>

  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-num">${summary.totalPatients}</div>
      <div class="stat-label">ผู้ป่วยทั้งหมด (ราย)</div>
    </div>
    <div class="stat-box red">
      <div class="stat-num">${summary.sepsisConfirmedCases}</div>
      <div class="stat-label">ยืนยัน Sepsis (ราย)</div>
    </div>
    <div class="stat-box green">
      <div class="stat-num">${summary.avgBundleMinutes !== null ? summary.avgBundleMinutes : '—'}</div>
      <div class="stat-label">เวลา Bundle เฉลี่ย (นาที)</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${summary.avgChecklistPct}%</div>
      <div class="stat-label">เช็คลิสต์ครบเฉลี่ย</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>HN (Masked)</th>
        <th>เวลายืนยัน</th>
        <th>สถานะ</th>
        <th>เวลา Bundle</th>
        <th>เช็คลิสต์ครบ</th>
      </tr>
    </thead>
    <tbody>
      ${caseRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">ไม่มีข้อมูล</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    พิมพ์โดยระบบ RTSAS · ${new Date().toLocaleString('th-TH')} · ข้อมูลนี้เป็นความลับทางการแพทย์
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function maskHNForExport(hn: string): string {
  if (!hn || hn.length <= 4) return hn;
  return 'HN' + '*'.repeat(hn.length - 4) + hn.slice(-4);
}
