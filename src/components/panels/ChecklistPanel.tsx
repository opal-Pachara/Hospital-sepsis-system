import { useState, useEffect, useMemo } from 'react';

import { useRTSASStore, isHistoricalPatient } from '../../store/useRTSASStore';
import type { ChecklistPhase, ChecklistItem, VitalSigns, OxygenStatus, AVPU, TimelineEvent } from '../../types';
import { calculateNEWS } from '../../utils/newsCalculator';
import { showToast } from '../common/Toast';
import { maskHN } from '../../utils/hnMask';

// Thai labels for checklist items
const thaiLabels: Record<string, string> = {
  triage: 'ลงทะเบียนผู้ป่วย / Triage',
  nurse_reassess: 'พยาบาลประเมินซ้ำ',
  initial_report: 'รายงานแพทย์เวร',
  doctor_confirm: 'แพทย์เวรยืนยันติดเชื้อ',
  hemoculture: 'เจาะเลือดเพาะเชื้อ',
  iv_fluid: 'ให้สารน้ำทางหลอดเลือดดำ (IV Fluid)',
  antibiotics: 'ให้ยาปฏิชีวนะ (Antibiotics)',
  lactate: 'ส่ง Lactate Level',
};

const thaiPhaseLabels: Record<string, { icon: string; title: string }> = {
  initial_response: { icon: '📍', title: 'การประเมินเบื้องต้น' },
  doctor_confirmation: { icon: '🔬', title: 'แพทย์ยืนยัน — เริ่มนับ 60 นาที' },
  sepsis_bundle: { icon: '💊', title: 'SEPSIS BUNDLE — ดำเนินการภายใน 60 นาที' },
  assessment_schedule: { icon: '📋', title: 'ประเมินสัญญาณชีพซ้ำ' },
};

/**
 * Role-Based Access Guard for clinical procedures
 * Allows 'doctor' and 'nurse' only. Prompts auth modal if guest.
 */
function checkClinicalAuthOrPrompt(): boolean {
  const { isAuthenticated, currentUser, openModal } = useRTSASStore.getState();
  if (!isAuthenticated || !currentUser) {
    showToast('กรุณาเข้าสู่ระบบ (แพทย์หรือพยาบาล) เพื่อบันทึกการรักษา', 'warning');
    openModal('auth', { defaultMode: 'login' });
    return false;
  }
  if (currentUser.role === 'it_admin') {
    showToast('เจ้าหน้าที่ IT ไม่สามารถบันทึกการรักษาทางคลินิกได้ กรุณาใช้บัญชีแพทย์หรือพยาบาล', 'warning');
    return false;
  }
  return true;
}

