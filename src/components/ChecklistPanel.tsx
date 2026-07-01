import { useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { ChecklistPhase, ChecklistItem } from '../types';
import { showToast } from './Toast';

// Thai labels for checklist items
const thaiLabels: Record<string, string> = {
  triage: 'ประเมินอาการผู้ป่วยซ้ำที่จุดคัดแยก',
  er_admission: 'นำผู้ป่วยเข้ารับการรักษาในห้องอุบัติเหตุและฉุกเฉิน',
  initial_report: 'รายงานแพทย์เวรทันที',
  doctor_confirm: 'แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด',
  hemoculture: 'เจาะเลือดเพาะเชื้อ',
  iv_fluid: 'ให้สารน้ำทางหลอดเลือดดำ (IV Fluid)',
  antibiotics: 'ให้ยาปฏิชีวนะ (Antibiotics)',
  lactate: 'ส่ง Lactate Level',
};

const thaiPhaseLabels: Record<string, { icon: string; title: string }> = {
  initial_response: { icon: '📍', title: 'การตอบสนองเบื้องต้นหลังแจ้งเตือน' },
  doctor_confirmation: { icon: '🔬', title: 'การยืนยันการวินิจฉัย — เริ่มนับ 60 นาที' },
  sepsis_bundle: { icon: '💊', title: 'SEPSIS BUNDLE — ดำเนินการภายใน 60 นาที' },
  assessment_schedule: { icon: '📋', title: 'ตารางประเมินสัญญาณชีพซ้ำ' },
};

function DoctorConfirmButton({ item, phaseUnlocked }: { item: ChecklistItem; phaseUnlocked: boolean }) {
  const { completeChecklistItem } = useRTSASStore();
  const [confirming, setConfirming] = useState(false);
  const actor = 'นพ.วิชัย';

  const isCompleted = item.status === 'completed';
  const canComplete = phaseUnlocked && !isCompleted;

  const handleConfirm = () => {
    if (!canComplete) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    completeChecklistItem(item.id, actor);
    showToast('แพทย์ยืนยันแล้ว — เริ่มนับถอยหลัง 60 นาที!', 'warning', 5000);
    setConfirming(false);
  };

  if (isCompleted) {
    return (
      <div
        className="flex items-start gap-2"
        style={{ padding: '7px 8px', borderRadius: '8px', background: '#f0fdf4' }}
      >
        <div style={{
          width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
          background: '#16a34a', border: '2px solid #16a34a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 900, color: '#fff', marginTop: '1px',
        }}>
          ✓
        </div>
        <div className="flex-1">
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textDecoration: 'line-through' }}>
            {thaiLabels[item.id] || item.label}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
            ✅ แพทย์ยืนยัน {item.completedBy} เมื่อ {new Date(item.completedAt!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 12px', marginBottom: '4px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
        {thaiLabels[item.id] || item.label}
      </div>
      <div style={{
        fontSize: '9px', color: '#475569', marginBottom: '8px',
        background: '#eff6ff', padding: '6px 8px', borderRadius: '6px',
        border: '1px solid #bfdbfe', lineHeight: 1.6,
      }}>
        <span style={{ fontWeight: 700, color: '#2563eb' }}>เมื่อแพทย์ยืนยัน</span> — ระบบจะเริ่มจับเวลา 60 นาที<br />
        และสร้างตารางประเมินสัญญาณชีพอัตโนมัติ
      </div>
      <button
        type="button"
        id="doctor-confirm-btn"
        onClick={handleConfirm}
        disabled={!canComplete}
        className={`w-full transition-all ${!canComplete ? 'cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'}`}
        style={{
          padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontFamily: 'inherit',
          ...(!canComplete
            ? { background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0' }
            : confirming
            ? { background: '#fef2f2', border: '2px solid #ef4444', color: '#dc2626' }
            : { background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', boxShadow: '0 4px 12px -2px rgba(16,185,129,.4)' }),
        }}
      >
        {confirming ? '⚠️ ยืนยันอีกครั้ง — เริ่มนับ 60 นาที' : '✅ บันทึก: แพทย์ยืนยันภาวะติดเชื้อ'}
      </button>
      {confirming && (
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{
            width: '100%', padding: '4px', fontSize: '10px', color: '#94a3b8',
            background: 'transparent', border: 'none', cursor: 'pointer',
            marginTop: '4px', fontFamily: 'inherit',
          }}
        >
          ยกเลิก
        </button>
      )}
    </div>
  );
}

function ChecklistItemRow({ item, phaseUnlocked }: { item: ChecklistItem; phaseUnlocked: boolean }) {
  const { completeChecklistItem, updateChecklistInput } = useRTSASStore();
  const [inputVal, setInputVal] = useState(item.inputValue ?? '');
  const [actor] = useState('พย.สุกัญญา');

  if (item.id === 'doctor_confirm') {
    return <DoctorConfirmButton item={item} phaseUnlocked={phaseUnlocked} />;
  }

  const isCompleted = item.status === 'completed';
  const canComplete = phaseUnlocked && !isCompleted;
  const label = thaiLabels[item.id] || item.label;

  const handleComplete = () => {
    if (!canComplete) return;
    if (item.requiresInput && !inputVal.trim()) return;
    completeChecklistItem(item.id, actor, item.requiresInput ? inputVal : undefined);
    if (isCompleted) return;
    showToast(`✓ ${label}`, 'success', 2000);
  };

  return (
    <div
      className={`flex items-start gap-2 transition-all ${
        isCompleted ? '' : canComplete ? 'hover:bg-[#eff6ff] cursor-pointer' : 'opacity-50'
      }`}
      style={{
        padding: '7px 8px',
        borderRadius: '8px',
        marginBottom: '3px',
        ...(isCompleted ? { background: '#f0fdf4' } : {}),
      }}
      onClick={!item.requiresInput ? handleComplete : undefined}
    >
      {/* Checkbox */}
      <div
        style={{
          width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
          border: isCompleted ? '2px solid #16a34a' : '2px solid #cbd5e1',
          background: isCompleted ? '#16a34a' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: '1px',
        }}
      >
        {isCompleted && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900 }}>✓</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div style={{
          fontSize: '11px', fontWeight: 700,
          color: isCompleted ? '#94a3b8' : '#1e293b',
          textDecoration: isCompleted ? 'line-through' : 'none',
        }}>
          {label}
        </div>
        {item.subLabel && (
          <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>
            {item.subLabel}
          </div>
        )}

        {/* Input field */}
        {item.requiresInput && !isCompleted && canComplete && (
          <div style={{ marginTop: '6px' }}>
            <label style={{ fontSize: '9px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
              {item.inputLabel || 'รายละเอียด'}
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  updateChecklistInput(item.id, e.target.value);
                }}
                placeholder={item.inputLabel ?? 'ระบุรายละเอียด...'}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, minWidth: 0, padding: '5px 8px',
                  border: '1px solid #dde3ed', borderRadius: '6px',
                  fontSize: '10px', background: '#f8fafc',
                  fontFamily: 'inherit', color: '#1e293b',
                  outline: 'none',
                }}
              />
              {inputVal.trim() && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleComplete(); }}
                  style={{
                    padding: '5px 10px', fontSize: '10px', fontWeight: 700,
                    color: '#fff', borderRadius: '6px', border: 'none',
                    background: '#2563eb', cursor: 'pointer', fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  บันทึก
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed input value */}
        {item.requiresInput && isCompleted && item.inputValue && (
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>{item.inputValue}</div>
        )}

        {/* Status */}
        {isCompleted ? (
          <div className="flex items-center gap-1" style={{ fontSize: '9px', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            ทำเสร็จแล้วเมื่อ {new Date(item.completedAt!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </div>
        ) : canComplete ? (
          <div className="flex items-center gap-1" style={{ fontSize: '9px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
            <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
            ยังไม่ดำเนินการ
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhaseSection({ phase }: { phase: ChecklistPhase }) {
  const completedCount = phase.items.filter((i) => i.status === 'completed').length;
  const totalCount = phase.items.length;
  const config = thaiPhaseLabels[phase.phase] || { icon: '📌', title: phase.title };

  return (
    <div className={`${!phase.isUnlocked ? 'opacity-50 grayscale cursor-not-allowed' : ''}`} style={{ marginBottom: '8px' }}>
      {/* Phase Header — matches .cl-section-title */}
      <div
        className="flex items-center gap-1.5"
        style={{
          fontSize: '10px', fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '1px',
          padding: '5px 12px', marginBottom: '5px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <span>{config.icon}</span>
        {config.title}
        {totalCount > 0 && (
          <span style={{
            marginLeft: 'auto', fontSize: '9px', fontWeight: 700,
            background: '#f8fafc', color: '#475569',
            padding: '1px 6px', borderRadius: '4px',
            border: '1px solid #e2e8f0',
          }}>
            {completedCount}/{totalCount}
          </span>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: '0 12px' }}>
        {phase.items.map((item, index) => {
          const isItemSequentialUnlocked = phase.isUnlocked && phase.items.slice(0, index).every(i => i.isOptional || i.status === 'completed');
          return (
            <ChecklistItemRow
              key={item.id}
              item={item}
              phaseUnlocked={isItemSequentialUnlocked}
            />
          );
        })}
      </div>

      {/* Lock message */}
      {!phase.isUnlocked && (
        <div style={{
          margin: '4px 12px', padding: '5px 8px', borderRadius: '6px',
          background: '#f1f5f9', fontSize: '9px', color: '#94a3b8',
        }}>
          🔒 ทำ Phase ก่อนหน้าให้เสร็จก่อน
        </div>
      )}
    </div>
  );
}

export default function ChecklistPanel() {
  const { checklist, assessmentSchedule } = useRTSASStore();

  // Calculate overall progress
  const allItems = checklist.flatMap((p) => p.items);
  const completedTotal = allItems.filter((i) => i.status === 'completed').length;
  const totalItems = allItems.length;
  const pct = totalItems > 0 ? Math.round((completedTotal / totalItems) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: '40px' }}>
      {/* Overall progress */}
      <div style={{
        margin: '10px 12px', padding: '8px 12px',
        background: '#fff', borderRadius: '8px',
        border: '1px solid #dde3ed', boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '5px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>ความคืบหน้า Sepsis Bundle</span>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
            {completedTotal}/{totalItems} รายการ
          </span>
        </div>
        <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            className="transition-all duration-700 ease-out"
            style={{ height: '100%', borderRadius: '3px', width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #06b6d4)' }}
          />
        </div>
      </div>

      {/* System alert item (always checked) */}
      <div style={{ padding: '0 12px', marginBottom: '8px' }}>
        <div
          className="flex items-start gap-2"
          style={{ padding: '7px 8px', borderRadius: '8px', background: '#eff6ff', border: '1px solid #bfdbfe' }}
        >
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
            background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37,99,235,.3)',
          }}>
            <span style={{ color: '#fff', fontSize: '10px', fontWeight: 900 }}>✓</span>
          </div>
          <div className="flex-1">
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
              ระบบแจ้งเตือน — NEWS ≥ 5
            </div>
            <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>
              เริ่มกระบวนการอัตโนมัติ
            </div>
          </div>
        </div>
      </div>

      {checklist.map((phase) => (
        <PhaseSection key={phase.phase} phase={phase} />
      ))}

      {/* Assessment Schedule Table — matches .assess-table-wrap */}
      {assessmentSchedule && assessmentSchedule.entries.length > 0 && (
        <div style={{ padding: '0 12px', marginTop: '8px' }}>
          <div style={{
            border: '1px solid #dde3ed', borderRadius: '8px', overflow: 'hidden', background: '#fff',
          }}>
            {/* Table header — matches .at-head */}
            <div
              style={{
                display: 'grid', gridTemplateColumns: '30px 1fr 46px 64px', gap: '4px',
                padding: '5px 8px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
                fontSize: '9px', fontWeight: 700, color: '#2563eb',
                letterSpacing: '0.5px', textTransform: 'uppercase',
              }}
            >
              <span>ครั้งที่</span>
              <span style={{ textAlign: 'center' }}>เวลา</span>
              <span style={{ textAlign: 'center' }}>NEWS</span>
              <span style={{ textAlign: 'center' }}>สถานะ</span>
            </div>

            {/* Rows */}
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {assessmentSchedule.entries.map((entry) => {
                const isDone = entry.isCompleted;
                const isDue = !isDone && new Date() >= new Date(entry.scheduledTime);
                const timeStr = new Date(entry.scheduledTime).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={entry.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '30px 1fr 46px 64px', gap: '4px',
                      padding: '5px 8px', borderBottom: '1px solid #f1f5f9',
                      alignItems: 'center', fontSize: '10px',
                      ...(isDone ? { background: '#f0fdf430' } : isDue ? { background: '#fef2f230' } : {}),
                    }}
                  >
                    <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 700 }}>{entry.sequence}</span>
                    <span style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#1e293b' }}>{timeStr}</span>
                      <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>
                        {entry.intervalType}
                      </span>
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      {entry.newsResult ? (
                        <span style={{
                          fontWeight: 800, fontSize: '10px',
                          color: entry.newsResult.totalScore >= 7 ? '#dc2626'
                            : entry.newsResult.totalScore >= 5 ? '#ea580c'
                            : '#16a34a',
                        }}>
                          {entry.newsResult.totalScore}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </span>
                    <span style={{ textAlign: 'center' }}>
                      {isDone ? (
                        <span style={{
                          padding: '2px 6px', borderRadius: '10px', fontSize: '8px', fontWeight: 700,
                          background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0',
                        }}>
                          ✓ เสร็จสิ้น
                        </span>
                      ) : isDue ? (
                        <button
                          type="button"
                          className="animate-pulse-btn"
                          onClick={() =>
                            useRTSASStore.getState().openModal('assessment_form', {
                              entryId: entry.id,
                              sequence: entry.sequence,
                            })
                          }
                          style={{
                            padding: '2px 6px', borderRadius: '10px', fontSize: '8px', fontWeight: 700,
                            color: '#fff', background: '#dc2626', border: '1px solid #b91c1c',
                            cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                          }}
                        >
                          ⚡ บันทึกด่วน
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            useRTSASStore.getState().openModal('assessment_form', {
                              entryId: entry.id,
                              sequence: entry.sequence,
                            })
                          }
                          style={{
                            padding: '2px 6px', borderRadius: '10px', fontSize: '8px', fontWeight: 700,
                            color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe',
                            cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                          }}
                        >
                          บันทึก
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer — matches .at-footer */}
            <div style={{
              padding: '6px 8px', background: '#eff6ff', borderTop: '1px solid #bfdbfe',
              fontSize: '9px', color: '#0891b2', textAlign: 'center', fontWeight: 600,
            }}>
              ทุก 15 นาที (4 ครั้งแรก) → หลังจากนั้นทุก 30 นาที
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
