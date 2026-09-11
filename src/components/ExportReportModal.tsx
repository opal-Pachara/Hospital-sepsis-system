/**
 * ExportReportModal.tsx
 *
 * Modal for generating and downloading Shift Summary Reports (CSV / PDF).
 * Designed to match the ReminderModal aesthetic (top accent bar, icon header,
 * left-accent info cards, 2:1 button ratio).
 */

import { useState, useMemo } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import {
  buildShiftSummary,
  exportCSV,
  exportPDF,
  type ShiftName,
} from '../utils/exportReport';
import { showToast } from './Toast';

const SHIFTS: ShiftName[] = [
  'เช้า (07:00–15:00)',
  'บ่าย (15:00–23:00)',
  'ดึก (23:00–07:00)',
];

// Auto-detect current shift
function detectCurrentShift(): ShiftName {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 15) return 'เช้า (07:00–15:00)';
  if (hour >= 15 && hour < 23) return 'บ่าย (15:00–23:00)';
  return 'ดึก (23:00–07:00)';
}

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportReportModal({ isOpen, onClose }: ExportReportModalProps) {
  const { patients, patientData } = useRTSASStore();
  const [selectedShift, setSelectedShift] = useState<ShiftName>(detectCurrentShift());

  const summary = useMemo(() => {
    const patientList = patients.map((p) => ({ id: p.id, hn: p.hn }));
    return buildShiftSummary(selectedShift, patientList, patientData);
  }, [selectedShift, patients, patientData]);

  if (!isOpen) return null;

  const handleExportCSV = () => {
    exportCSV(summary);
    showToast('✅ ดาวน์โหลด CSV เรียบร้อยแล้ว', 'success');
  };

  const handleExportPDF = () => {
    exportPDF(summary);
    showToast('🖨️ เปิดหน้าต่างพิมพ์ PDF แล้ว', 'success');
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(10, 10, 20, 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '520px',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(37, 99, 235, .3), 0 0 0 1px rgba(37, 99, 235, .12)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ─── Top Accent Bar ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563eb, #0891b2, #2563eb)', flexShrink: 0 }} />

        {/* ─── Header ─── */}
        <div style={{
          padding: '18px 22px 14px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(147, 197, 253, .5)',
          flexShrink: 0,
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #2563eb, #0891b2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
            boxShadow: '0 6px 18px rgba(37, 99, 235, .35)',
          }}>📊</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e40af', letterSpacing: '-0.3px' }}>
              ออกรายงานสรุปประจำ Shift
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              ส่งออกเป็น CSV (Excel) หรือ PDF สำหรับรายงาน
            </div>
          </div>
          <button
            id="btn-export-close"
            onClick={onClose}
            style={{
              width: '34px', height: '34px', borderRadius: '10px',
              border: '1px solid #bfdbfe', background: '#fff',
              color: '#2563eb', fontSize: '15px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#2563eb'; }}
          >✕</button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '18px 22px 22px', overflowY: 'auto', flex: 1 }}>

          {/* Shift Selector */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              เลือก Shift
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {SHIFTS.map((shift) => (
                <button
                  key={shift}
                  onClick={() => setSelectedShift(shift)}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: '10px',
                    fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                    border: selectedShift === shift ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                    background: selectedShift === shift ? '#eff6ff' : '#f8fafc',
                    color: selectedShift === shift ? '#1e40af' : '#64748b',
                  }}
                >
                  {shift.split(' ')[0]}
                  <div style={{ fontWeight: 500, marginTop: '2px', opacity: 0.8 }}>
                    {shift.split(' ').slice(1).join(' ')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Summary Stats Cards */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '10px', marginBottom: '16px',
          }}>
            {/* Stat: Total Patients */}
            <div style={{
              padding: '14px 16px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)',
              border: '1px solid #bfdbfe',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: 'linear-gradient(to bottom, #2563eb, #0891b2)',
                borderRadius: '14px 0 0 14px',
              }} />
              <div style={{ paddingLeft: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#1e40af', lineHeight: 1 }}>
                  {summary.totalPatients}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>ผู้ป่วยใน Shift</div>
              </div>
            </div>

            {/* Stat: Sepsis Confirmed */}
            <div style={{
              padding: '14px 16px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #fef2f2, #fff5f5)',
              border: '1px solid #fecaca',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: 'linear-gradient(to bottom, #dc2626, #b91c1c)',
                borderRadius: '14px 0 0 14px',
              }} />
              <div style={{ paddingLeft: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                  {summary.sepsisConfirmedCases}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>ยืนยัน Sepsis</div>
              </div>
            </div>

            {/* Stat: Avg Bundle Time */}
            <div style={{
              padding: '14px 16px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #f0fdf4, #f7fef9)',
              border: '1px solid #bbf7d0',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: 'linear-gradient(to bottom, #16a34a, #15803d)',
                borderRadius: '14px 0 0 14px',
              }} />
              <div style={{ paddingLeft: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#16a34a', lineHeight: 1 }}>
                  {summary.avgBundleMinutes !== null ? summary.avgBundleMinutes : '—'}
                  {summary.avgBundleMinutes !== null && <span style={{ fontSize: '13px' }}> นาที</span>}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>เวลา Bundle เฉลี่ย</div>
              </div>
            </div>

            {/* Stat: Checklist % */}
            <div style={{
              padding: '14px 16px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #fffbeb, #fff7ed)',
              border: '1px solid #fde68a',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
                background: 'linear-gradient(to bottom, #d97706, #b45309)',
                borderRadius: '14px 0 0 14px',
              }} />
              <div style={{ paddingLeft: '10px' }}>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#d97706', lineHeight: 1 }}>
                  {summary.avgChecklistPct}%
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>เช็คลิสต์ครบเฉลี่ย</div>
              </div>
            </div>
          </div>

          {/* Additional info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '10px',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '16px' }}>🗓️</span>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              วันที่รายงาน: <strong style={{ color: '#1e293b' }}>{summary.reportDate}</strong>
              <span style={{ margin: '0 8px', color: '#cbd5e1' }}>·</span>
              Rule Out: <strong style={{ color: '#1e293b' }}>{summary.ruledOutCases} ราย</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleExportCSV}
              id="btn-export-csv"
              style={{
                flex: 2, padding: '13px', borderRadius: '14px',
                fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                color: '#fff', border: 'none',
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                boxShadow: '0 6px 20px -4px rgba(22, 163, 74, .4)',
                transition: 'all 0.25s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(22,163,74,.5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(22, 163, 74, .4)'; }}
            >
              <span>📄</span>
              <span>ดาวน์โหลด CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              id="btn-export-pdf"
              style={{
                flex: 1, padding: '13px', borderRadius: '14px',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                color: '#fff', border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                boxShadow: '0 6px 20px -4px rgba(37, 99, 235, .4)',
                transition: 'all 0.25s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(37,99,235,.5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(37, 99, 235, .4)'; }}
            >
              <span>🖨️</span>
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