function DoctorConfirmButton({ item, phaseUnlocked }: { item: ChecklistItem; phaseUnlocked: boolean }) {
  const { ruleOutSepsis, patientData, selectedPatient } = useRTSASStore();
  const [step, setStep] = useState<'idle' | 'choosing' | 'confirmYes' | 'confirmNo'>('idle');

  const isCompleted = item.status === 'completed';
  const currentData = selectedPatient ? patientData[selectedPatient.id] : null;
  const isRuledOut = (currentData?.sepsisRuledOut ?? false) || (selectedPatient?.treatmentStatus?.sepsis_ruled_out ?? false);
  const isHistorical = isHistoricalPatient(selectedPatient, patientData);
  const isReadOnly = isHistorical || (currentData?.treatmentCompleted ?? false) || isRuledOut;
  const canComplete = phaseUnlocked && !isCompleted && !isReadOnly;

  // ─── Already ruled out ───────────────────────────────────────
  if (isRuledOut) {
    return (
      <div style={{
        margin: '8px 12px', padding: '12px', borderRadius: '10px',
        background: '#f0fdf4', border: '2px solid #86efac',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🟢</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a' }}>
              ไม่ใช่ภาวะติดเชื้อในกระแสเลือด
            </div>
            <div style={{ fontSize: '10px', color: '#4ade80', marginTop: '2px' }}>
              แพทย์ Rule Out Sepsis — จบกระบวนการสำหรับผู้ป่วยรายนี้
            </div>
            <div style={{ fontSize: '9px', color: '#86efac', marginTop: '2px' }}>
              โดย {currentData?.ruledOutBy || 'แพทย์เวร ER'} · {currentData?.ruledOutAt
                ? new Date(currentData.ruledOutAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                : '--'} น.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Already confirmed ────────────────────────────────────────
  if (isCompleted && !isRuledOut) {
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
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
            <span>✅ แพทย์ยืนยัน {item.completedBy} เมื่อ {new Date(item.completedAt!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
            {!isReadOnly && !isRuledOut && (
              <button
                type="button"
                id="btn-rule-out-from-confirmed"
                onClick={() => {
                  if (!checkClinicalAuthOrPrompt()) return;
                  const curUser = useRTSASStore.getState().currentUser;
                  const actorName = curUser?.name || 'แพทย์เวร';
                  ruleOutSepsis(actorName);
                  showToast('จบกระบวนการ — แพทย์ Rule Out Sepsis', 'success', 5000);
                }}
                style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px',
                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                🟢 ไม่ยืนยัน (Rule Out)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Confirm YES flow ─────────────────────────────────────────
  if (step === 'confirmYes') {
    return (
      <div style={{ padding: '4px 12px', marginBottom: '4px' }}>
        <div style={{
          background: '#fefce8', border: '2px solid #fbbf24', borderRadius: '8px', padding: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '8px' }}>
            ⚠️ ยืนยันอีกครั้ง — แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด?
          </div>
          <div style={{ fontSize: '9px', color: '#78350f', marginBottom: '8px' }}>
            ระบบจะเริ่มนับถอยหลัง 60 นาที และสร้างตาราง Sepsis Bundle ทันที
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => {
                if (!checkClinicalAuthOrPrompt()) return;
                useRTSASStore.getState().openModal('sepsis_confirm');
                setStep('idle');
              }}
              style={{
                flex: 1, padding: '7px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ✅ ยืนยัน — เริ่มนับ 60 นาที
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              style={{
                padding: '7px 12px', borderRadius: '7px', fontSize: '10px',
                background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Confirm NO flow ──────────────────────────────────────────
  if (step === 'confirmNo') {
    return (
      <div style={{ padding: '4px 12px', marginBottom: '4px' }}>
        <div style={{
          background: '#f0fdf4', border: '2px solid #4ade80', borderRadius: '8px', padding: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#14532d', marginBottom: '8px' }}>
            🟢 ยืนยันอีกครั้ง — แพทย์ไม่ยืนยันภาวะติดเชื้อในกระแสเลือด?
          </div>
          <div style={{ fontSize: '9px', color: '#166534', marginBottom: '8px' }}>
            ระบบจะจบกระบวนการสำหรับผู้ป่วยรายนี้ และไม่เริ่ม Sepsis Bundle
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              id="btn-confirm-rule-out-action"
              onClick={() => {
                const curUser = useRTSASStore.getState().currentUser;
                const actorName = curUser?.name || 'แพทย์เวร';
                ruleOutSepsis(actorName);
                showToast('จบกระบวนการ — แพทย์ Rule Out Sepsis', 'success', 5000);
                setStep('idle');
              }}
              style={{
                flex: 1, padding: '7px', borderRadius: '7px', fontSize: '11px', fontWeight: 700,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              🟢 ยืนยัน — ไม่ใช่ภาวะติดเชื้อ
            </button>
            <button
              type="button"
              onClick={() => setStep('idle')}
              style={{
                padding: '7px 12px', borderRadius: '7px', fontSize: '10px',
                background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isReadOnly) {
    return (
      <div style={{ padding: '4px 12px', marginBottom: '4px' }}>
        <div style={{
          padding: '8px 12px', borderRadius: '8px', fontSize: '11px',
          background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span>🔒</span>
          <span>สิ้นสุดการประเมินตามประวัติเดิม (โหมดอ่านอย่างเดียว)</span>
        </div>
      </div>
    );
  }

  // ─── Default: Choose YES or NO ────────────────────────────────
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
        <span style={{ fontWeight: 700, color: '#2563eb' }}>แพทย์ตัดสินใจ</span> — ยืนยันหรือไม่ยืนยันภาวะติดเชื้อในกระแสเลือด
      </div>
      {!canComplete ? (
        <div style={{
          padding: '8px', borderRadius: '8px', fontSize: '10px', color: '#94a3b8',
          background: '#f1f5f9', border: '1px solid #e2e8f0', textAlign: 'center',
        }}>
          🔒 รอดำเนินการ Phase ก่อนหน้าให้ครบก่อน
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px' }}>
          {/* ✅ ยืนยันติดเชื้อ — Opens SepsisConfirmModal with clinical confirmation time */}
          <button
            type="button"
            id="doctor-confirm-yes-btn"
            onClick={() => {
              if (!checkClinicalAuthOrPrompt()) return;
              useRTSASStore.getState().openModal('sepsis_confirm');
            }}
            className="transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: 'white',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px -2px rgba(220,38,38,.35)',
            }}
          >
            🔴 ยืนยัน — ติดเชื้อ<br />
            <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.9 }}>เริ่มนับ 60 นาที</span>
          </button>

          {/* 🟢 ไม่ยืนยัน — Rule Out */}
          <button
            type="button"
            id="doctor-confirm-no-btn"
            onClick={() => {
              if (!checkClinicalAuthOrPrompt()) return;
              const curUser = useRTSASStore.getState().currentUser;
              const actorName = curUser?.name || 'แพทย์เวร';
              ruleOutSepsis(actorName);
              showToast('จบกระบวนการ — แพทย์ Rule Out Sepsis', 'success', 5000);
            }}
            className="transition-all hover:-translate-y-0.5 active:translate-y-0"
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 12px -2px rgba(34,197,94,.3)',
            }}
          >
            🟢 ไม่ยืนยัน — Rule Out<br />
            <span style={{ fontSize: '9px', fontWeight: 500, opacity: 0.9 }}>จบกระบวนการ</span>
          </button>
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({ item, phaseUnlocked }: { item: ChecklistItem; phaseUnlocked: boolean }) {
  const { completeChecklistItem, updateChecklistInput, skipChecklistItem, patientData, selectedPatient } = useRTSASStore();
  const [inputVal, setInputVal] = useState(item.inputValue ?? '');

  if (item.id === 'doctor_confirm') {
    return <DoctorConfirmButton item={item} phaseUnlocked={phaseUnlocked} />;
  }

  const currentData = selectedPatient ? patientData[selectedPatient.id] : null;
  const isGloballyCompleted = (currentData?.sepsisRuledOut ?? false) || (currentData?.treatmentCompleted ?? false);
  const isHistorical = isHistoricalPatient(selectedPatient, patientData);
  const isReadOnly = isHistorical || isGloballyCompleted;

  const isCompleted = item.status === 'completed';
  const isSkipped = item.status === 'skipped';
  const isDone = isCompleted || isSkipped;
  const canComplete = phaseUnlocked && !isDone && !isReadOnly;
  const label = thaiLabels[item.id] || item.label;

  const handleComplete = () => {
    if (!canComplete || isReadOnly) return;
    if (!checkClinicalAuthOrPrompt()) return;
    if (item.requiresInput && !inputVal.trim()) return;
    const curUser = useRTSASStore.getState().currentUser;
    const actor = curUser?.name || 'พยาบาลห้องฉุกเฉิน';
    completeChecklistItem(item.id, actor, item.requiresInput ? inputVal : undefined);
    if (isCompleted) return;
    showToast(`✓ ${label}`, 'success', 2000);
  };

  return (
    <div
      className={`flex items-start gap-2 transition-all ${isDone ? '' : canComplete ? 'hover:bg-[#eff6ff] cursor-pointer' : 'opacity-60'
        }`}
      style={{
        padding: '7px 8px',
        borderRadius: '8px',
        marginBottom: '3px',
        ...(isCompleted ? { background: '#f0fdf4' } : isSkipped ? { background: '#f8fafc' } : {}),
      }}
      onClick={!item.requiresInput && !isDone && canComplete ? handleComplete : undefined}
    >
      {/* Checkbox */}
      <div
        style={{
          width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
          border: isCompleted ? '2px solid #16a34a' : isSkipped ? '2px solid #94a3b8' : '2px solid #cbd5e1',
          background: isCompleted ? '#16a34a' : isSkipped ? '#94a3b8' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: '1px',
        }}
      >
        {isCompleted && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900 }}>✓</span>}
        {isSkipped && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 900 }}>—</span>}
      </div>

      <div className="flex-1 min-w-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700,
            color: isDone ? '#94a3b8' : '#1e293b',
            textDecoration: isDone ? 'line-through' : 'none',
          }}>
            {label}
          </span>
          {item.isOptional && !isDone && (
            <span style={{
              fontSize: '8px', fontWeight: 700, color: '#64748b',
              background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px',
              padding: '1px 5px', whiteSpace: 'nowrap',
            }}>
              ไม่บังคับ
            </span>
          )}
        </div>
        {item.subLabel && (
          <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>
            {item.subLabel}
          </div>
        )}

        {/* Input field */}
        {item.requiresInput && !isDone && canComplete && !isReadOnly && (
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
            {/* Skip button for optional items */}
            {item.isOptional && !isGloballyCompleted && !isReadOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!checkClinicalAuthOrPrompt()) return;
                  const curUser = useRTSASStore.getState().currentUser;
                  const actor = curUser?.name || 'พยาบาลห้องฉุกเฉิน';
                  skipChecklistItem(item.id, actor);
                  showToast(`ข้ามขั้นตอน: ${label}`, 'info', 2000);
                }}
                style={{
                  marginTop: '6px', padding: '4px 10px', fontSize: '9px', fontWeight: 600,
                  color: '#64748b', borderRadius: '6px', border: '1px dashed #cbd5e1',
                  background: '#f8fafc', cursor: 'pointer', fontFamily: 'inherit',
                  width: '100%', transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                ⏭ ข้ามขั้นตอนนี้ — ไม่มียาตัวที่ 2
              </button>
            )}
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
        ) : isSkipped ? (
          <div className="flex items-center gap-1" style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', marginTop: '2px' }}>
            ⏭ ข้ามเมื่อ {new Date(item.completedAt!).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
          </div>
        ) : isReadOnly ? (
          <div className="flex items-center gap-1" style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', marginTop: '2px' }}>
            — ไม่ได้ดำเนินการในรอบเวลานั้น
          </div>
        ) : canComplete ? (
          <div className="flex items-center gap-1" style={{ fontSize: '9px', fontWeight: 700, color: item.isOptional ? '#f59e0b' : '#dc2626', marginTop: '2px' }}>
            {item.isOptional ? (
              <>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                ไม่บังคับ — กรอกหรือข้ามได้
              </>
            ) : (
              <>
                <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                ยังไม่ดำเนินการ
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PhaseSection({ phase }: { phase: ChecklistPhase }) {
  const completedCount = phase.items.filter((i) => i.status === 'completed' || i.status === 'skipped').length;
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
          const isItemSequentialUnlocked = phase.isUnlocked && phase.items.slice(0, index).every(i => i.isOptional || i.status === 'completed' || i.status === 'skipped');
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

function AssessmentScheduleSection({
  phase,
}: {
  phase: ChecklistPhase;
}) {
  const { assessmentSchedule, patientData, selectedPatient, openModal, checklist, generateSchedule } = useRTSASStore();
  const currentData = selectedPatient ? patientData[selectedPatient.id] : null;
  const isGloballyCompleted = (currentData?.sepsisRuledOut ?? false) || (currentData?.treatmentCompleted ?? false);
  const isHistorical = isHistoricalPatient(selectedPatient, patientData);
  const isReadOnly = isHistorical || isGloballyCompleted;

  const entries = assessmentSchedule?.entries || [];
  const completedEntries = entries.filter((e) => e.isCompleted || e.isCanceled).length;
  const totalEntries = entries.length;

  // Auto-generate schedule if doctor confirmation is completed or timer has started, but entries are missing
  const doctorConfirmItem = checklist.flatMap((p) => p.items).find((i) => i.id === 'doctor_confirm');
  const isDoctorConfirmed = doctorConfirmItem?.status === 'completed';
  const confirmTime = doctorConfirmItem?.completedAt || currentData?.countdownTimer?.startedAt;

  useEffect(() => {
    if (isDoctorConfirmed && entries.length === 0 && confirmTime && !isGloballyCompleted && !isHistorical) {
      generateSchedule(confirmTime);
    }
  }, [isDoctorConfirmed, entries.length, confirmTime, isGloballyCompleted, isHistorical, generateSchedule]);


  return (
    <div
      id="assessment-schedule-section"
      className={`transition-opacity duration-200 ${!phase.isUnlocked ? 'opacity-80' : ''}`}
      style={{ marginBottom: '14px' }}
    >
      {/* Phase Header */}
      <div
        className="flex items-center gap-1.5"
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          padding: '5px 12px',
          marginBottom: '6px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <span>🔁</span>
        <span>ตารางประเมินสัญญาณชีพซ้ำ (Phase 4)</span>
        {totalEntries > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '9px',
              fontWeight: 700,
              background: '#eff6ff',
              color: '#2563eb',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid #bfdbfe',
            }}
          >
            {completedEntries}/{totalEntries} รอบ
          </span>
        )}
      </div>

      {/* Description / Subtitle */}
      <div style={{ padding: '0 12px', marginBottom: '8px' }}>
        <div style={{ fontSize: '9.5px', color: '#64748b', lineHeight: 1.5 }}>
          <strong>ทุก 15 นาที × 4 ครั้ง</strong> แล้ว<strong>ทุก 30 นาที</strong> จนจำหน่ายออกจากห้องฉุกเฉิน
          <span style={{ display: 'block', color: '#0891b2', fontSize: '9px', marginTop: '1px' }}>
            🔔 ระบบจะส่งสัญญาณเตือนและป๊อปอัปอัตโนมัติเมื่อถึงรอบเวลาประเมิน
          </span>
        </div>
      </div>

      {/* Table Box */}
      <div style={{ padding: '0 12px' }}>
        <div
          style={{
            border: '1px solid #dde3ed',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '34px 1fr 44px 126px',
              gap: '4px',
              padding: '6px 8px',
              background: '#eff6ff',
              borderBottom: '1px solid #bfdbfe',
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#2563eb',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ textAlign: 'center' }}>รอบ</span>
            <span style={{ textAlign: 'center' }}>เวลาเป้าหมาย</span>
            <span style={{ textAlign: 'center' }}>NEWS</span>
            <span style={{ textAlign: 'center' }}>สถานะ</span>
          </div>

          {/* Table Body */}
          {entries.length > 0 ? (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {(() => {
                const firstUncompletedSeq =
                  entries.find((e) => !e.isCompleted && !e.isCanceled)?.sequence ?? -1;
                const firstCanceledSeq = entries.find((e) => e.isCanceled)?.sequence ?? -1;

                return entries.map((entry) => {
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
                        display: 'grid',
                        gridTemplateColumns: '34px 1fr 44px 126px',
                        gap: '4px',
                        padding: '6px 8px',
                        borderBottom: '1px solid #f1f5f9',
                        alignItems: 'center',
                        fontSize: '10px',
                        ...(isDone
                          ? { background: '#f0fdf440' }
                          : isDue
                            ? { background: '#fef2f250' }
                            : {}),
                      }}
                    >
                      <span
                        style={{
                          fontSize: '9.5px',
                          color: '#64748b',
                          fontWeight: 700,
                          textAlign: 'center',
                        }}
                      >
                        {entry.sequence}
                      </span>
                      <span style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#1e293b' }}>
                          {timeStr} น.
                        </span>
                        <span style={{ fontSize: '8px', color: '#94a3b8', display: 'block' }}>
                          {entry.intervalType}
                        </span>
                      </span>
                      <span style={{ textAlign: 'center' }}>
                        {entry.newsResult ? (
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '10.5px',
                              color:
                                entry.newsResult.totalScore >= 7
                                  ? '#dc2626'
                                  : entry.newsResult.totalScore >= 5
                                    ? '#ea580c'
                                    : '#16a34a',
                            }}
                          >
                            {entry.newsResult.totalScore}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </span>
                      <span style={{ textAlign: 'center' }}>
                        {entry.isCanceled ? (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '8px',
                              fontWeight: 700,
                              background:
                                entry.sequence === firstCanceledSeq ? '#dcfce7' : '#f1f5f9',
                              color:
                                entry.sequence === firstCanceledSeq ? '#16a34a' : '#64748b',
                              border: `1px solid ${entry.sequence === firstCanceledSeq ? '#16a34a' : '#cbd5e1'
                                }`,
                            }}
                          >
                            {entry.sequence === firstCanceledSeq ? '✅ เสร็จตรงนี้' : '— ยกเลิก'}
                          </span>
                        ) : isDone ? (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '8px',
                              fontWeight: 700,
                              background: '#dcfce7',
                              color: '#16a34a',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            ✓ บันทึกแล้ว
                          </span>
                        ) : !phase.isUnlocked ? (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '8px',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#94a3b8',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            🔒 รอ Phase 3
                          </span>
                        ) : entry.sequence !== firstUncompletedSeq ? (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '8px',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#94a3b8',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            🔒 รอครั้งก่อนหน้า
                          </span>
                        ) : isReadOnly ? (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '8px',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#94a3b8',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            — ข้าม
                          </span>
                        ) : isDue && !isGloballyCompleted ? (
                          <div style={{ display: 'flex', gap: '3px', width: '100%' }}>
                            <button
                              type="button"
                              className="animate-pulse-btn"
                              onClick={() => {
                                if (!checkClinicalAuthOrPrompt()) return;
                                openModal('assessment_form', {
                                  entryId: entry.id,
                                  sequence: entry.sequence,
                                });
                              }}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '8px',
                                fontWeight: 700,
                                color: '#fff',
                                background: '#dc2626',
                                border: '1px solid #b91c1c',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                width: '100%',
                              }}
                            >
                              ⚡ บันทึกด่วน
                            </button>

                          </div>
                        ) : !isGloballyCompleted ? (
                          <div style={{ display: 'flex', gap: '3px', width: '100%' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!checkClinicalAuthOrPrompt()) return;
                                openModal('assessment_form', {
                                  entryId: entry.id,
                                  sequence: entry.sequence,
                                });
                              }}
                              style={{
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '8px',
                                fontWeight: 700,
                                color: '#2563eb',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                width: '100%',
                              }}
                            >
                              บันทึก
                            </button>

                          </div>
                        ) : (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '8px',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#94a3b8',
                              border: '1px solid #cbd5e1',
                            }}
                          >
                            — ข้าม
                          </span>
                        )}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div style={{ padding: '16px 12px', textAlign: 'center', background: '#f8fafc' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>⏱️</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                รอแพทย์ยืนยันภาวะ Sepsis ทางคลินิกเพื่อสร้างตาราง
              </div>
              <div
                style={{
                  fontSize: '9.5px',
                  color: '#64748b',
                  marginTop: '2px',
                  maxWidth: '320px',
                  margin: '2px auto 8px',
                }}
              >
                เมื่อยืนยันแล้ว ระบบจะเริ่มนับเวลาและสร้างรอบประเมิน Q15 (4 ครั้งแรก) และ Q30 โดยอัตโนมัติ
              </div>

              {/* Preview Planned Rows (Placeholder so clinicians see the table structure) */}
              <div
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  background: '#fff',
                  opacity: 0.7,
                  marginTop: '8px',
                  fontSize: '9.5px',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px 1fr 44px 126px',
                    gap: '4px',
                    padding: '5px 8px',
                    borderBottom: '1px dashed #e2e8f0',
                    color: '#64748b',
                  }}
                >
                  <span style={{ textAlign: 'center', fontWeight: 700 }}>1</span>
                  <span style={{ textAlign: 'center' }}>+15 นาที (Q15 ครั้งที่ 1)</span>
                  <span style={{ textAlign: 'center' }}>—</span>
                  <span style={{ textAlign: 'center', color: '#94a3b8' }}>รอเริ่มตาราง</span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px 1fr 44px 126px',
                    gap: '4px',
                    padding: '5px 8px',
                    color: '#64748b',
                  }}
                >
                  <span style={{ textAlign: 'center', fontWeight: 700 }}>2</span>
                  <span style={{ textAlign: 'center' }}>+30 นาที (Q15 ครั้งที่ 2)</span>
                  <span style={{ textAlign: 'center' }}>—</span>
                  <span style={{ textAlign: 'center', color: '#94a3b8' }}>รอเริ่มตาราง</span>
                </div>
              </div>
            </div>
          )}

          {/* Table Footer */}
          <div
            style={{
              padding: '6px 8px',
              background: '#eff6ff',
              borderTop: '1px solid #bfdbfe',
              fontSize: '9px',
              color: '#0891b2',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {entries.length > 0
              ? 'ทุก 15 นาที (4 ครั้งแรก) → หลังจากนั้นทุก 30 นาที'
              : 'ตารางจะเริ่มนับเวลาทันทีเมื่อแพทย์ยืนยัน Sepsis ทางคลินิก'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChecklistPanel() {
  const {
    checklist,
    patientData,
    selectedPatient,
  } = useRTSASStore();

  // Check if patient is globally completed or historical
  const currentData = selectedPatient ? patientData[selectedPatient.id] : null;
  const isGloballyCompleted = (currentData?.sepsisRuledOut ?? false) || (currentData?.treatmentCompleted ?? false);
  const isHistorical = isHistoricalPatient(selectedPatient, patientData);

  // Calculate overall progress
  const allItems = checklist.flatMap((p) => p.items);
  const completedTotal = allItems.filter((i) => i.status === 'completed' || i.status === 'skipped').length;
  const totalItems = allItems.length;
  const pct = totalItems > 0 ? Math.round((completedTotal / totalItems) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: '40px' }}>
      {/* Historical Read-Only Banner */}
      {isHistorical && (
        <div
          id="checklist-readonly-banner"
          style={{
            margin: '10px 12px 6px',
            padding: '10px 14px',
            background: '#fefce8',
            border: '1.5px solid #fde047',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '18px' }}>🔒</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: '#854d0e' }}>
              แฟ้มประวัติการรักษาย้อนหลัง — โหมดอ่านอย่างเดียว (Read-Only)
            </div>
            <div style={{ fontSize: '10px', color: '#a16207', marginTop: '2px' }}>
              ข้อมูลเวชระเบียนเดิมถูกล็อค ไม่อนุญาตให้แก้ไขหรือกดบันทึกเพิ่มเติม เพื่อรักษาความถูกต้องของเวลาตามกฎหมาย (Audit Trail)
            </div>
          </div>
        </div>
      )}

      {/* Completed Status Banner */}
      {currentData?.treatmentCompleted && (
        <div style={{
          margin: '10px 12px 6px',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
          border: '1.5px solid #6ee7b7',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#10b981', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 900, flexShrink: 0,
          }}>✓</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#065f46' }}>
              การรักษา Sepsis เสร็จสิ้นครบถ้วนแล้ว
            </div>
            <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>
              {currentData.treatmentCompletedAt
                ? `บันทึกเวลาเสร็จสิ้น: ${new Date(currentData.treatmentCompletedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
                : 'ผู้ป่วยได้รับการดูแลครบตามมาตรฐาน'}
            </div>
          </div>
        </div>
      )}

      {currentData?.sepsisRuledOut && (
        <div style={{
          margin: '10px 12px 6px',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '1.5px solid #86efac',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#22c55e', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: 900, flexShrink: 0,
          }}>✕</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>
              แพทย์ยืนยัน Ruled Out Sepsis แล้ว
            </div>
            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
              ผู้ป่วยไม่ได้มีภาวะติดเชื้อในกระแสเลือด — สิ้นสุดกระบวนการ
            </div>
          </div>
        </div>
      )}

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

      {checklist.map((phase) => {
        if (phase.phase === 'assessment_schedule') {
          return (
            <AssessmentScheduleSection
              key={phase.phase}
              phase={phase}
            />
          );
        }
        return <PhaseSection key={phase.phase} phase={phase} />;
      })}
    </div>
  );
}
