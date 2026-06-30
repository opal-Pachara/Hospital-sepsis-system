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
      <div className="cl-item done no-click">
        <div className="cl-checkbox checked" />
        <div className="flex-1">
          <div className="text-[11px] font-semibold text-text-muted line-through">{thaiLabels[item.id] || item.label}</div>
          <div className="text-[10px] text-status-success font-bold mt-0.5">
            ✅ แพทย์ยืนยัน {item.completedBy} เมื่อ {new Date(item.completedAt!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3">
      <div className="text-[11px] font-semibold text-text-primary mb-1">
        {thaiLabels[item.id] || item.label}
      </div>
      <div className="text-[9px] text-text-muted mb-2">
        เมื่อแพทย์ยืนยัน — ระบบเริ่มจับเวลา 60 นาที<br />
        และสร้างตารางประเมินสัญญาณชีพอัตโนมัติ
      </div>
      <button
        id="doctor-confirm-btn"
        onClick={handleConfirm}
        disabled={!canComplete}
        className="w-full py-2 rounded-lg text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all"
        style={
          confirming
            ? { background: '#dc2626', color: '#fff', border: 'none' }
            : canComplete
              ? { background: '#2563eb', color: '#fff', border: 'none' }
              : { background: '#e2e8f0', color: '#94a3b8', border: 'none', cursor: 'not-allowed' }
        }
      >
        {confirming ? '⚠️ คลิกอีกครั้งเพื่อยืนยัน — เริ่มนับ 60 นาที' : '✅ บันทึก: แพทย์ยืนยันภาวะติดเชื้อ'}
      </button>
      {confirming && (
        <button
          onClick={() => setConfirming(false)}
          className="w-full py-1 text-[10px] text-text-muted hover:text-text-secondary mt-1"
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
      className={`flex items-start gap-2.5 py-2 px-2 rounded-lg mb-0.5 transition-all cursor-pointer ${
        isCompleted ? 'bg-[#f0fdf4]' : canComplete ? 'hover:bg-[#eff6ff]' : 'opacity-50'
      }`}
      onClick={!item.requiresInput ? handleComplete : undefined}
    >
      {/* Checkbox */}
      <div
        className={`w-[18px] h-[18px] rounded-[5px] border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
          isCompleted ? 'bg-status-success border-status-success' : 'border-[#cbd5e1] bg-white'
        }`}
      >
        {isCompleted && <span className="text-white text-[11px] font-black">✓</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div className={`text-[11px] font-semibold ${isCompleted ? 'text-text-muted line-through' : 'text-text-primary'}`}>
          {label}
        </div>

        {/* Input field */}
        {item.requiresInput && !isCompleted && canComplete && (
          <div className="mt-1.5">
            <label className="text-[9px] text-text-muted mb-0.5 block">{item.inputLabel || 'รายละเอียด'}</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  updateChecklistInput(item.id, e.target.value);
                }}
                placeholder={item.inputLabel ?? 'ระบุรายละเอียด...'}
                className="flex-1 py-1 px-2 border rounded-md text-[11px] text-text-primary bg-surface-elevated focus:outline-none focus:border-brand-primary"
                style={{ border: '1.5px solid #e2e8f0' }}
                onClick={(e) => e.stopPropagation()}
              />
              {inputVal.trim() && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleComplete(); }}
                  className="px-2 py-1 text-[10px] font-bold bg-brand-primary text-white rounded-md"
                >
                  บันทึก
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completed input value */}
        {item.requiresInput && isCompleted && item.inputValue && (
          <div className="text-[10px] text-brand-primary mt-0.5">{item.inputValue}</div>
        )}

        {/* Status */}
        {isCompleted ? (
          <div className="text-[9px] text-text-muted mt-0.5">
            ✅ เสร็จ {new Date(item.completedAt!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.
          </div>
        ) : canComplete ? (
          <div className="text-[9px] text-status-error font-bold mt-0.5">🔴 ยังไม่ดำเนินการ</div>
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
    <div className={`${!phase.isUnlocked ? 'opacity-50' : ''}`}>
      {/* Phase Header */}
      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider py-1.5 mb-1.5 border-b border-border-light flex items-center gap-1.5 px-3">
        <span>{config.icon}</span>
        {config.title}
        {totalCount > 0 && (
          <span className="ml-auto text-text-muted">{completedCount}/{totalCount}</span>
        )}
      </div>

      {/* Items */}
      <div className="px-1">
        {phase.items.map((item) => (
          <ChecklistItemRow key={item.id} item={item} phaseUnlocked={phase.isUnlocked} />
        ))}
      </div>

      {/* Lock message */}
      {!phase.isUnlocked && (
        <div className="flex items-center gap-2 mx-3 mt-1 px-3 py-2 bg-surface-elevated rounded-lg text-xs text-text-muted">
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
    <div className="space-y-1 overflow-y-auto pr-1">
      {/* Overall progress */}
      <div className="bg-surface-elevated rounded-lg px-3 py-2 mx-3 mb-2 border border-border-light">
        <div className="flex justify-between text-[10px] text-text-secondary mb-1.5">
          <span>ความคืบหน้า Sepsis Bundle</span>
          <span>{completedTotal}/{totalItems} รายการ</span>
        </div>
        <div className="h-1.5 bg-border-light rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #2563eb, #0891b2)' }}
          />
        </div>
      </div>

      {/* System alert item (always checked) */}
      <div className="px-3">
        <div className="flex items-start gap-2.5 py-2 px-2 rounded-lg bg-[#f0fdf4]">
          <div className="w-[18px] h-[18px] rounded-[5px] border-2 flex-shrink-0 mt-0.5 flex items-center justify-center bg-status-success border-status-success">
            <span className="text-white text-[11px] font-black">✓</span>
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-text-muted line-through">
              ระบบแจ้งเตือน — NEWS ≥ 5
            </div>
            <div className="text-[9px] text-text-muted mt-0.5">
              ✅ แจ้งเตือนอัตโนมัติ
            </div>
          </div>
        </div>
      </div>

      {checklist.map((phase) => (
        <PhaseSection key={phase.phase} phase={phase} />
      ))}

      {/* Assessment Schedule Table */}
      {assessmentSchedule && assessmentSchedule.entries.length > 0 && (
        <div className="px-3 mt-2">
          <div className="border border-border-default rounded-lg overflow-hidden bg-white">
            {/* Table header */}
            <div className="grid gap-1 px-2 py-1.5 text-[9px] font-bold text-brand-primary uppercase tracking-wider"
              style={{ gridTemplateColumns: '30px 1fr 46px 64px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
              <span>#</span>
              <span>เวลา</span>
              <span className="text-center">NEWS</span>
              <span className="text-center">สถานะ</span>
            </div>

            {/* Rows */}
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
                  className={`grid items-center gap-1 px-2 py-1.5 border-b border-[#f1f5f9] text-[10px] ${
                    isDone ? 'bg-[#f0fdf4]' : isDue ? 'animate-blink-row' : ''
                  }`}
                  style={{ gridTemplateColumns: '30px 1fr 46px 64px' }}
                >
                  <span className="text-[10px] text-text-muted font-bold">{entry.sequence}</span>
                  <span className="text-[10px] text-text-primary font-semibold">
                    {timeStr}
                    <span className="text-text-muted text-[9px] block">
                      {entry.intervalType}
                    </span>
                  </span>
                  <span className="text-center">
                    {entry.newsResult ? (
                      <span className={`font-extrabold text-[11px] ${
                        entry.newsResult.totalScore >= 7 ? 'text-status-error'
                        : entry.newsResult.totalScore >= 5 ? 'text-status-warning'
                        : 'text-status-success'
                      }`}>
                        {entry.newsResult.totalScore}
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </span>
                  <span className="text-center">
                    {isDone ? (
                      <span className="py-0.5 px-1.5 rounded-md text-[9px] font-bold text-status-success bg-[#f0fdf4] border border-[#86efac]">
                        ดูผล
                      </span>
                    ) : isDue ? (
                      <button
                        className="py-0.5 px-1.5 rounded-md text-[9px] font-bold text-white bg-status-error border-status-error animate-pulse-btn cursor-pointer"
                        onClick={() =>
                          useRTSASStore.getState().openModal('assessment_form', {
                            entryId: entry.id,
                            sequence: entry.sequence,
                          })
                        }
                      >
                        ⚡ บันทึก!
                      </button>
                    ) : (
                      <button
                        className="py-0.5 px-1.5 rounded-md text-[9px] font-bold cursor-pointer"
                        style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd' }}
                        onClick={() =>
                          useRTSASStore.getState().openModal('assessment_form', {
                            entryId: entry.id,
                            sequence: entry.sequence,
                          })
                        }
                      >
                        บันทึก
                      </button>
                    )}
                  </span>
                </div>
              );
            })}

            <div className="px-2 py-1.5 text-[9px] text-center font-semibold"
              style={{ background: '#eff6ff', borderTop: '1px solid #bfdbfe', color: '#0891b2' }}>
              ทุก 15 นาที (4 ครั้งแรก) → ทุก 30 นาที
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
