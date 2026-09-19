/**
 * AdminPage.tsx
 *
 * IT Admin Dashboard — accessible only when logged in as it_admin.
 * Sections:
 *   1. System Status (HOSxP DB + Auth DB + Cache stats)
 *   2. User Management (list users, deactivate, add new user)
 *   3. System Tools (clear patient memory, reset dashboard, export system log)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRTSASStore, type PatientMemoryAudit } from '../store/useRTSASStore';
import { maskHN } from '../utils/hnMask';
import { showToast } from '../components/common/Toast';
import { extractErrorMessage } from '../utils/errorUtils';
import SystemLogsModal from '../components/modals/SystemLogsModal';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRecord {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: 'doctor' | 'nurse' | 'it_admin';
  is_active: boolean;
  created_at: string;
}

interface CacheStats {
  last_seen_vitals_count: number;
  patients_cache_count: number;
  last_clear_date: string | null;
}

interface DBStatus {
  status: string;
  pool_available: boolean;
  latency_ms?: number | null;
  host?: string;
  port?: number;
  database?: string;
}

interface SystemLogItem {
  id: string | number;
  timestamp: string;
  level: string;
  message: string;
  component?: string;
  details?: any;
}

// ---------------------------------------------------------------------------
// Role labels
// ---------------------------------------------------------------------------

const roleBadge = (role: string) => {
  if (role === 'doctor') return { label: '🩺 แพทย์', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' };
  if (role === 'nurse') return { label: '💉 พยาบาล', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
  return { label: '💻 IT Admin', bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' };
};

// ---------------------------------------------------------------------------
// Confirm Clear Cache Dialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
  audit: PatientMemoryAudit;
}

function ConfirmClearDialog({ onConfirm, onCancel, isLoading, audit }: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div style={{
        width: '440px', background: '#fff', borderRadius: '20px',
        overflow: 'hidden', boxShadow: '0 25px 60px rgba(234,88,12,.25)',
      }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg,#ea580c,#f59e0b,#16a34a)' }} />
        <div style={{ padding: '22px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg,#ea580c,#c2410c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(234,88,12,.35)',
          }}>🛡️</div>
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e293b', textAlign: 'center', marginBottom: '8px' }}>
            ยืนยันการล้าง Memory ข้อมูลผู้ป่วย?
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', lineHeight: 1.5, marginBottom: '16px' }}>
            ระบบจะล้างข้อมูลผู้ป่วยที่ไม่ได้รักษาออกจากหน่วยความจำ เพื่อคืนพื้นที่ RAM และป้องกัน Memory Leak
          </div>

          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px',
            padding: '12px 14px', marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#15803d', marginBottom: '6px' }}>
              <span>🛡️ ปกป้องข้อมูลผู้ป่วยที่กำลังรักษา ({audit.activeTreatedCount} ราย)</span>
            </div>
            <div style={{ fontSize: '11px', color: '#166534', lineHeight: 1.5 }}>
              ผู้ป่วยที่กำลังเดินเวลานับถอยหลัง Sepsis Bundle หรือมีรอบตรวจสัญญาณชีพซ้ำที่ยังไม่เสร็จสิ้น <strong>จะได้รับการคุ้มครองไว้ ไม่ถูกลบเด็ดขาด</strong>
            </div>
            {audit.retainedPatients.length > 0 ? (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '110px', overflowY: 'auto' }}>
                {audit.retainedPatients.map((p) => (
                  <div key={p.id} style={{
                    fontSize: '11px', background: '#ffffff', padding: '5px 8px', borderRadius: '6px',
                    border: '1px solid #dcfce7', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 700, color: '#1e293b' }}>HN {maskHN(p.hn)}</span>
                    <span style={{ fontSize: '10px', color: '#15803d' }}>{p.reasons.join(' · ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                ปัจจุบันไม่มีผู้ป่วยที่อยู่ระหว่างกระบวนการจับเวลาหรือรอประเมินผล
              </div>
            )}
          </div>

          <div style={{
            background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px',
            padding: '10px 14px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', color: '#9a3412', fontWeight: 600 }}>
              🗑️ ผู้ป่วยที่จะถูกล้างออกจากหน่วยความจำ:
            </span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#c2410c' }}>
              {audit.inactiveCount} ราย
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onConfirm}
              disabled={isLoading || (audit.inactiveCount === 0 && (!audit.totalPatientsInMemory))}
              style={{
                flex: 2, padding: '13px', borderRadius: '12px',
                fontSize: '13px', fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', color: '#fff', border: 'none',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg,#ea580c,#c2410c)',
                boxShadow: isLoading ? 'none' : '0 6px 20px rgba(234,88,12,.35)',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? '⏳ กำลังล้าง...' : `🗑️ ยืนยัน ล้าง ${audit.inactiveCount} ราย`}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              style={{
                flex: 1, padding: '13px', borderRadius: '12px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', color: '#64748b',
                border: '1px solid #e2e8f0', background: '#f8fafc',
                transition: 'all 0.2s',
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Reset Dashboard Dialog
// ---------------------------------------------------------------------------

function ConfirmResetDialog({ onConfirm, onCancel, isLoading }: { onConfirm: () => void; onCancel: () => void; isLoading: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div style={{
        width: '420px', background: '#fff', borderRadius: '20px',
        overflow: 'hidden', boxShadow: '0 25px 60px rgba(220,38,38,.25)',
      }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg,#dc2626,#ef4444)' }} />
        <div style={{ padding: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(220,38,38,.35)',
          }}>⚠️</div>
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e293b', textAlign: 'center', marginBottom: '8px' }}>
            ยืนยัน Reset Dashboard?
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: '20px' }}>
            การ Reset จะล้าง <strong>ข้อมูลการรักษาทั้งหมด</strong> ออกจากทั้ง Backend และ Frontend<br />
            รวมถึง Checklist, Timeline, Timer, Cache ทั้งหมด<br />
            <span style={{ color: '#dc2626', fontWeight: 700 }}>ไม่สามารถกู้คืนได้!</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              style={{
                flex: 2, padding: '13px', borderRadius: '12px',
                fontSize: '13px', fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', color: '#fff', border: 'none',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? '⏳ กำลัง Reset...' : '🗑️ ยืนยัน Reset ทั้งหมด'}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              style={{
                flex: 1, padding: '13px', borderRadius: '12px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', color: '#64748b',
                border: '1px solid #e2e8f0', background: '#f8fafc',
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reset Password Modal
// ---------------------------------------------------------------------------

interface ResetPasswordModalProps {
  user: UserRecord | null;
  onClose: () => void;
  onSuccess: () => void;
  authHeaders: Record<string, string>;
}

function ResetPasswordModal({ user, onClose, onSuccess, authHeaders }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%&*';
    result += upper.charAt(Math.floor(Math.random() * upper.length));
    result += lower.charAt(Math.floor(Math.random() * lower.length));
    result += digits.charAt(Math.floor(Math.random() * digits.length));
    result += specials.charAt(Math.floor(Math.random() * specials.length));
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(result);
  };

  const handleCopy = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ password: newPassword }),
      });

      if (res.ok) {
        showToast(`✅ รีเซ็ตรหัสผ่าน @${user.username} สำเร็จ`, 'success');
        onSuccess();
        onClose();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(extractErrorMessage(err.detail, 'ไม่สามารถรีเซ็ตรหัสผ่านได้'), 'error');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const badge = roleBadge(user.role);

  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center"
      style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}
    >
      <div style={{
        width: '460px', maxWidth: '92vw', background: '#fff', borderRadius: '20px',
        overflow: 'hidden', boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg,#2563eb,#06b6d4)' }} />
        <div style={{ padding: '24px' }}>
          {/* Title & Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
            }}>🔑</div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e293b' }}>
                รีเซ็ตรหัสผ่านผู้ใช้งาน
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                กำหนดรหัสผ่านใหม่สำหรับกรณีผู้ใช้ลืมรหัสผ่าน
              </div>
            </div>
          </div>

          {/* User Info Card */}
          <div style={{
            background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0',
            padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                {user.firstname} {user.lastname}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                @{user.username}
              </div>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '3px 8px',
              borderRadius: '8px', background: badge.bg,
              color: badge.color, border: `1px solid ${badge.border}`,
            }}>
              {badge.label}
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  รหัสผ่านใหม่ * (≥6 ตัวอักษร)
                </label>
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  style={{
                    background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                    borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  🎲 สุ่มรหัสผ่าน
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกหรือกดสุ่มรหัสผ่านใหม่..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 75px 10px 12px',
                    borderRadius: '10px', border: '1px solid #cbd5e1',
                    fontSize: '13px', fontFamily: 'monospace',
                    boxSizing: 'border-box', outline: 'none',
                  }}
                  autoFocus
                />
                <div style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '4px' }}>
                  {newPassword && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      title="คัดลอกรหัสผ่าน"
                      style={{
                        background: copied ? '#16a34a' : '#f1f5f9', color: copied ? '#fff' : '#475569',
                        border: 'none', borderRadius: '6px', padding: '4px 6px',
                        fontSize: '11px', cursor: 'pointer',
                      }}
                    >
                      {copied ? '✓' : '📋'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    style={{
                      background: '#f1f5f9', color: '#475569',
                      border: 'none', borderRadius: '6px', padding: '4px 6px',
                      fontSize: '11px', cursor: 'pointer',
                    }}
                  >
                    {showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="submit"
                disabled={isLoading || newPassword.length < 6}
                style={{
                  flex: 2, padding: '12px', borderRadius: '12px',
                  fontSize: '13px', fontWeight: 800,
                  cursor: isLoading || newPassword.length < 6 ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', color: '#fff', border: 'none',
                  background: isLoading || newPassword.length < 6 ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  boxShadow: isLoading || newPassword.length < 6 ? 'none' : '0 4px 14px rgba(37,99,235,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {isLoading ? '⏳ กำลังบันทึก...' : '✅ บันทึกรหัสผ่านใหม่'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', color: '#64748b',
                  border: '1px solid #e2e8f0', background: '#f8fafc',
                }}
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete User Dialog
// ---------------------------------------------------------------------------

interface DeleteUserDialogProps {
  user: UserRecord | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

function DeleteUserDialog({ user, onClose, onConfirm, isLoading }: DeleteUserDialogProps) {
  if (!user) return null;
  const badge = roleBadge(user.role);

  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onClose(); }}
    >
      <div style={{
        width: '440px', maxWidth: '92vw', background: '#fff', borderRadius: '20px',
        overflow: 'hidden', boxShadow: '0 25px 60px rgba(220,38,38,.25)',
      }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg,#dc2626,#b91c1c)' }} />
        <div style={{ padding: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(220,38,38,.35)',
          }}>🗑️</div>
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e293b', textAlign: 'center', marginBottom: '8px' }}>
            ยืนยันการลบผู้ใช้งาน?
          </div>
          <div style={{
            background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca',
            padding: '12px 16px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#991b1b' }}>
                {user.firstname} {user.lastname}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                borderRadius: '8px', background: badge.bg,
                color: badge.color, border: `1px solid ${badge.border}`,
              }}>
                {badge.label}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#b91c1c', fontFamily: 'monospace' }}>
              Username: @{user.username}
            </div>
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: '20px' }}>
            การกระทำนี้จะลบบัญชีผู้ใช้นี้ออกจากฐานข้อมูลระบบอย่างถาวร<br />
            <span style={{ color: '#dc2626', fontWeight: 700 }}>ไม่สามารถกู้คืนข้อมูลบัญชีนี้ได้อีกต่อไป!</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              style={{
                flex: 2, padding: '13px', borderRadius: '12px',
                fontSize: '13px', fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', color: '#fff', border: 'none',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                boxShadow: isLoading ? 'none' : '0 4px 14px rgba(220,38,38,.3)',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? '⏳ กำลังลบผู้ใช้...' : '🗑️ ยืนยันลบผู้ใช้งาน'}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              style={{
                flex: 1, padding: '13px', borderRadius: '12px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', color: '#64748b',
                border: '1px solid #e2e8f0', background: '#f8fafc',
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Clear Logs Dialog
// ---------------------------------------------------------------------------

function ConfirmClearLogsDialog({ onConfirm, onCancel, isLoading }: { onConfirm: () => void; onCancel: () => void; isLoading: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div style={{
        width: '420px', background: '#fff', borderRadius: '20px',
        overflow: 'hidden', boxShadow: '0 25px 60px rgba(220,38,38,.25)',
      }}>
        <div style={{ height: '4px', background: 'linear-gradient(90deg,#ea580c,#dc2626)' }} />
        <div style={{ padding: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg,#ea580c,#c2410c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(234,88,12,.35)',
          }}>🗑️</div>
          <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e293b', textAlign: 'center', marginBottom: '8px' }}>
            ยืนยันการล้าง System Logs ทั้งหมด?
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: '20px' }}>
            ระบบจะล้างบันทึกเหตุการณ์และการทำงานของระบบ (Diagnostic Logs) ทั้งหมด<br />
            รวมถึงประวัติการเชื่อมต่อและข้อผิดพลาดที่ผ่านมา<br />
            <span style={{ color: '#dc2626', fontWeight: 700 }}>ข้อมูลบันทึกเก่าจะไม่สามารถกู้คืนได้!</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              id="btn-confirm-clear-logs"
              onClick={onConfirm}
              disabled={isLoading}
              style={{
                flex: 2, padding: '13px', borderRadius: '12px',
                fontSize: '13px', fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', color: '#fff', border: 'none',
                background: isLoading ? '#94a3b8' : 'linear-gradient(135deg,#ea580c,#dc2626)',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? '⏳ กำลังล้าง Logs...' : '🗑️ ยืนยัน ล้าง Logs'}
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              style={{
                flex: 1, padding: '13px', borderRadius: '12px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', color: '#64748b',
                border: '1px solid #e2e8f0', background: '#f8fafc',
              }}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatJsonSyntax(jsonStr: string) {
  return jsonStr.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let color = '#cbd5e1';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          color = '#38bdf8'; // Key: bright sky blue
        } else {
          color = '#86efac'; // String: soft emerald green
        }
      } else if (/true|false/.test(match)) {
        color = '#c084fc'; // Boolean: purple
      } else if (/null/.test(match)) {
        color = '#f87171'; // Null: red
      } else {
        color = '#facc15'; // Number: warm yellow
      }
      return `<span style="color: ${color};">${match}</span>`;
    }
  );
}

interface LogDetailModalProps {
  log: SystemLogItem | null;
  onClose: () => void;
}

function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const [copied, setCopied] = useState(false);
  if (!log) return null;

  const jsonStr = JSON.stringify(log.details || {}, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isErr = log.level.toUpperCase() === 'ERROR';
  const isWarn = log.level.toUpperCase().includes('WARN');

  return (
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center"
      style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '700px', maxWidth: '92vw', maxHeight: '85vh',
        background: '#ffffff', borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📜</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b' }}>
                รายละเอียด Log #{log.id}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {log.timestamp} · โมดูล: <strong style={{ color: '#0284c7' }}>{log.component || 'System'}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
              background: isErr ? '#fee2e2' : isWarn ? '#fef3c7' : '#dbeafe',
              color: isErr ? '#b91c1c' : isWarn ? '#b45309' : '#1d4ed8',
              border: isErr ? '1px solid #fecaca' : isWarn ? '1px solid #fde68a' : '1px solid #bfdbfe',
            }}>
              {log.level}
            </span>
            <button
              onClick={onClose}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: '18px', color: '#94a3b8', padding: '4px 8px', borderRadius: '6px',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {/* Message */}
          <div style={{
            background: isErr ? '#fef2f2' : '#f8fafc', border: `1px solid ${isErr ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: '10px', padding: '12px 14px', marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
              ข้อความแจ้งเตือน (Log Message)
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: isErr ? '#991b1b' : '#1e293b', lineHeight: 1.5 }}>
              {log.message}
            </div>
          </div>

          {/* JSON Details */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{'{ }'}</span>
                <span>ข้อมูลโครงสร้าง JSON (details_json)</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: copied ? '#16a34a' : '#0284c7',
                  color: '#fff', border: 'none', borderRadius: '6px',
                  padding: '4px 10px', fontSize: '11px', fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  transition: 'all 0.15s',
                }}
              >
                <span>{copied ? '✓' : '📋'}</span>
                <span>{copied ? 'คัดลอกเรียบร้อย!' : 'คัดลอก JSON'}</span>
              </button>
            </div>

            <pre
              style={{
                margin: 0, padding: '12px 16px', background: '#0f172a',
                borderRadius: '10px', fontSize: '11px', lineHeight: 1.6,
                fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                overflowX: 'auto', maxHeight: '350px',
              }}
              dangerouslySetInnerHTML={{ __html: formatJsonSyntax(jsonStr) }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
              background: '#e2e8f0', color: '#334155', border: 'none', cursor: 'pointer',
            }}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AdminPage
// ---------------------------------------------------------------------------

interface AdminPageProps {
  onBack?: () => void;
}

const EMPTY_REGISTER = { firstname: '', lastname: '', username: '', password: '', role: 'nurse' as const };

export default function AdminPage({ onBack }: AdminPageProps) {
  const { currentUser, isAuthenticated, logoutUser, getPatientMemoryAudit, clearInactivePatientsMemory, clearTreatedPatients } = useRTSASStore();
  const memoryAudit = getPatientMemoryAudit();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmClearLogs, setShowConfirmClearLogs] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isResettingDashboard, setIsResettingDashboard] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRecord | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserRecord | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [activeSection, setActiveSection] = useState<'status' | 'users' | 'tools'>('status');

  // Logs controls & filters
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'Warning' | 'Note'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(true);
  const [lastLogsRefreshedAt, setLastLogsRefreshedAt] = useState<Date>(new Date());
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string | number>>(new Set());
  const [selectedLogForModal, setSelectedLogForModal] = useState<SystemLogItem | null>(null);
  const [showSystemLogsModal, setShowSystemLogsModal] = useState(false);

  const toggleExpandLog = (id: string | number) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Register form state
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER);
  const [isRegistering, setIsRegistering] = useState(false);

  const token = localStorage.getItem('rtsas_token');
  const authHeaders: Record<string, string> = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  // Load users
  const loadUsers = useCallback(async () => {
    if (!token) return;
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE}/auth/users`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        showToast('ไม่สามารถดึงรายชื่อ users ได้', 'error');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [token, authHeaders]);

  // Load cache stats
  const loadCacheStats = useCallback(async () => {
    setIsLoadingCache(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/cache-stats`);
      if (res.ok) setCacheStats(await res.json());
    } catch { /* offline */ } finally {
      setIsLoadingCache(false);
    }
  }, []);

  // Load DB status
  const loadDBStatus = useCallback(async () => {
    setIsLoadingDB(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/db-status`);
      if (res.ok) setDbStatus(await res.json());
    } catch { /* offline */ } finally {
      setIsLoadingDB(false);
    }
  }, []);

  // Load Logs
  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE}/api/system/logs?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLastLogsRefreshedAt(new Date());
      }
    } catch {
      /* offline */
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  // Clear Logs
  const handleClearLogs = async () => {
    setIsClearingLogs(true);
    try {
      const res = await fetch(`${API_BASE}/api/system/logs/clear`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(`✅ ล้าง System Logs สำเร็จ (${data.cleared_count ?? 0} รายการ)`, 'success');
        await loadLogs();
      } else {
        showToast('ไม่สามารถล้าง Logs ได้', 'error');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setIsClearingLogs(false);
      setShowConfirmClearLogs(false);
    }
  };

  // Logout
  const handleLogout = () => {
    logoutUser();
    showToast('ออกจากระบบเรียบร้อย', 'info');
    onBack?.();
  };

  // Auto-refresh logs
  useEffect(() => {
    loadLogs();
    if (!logsAutoRefresh) return;
    const interval = setInterval(() => {
      loadLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [loadLogs, logsAutoRefresh]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logFilter !== 'ALL') {
        const lvl = l.level.toUpperCase();
        if (logFilter === 'ERROR' && lvl !== 'ERROR') return false;
        if (logFilter === 'Warning' && !lvl.includes('WARN')) return false;
        if (logFilter === 'Note' && (lvl !== 'NOTE' && lvl !== 'INFO')) return false;
      }
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const matchMsg = (l.message || '').toLowerCase().includes(q);
        const matchComp = (l.component || '').toLowerCase().includes(q);
        return matchMsg || matchComp;
      }
      return true;
    });
  }, [logs, logFilter, logSearchQuery]);

  useEffect(() => {
    let active = true;

    if (token) {
      fetch(`${API_BASE}/auth/users`, { headers: authHeaders })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (active && data) setUsers(data);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setIsLoadingUsers(false);
        });
    }

    fetch(`${API_BASE}/api/admin/cache-stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setCacheStats(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingCache(false);
      });

    fetch(`${API_BASE}/api/admin/db-status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setDbStatus(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingDB(false);
      });

    return () => {
      active = false;
    };
  }, [token, authHeaders]);

  // Delete user
  const handleDeleteUser = async () => {
    if (!token || !deleteTargetUser) return;
    setIsDeletingUser(true);
    try {
      const res = await fetch(`${API_BASE}/auth/users/${deleteTargetUser.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        showToast(`✅ ลบบัญชี @${deleteTargetUser.username} สำเร็จ`, 'success');
        setDeleteTargetUser(null);
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(extractErrorMessage(err.detail, 'ไม่สามารถลบผู้ใช้งานได้'), 'error');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setIsDeletingUser(false);
    }
  };

  // Register new user
  const handleRegister = async () => {
    if (!registerForm.firstname.trim() || !registerForm.lastname.trim()) {
      showToast('กรุณากรอกชื่อและนามสกุล', 'error'); return;
    }
    if (registerForm.username.trim().length < 4) {
      showToast('Username ต้องมีอย่างน้อย 4 ตัวอักษร', 'error'); return;
    }
    if (registerForm.password.length < 6) {
      showToast('Password ต้องมีอย่างน้อย 6 ตัวอักษร', 'error'); return;
    }
    setIsRegistering(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(registerForm),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`✅ เพิ่มผู้ใช้ @${registerForm.username} สำเร็จ`, 'success');
        setRegisterForm(EMPTY_REGISTER);
        setShowRegisterForm(false);
        loadUsers();
      } else {
        const msg = typeof data.detail === 'string'
          ? data.detail
          : Array.isArray(data.detail)
            ? data.detail.map((e: { msg?: string }) => e.msg).join(', ')
            : 'ไม่สามารถเพิ่มผู้ใช้ได้';
        showToast(msg, 'error');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // Clear memory & cache safely
  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const clientResult = clearInactivePatientsMemory();
      const preserveHns = clientResult.retainedPatients.map((p) => p.hn);

      const res = await fetch(`${API_BASE}/api/admin/clear-cache`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preserve_hns: preserveHns }),
      });

      if (res.ok) {
        showToast(
          `✅ ล้าง Memory สำเร็จ! เคลียร์ ${clientResult.clearedCount} ราย · ปกป้องผู้ป่วยที่กำลังรักษาไว้ ${clientResult.retainedCount} ราย`,
          'success'
        );
        loadCacheStats();
      } else {
        showToast(
          `ล้างข้อมูลฝั่ง Client เรียบร้อย (${clientResult.clearedCount} ราย) แต่ Backend ตอบกลับไม่สมบูรณ์`,
          'warning'
        );
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setIsClearingCache(false);
      setShowConfirmClear(false);
    }
  };

  // Reset dashboard (full)
  const handleResetDashboard = async () => {
    setIsResettingDashboard(true);
    try {
      // 1. Backend reset
      const res = await fetch(`${API_BASE}/api/admin/reset-dashboard`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // 2. Frontend store reset
        clearTreatedPatients();
        clearInactivePatientsMemory();
        showToast(`✅ Reset Dashboard สำเร็จ! ล้างข้อมูลการรักษา ${data.cleared_count ?? 0} ราย`, 'success');
        loadCacheStats();
      } else {
        showToast('Backend Reset ล้มเหลว — ลองใหม่อีกครั้ง', 'error');
      }
    } catch {
      // Even if backend fails, clear frontend
      clearTreatedPatients();
      showToast('ล้างข้อมูล Frontend เรียบร้อย (Backend ไม่ตอบสนอง)', 'warning');
    } finally {
      setIsResettingDashboard(false);
      setShowConfirmReset(false);
    }
  };

  // Guard: only it_admin
  if (!isAuthenticated || currentUser?.role !== 'it_admin') {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '16px',
        background: '#f8fafc', fontFamily: 'inherit',
      }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>ต้องเข้าสู่ระบบในฐานะ IT Admin เท่านั้น</div>
        <div style={{ fontSize: '13px', color: '#64748b' }}>กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่ IT เพื่อเข้าถึงศูนย์ควบคุมนี้</div>
        <button onClick={handleLogout} style={{
          padding: '10px 24px', borderRadius: '10px', fontSize: '13px',
          fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          border: 'none', background: '#dc2626', color: '#fff',
          boxShadow: '0 4px 14px rgba(220,38,38,.25)',
        }}>🚪 ออกจากระบบ / เข้าสู่ระบบใหม่</button>
      </div>
    );
  }

  const nav = [
    { id: 'status', icon: '📡', label: 'สถานะระบบ' },
    { id: 'users', icon: '👥', label: 'จัดการผู้ใช้' }
  ] as const;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: 'inherit' }}>
      {/* Dialogs */}
      {showConfirmClear && (
        <ConfirmClearDialog
          onConfirm={handleClearCache}
          onCancel={() => setShowConfirmClear(false)}
          isLoading={isClearingCache}
          audit={memoryAudit}
        />
      )}
      {showConfirmReset && (
        <ConfirmResetDialog
          onConfirm={handleResetDashboard}
          onCancel={() => setShowConfirmReset(false)}
          isLoading={isResettingDashboard}
        />
      )}
      {showConfirmClearLogs && (
        <ConfirmClearLogsDialog
          onConfirm={handleClearLogs}
          onCancel={() => setShowConfirmClearLogs(false)}
          isLoading={isClearingLogs}
        />
      )}
      {showSystemLogsModal && (
        <SystemLogsModal
          isOpen={showSystemLogsModal}
          onClose={() => setShowSystemLogsModal(false)}
        />
      )}
      {selectedLogForModal && (
        <LogDetailModal
          log={selectedLogForModal}
          onClose={() => setSelectedLogForModal(null)}
        />
      )}
      {resetPasswordUser && (
        <ResetPasswordModal
          user={resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          onSuccess={loadUsers}
          authHeaders={authHeaders}
        />
      )}
      {deleteTargetUser && (
        <DeleteUserDialog
          user={deleteTargetUser}
          onClose={() => setDeleteTargetUser(null)}
          onConfirm={handleDeleteUser}
          isLoading={isDeletingUser}
        />
      )}

      {/* ─── Top Bar ─── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: '16px',
        flexShrink: 0, position: 'relative', overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6d28d9, #2563eb, #0891b2)' }} />

        <button
          id="btn-admin-logout"
          onClick={handleLogout}
          style={{
            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
            marginTop: '3px',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
          title="ออกจากระบบ"
        >
          <span>🚪</span>
          <span>ออกจากระบบ</span>
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6d28d9, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            boxShadow: '0 4px 14px rgba(109,40,217,.25)',
          }}>💻</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#1e293b' }}>IT Admin Panel</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {currentUser.firstname} {currentUser.lastname} · เจ้าหน้าที่ IT
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                padding: '8px 16px', borderRadius: '10px 10px 0 0',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.2s',
                border: 'none',
                background: activeSection === item.id ? '#eff6ff' : 'transparent',
                color: activeSection === item.id ? '#1e40af' : '#64748b',
                borderBottom: activeSection === item.id ? '2px solid #2563eb' : '2px solid transparent',
              }}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* ═══════════════ SECTION: STATUS ═══════════════ */}
        {activeSection === 'status' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <SectionTitle icon="📡" title="สถานะการเชื่อมต่อระบบ" subtitle="ตรวจสอบสถานะ Database และ Cache ของระบบ RTSAS" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <StatusCard
                icon="🏥"
                title="HOSxP Database"
                subtitle="192.168.2.230:3306"
                status={dbStatus ? (dbStatus.pool_available ? 'connected' : 'disconnected') : 'loading'}
                detail={dbStatus?.status || 'กำลังตรวจสอบ...'}
                gradient={['#0891b2', '#06b6d4']}
                onRefresh={loadDBStatus}
                isLoading={isLoadingDB}
              />
              <StatusCard
                icon="🔐"
                title="Auth Database"
                subtitle="rtsas_auth (MySQL)"
                status="connected"
                detail="SQLAlchemy · bcrypt · JWT"
                gradient={['#6d28d9', '#7c3aed']}
                onRefresh={() => {}}
                isLoading={false}
              />
              <StatusCard
                icon="⚡"
                title="Memory Cache"
                subtitle="last_seen_vitals"
                status="info"
                detail={
                  cacheStats
                    ? `${cacheStats.last_seen_vitals_count} vitals · ${cacheStats.patients_cache_count} patients`
                    : 'กำลังโหลด...'
                }
                gradient={['#d97706', '#f59e0b']}
                onRefresh={loadCacheStats}
                isLoading={isLoadingCache}
              />
            </div>

            {cacheStats && (
              <div style={{
                padding: '16px 20px', borderRadius: '14px',
                background: '#fff', border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>📊 รายละเอียดแคช</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <InfoRow label="Vitals ใน Cache" value={String(cacheStats.last_seen_vitals_count)} />
                  <InfoRow label="ผู้ป่วยใน Cache" value={String(cacheStats.patients_cache_count)} />
                  <InfoRow label="ล้างแคชล่าสุด" value={cacheStats.last_clear_date || 'ยังไม่เคยล้าง'} />
                </div>
              </div>
            )}

            {/* ─── Real-Time System Diagnostics Logs Table ─── */}
            <div style={{
              marginTop: '20px', padding: '20px', borderRadius: '16px',
              background: '#fff', border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex', flexDirection: 'column', gap: '14px',
            }}>
              {/* Header Bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>📜</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                      บันทึกเหตุการณ์และการตอบสนองของระบบ (Real-Time System Diagnostics Logs)
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      อัปเดตล่าสุด: {lastLogsRefreshedAt.toLocaleTimeString('th-TH')} · ทั้งหมด {logs.length} รายการ
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px',
                    fontWeight: 700, color: '#475569', cursor: 'pointer',
                    background: '#f8fafc', padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                  }}>
                    <input
                      type="checkbox"
                      checked={logsAutoRefresh}
                      onChange={(e) => setLogsAutoRefresh(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Auto-refresh (3s)</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowSystemLogsModal(true)}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid #0284c7', background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      color: '#ffffff', display: 'flex', alignItems: 'center', gap: '5px',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                    }}
                    title="เปิดหน้าต่าง Real-Time System Diagnostics Logs เต็มจอ"
                  >
                    <span>🖥️</span>
                    <span>หน้าต่าง Logs เต็มจอ</span>
                  </button>

                  <button
                    type="button"
                    onClick={loadLogs}
                    disabled={isLoadingLogs}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                      cursor: isLoadingLogs ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span>🔄</span>
                    <span>{isLoadingLogs ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
                  </button>

                  <button
                    type="button"
                    id="btn-clear-system-logs"
                    onClick={() => setShowConfirmClearLogs(true)}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <span>🗑️</span>
                    <span>ล้าง Logs ทั้งหมด</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(['ALL', 'ERROR', 'Warning', 'Note'] as const).map((filter) => {
                    const count = filter === 'ALL'
                      ? logs.length
                      : logs.filter((l) => filter === 'ERROR'
                          ? l.level.toUpperCase() === 'ERROR'
                          : filter === 'Warning'
                            ? l.level.toUpperCase().includes('WARN')
                            : l.level.toUpperCase() === 'NOTE' || l.level.toUpperCase() === 'INFO'
                        ).length;

                    const isSelected = logFilter === filter;
                    let activeBg = '#1e293b';
                    let activeColor = '#fff';
                    if (filter === 'ERROR') { activeBg = '#dc2626'; }
                    else if (filter === 'Warning') { activeBg = '#d97706'; }
                    else if (filter === 'Note') { activeBg = '#2563eb'; }

                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setLogFilter(filter)}
                        style={{
                          padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', border: 'none',
                          background: isSelected ? activeBg : '#f1f5f9',
                          color: isSelected ? activeColor : '#64748b',
                          transition: 'all 0.15s',
                        }}
                      >
                        {filter === 'ALL' && `ทั้งหมด (${count})`}
                        {filter === 'ERROR' && `🔴 ERROR (${count})`}
                        {filter === 'Warning' && `🟡 Warning (${count})`}
                        {filter === 'Note' && `🟢 Note (${count})`}
                      </button>
                    );
                  })}
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="ค้นหาใน Logs..."
                    style={{
                      padding: '5px 10px', borderRadius: '8px', border: '1px solid #e2e8f0',
                      fontSize: '11px', outline: 'none', background: '#f8fafc', width: '220px',
                      fontFamily: 'inherit',
                    }}
                  />
                  {logSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLogSearchQuery('')}
                      style={{
                        position: 'absolute', right: '6px', top: '5px', border: 'none',
                        background: 'transparent', cursor: 'pointer', fontSize: '11px', color: '#94a3b8',
                      }}
                    >✕</button>
                  )}
                </div>
              </div>

              {/* Logs Table */}
              <div style={{
                maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0',
                borderRadius: '10px', background: '#fafafa',
              }}>
                {filteredLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '12px' }}>
                    ไม่มีข้อมูล Logs ที่ตรงกับเงื่อนไข
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                      <tr style={{ color: '#64748b', fontWeight: 700 }}>
                        <th style={{ padding: '8px 12px' }}>เวลา (Timestamp)</th>
                        <th style={{ padding: '8px 12px' }}>ระดับ</th>
                        <th style={{ padding: '8px 12px' }}>โมดูล</th>
                        <th style={{ padding: '8px 12px' }}>รายละเอียดเหตุการณ์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, idx) => {
                        const isErr = log.level.toUpperCase() === 'ERROR';
                        const isWarn = log.level.toUpperCase().includes('WARN');
                        return (
                          <tr
                            key={log.id ?? idx}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isErr ? '#fef2f2' : idx % 2 === 0 ? '#fff' : '#fafafa',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {log.timestamp}
                            </td>
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                                background: isErr ? '#fee2e2' : isWarn ? '#fef3c7' : '#dbeafe',
                                color: isErr ? '#b91c1c' : isWarn ? '#b45309' : '#1d4ed8',
                                border: isErr ? '1px solid #fecaca' : isWarn ? '1px solid #fde68a' : '1px solid #bfdbfe',
                              }}>
                                {log.level}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '10px' }}>
                                {log.component || 'System'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#1e293b' }}>
                              <div style={{ fontWeight: 500, lineHeight: 1.4 }}>{log.message}</div>
                              {log.details && Object.keys(log.details).length > 0 && (
                                <div style={{ marginTop: '6px' }}>
                                  {/* Action bar for details */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    {/* Pills for patient breakdown */}
                                    {log.details.patients_breakdown && Array.isArray(log.details.patients_breakdown) && log.details.patients_breakdown.slice(0, 3).map((p: any, pIdx: number) => {
                                      const hnStr = p.hn ? (String(p.hn).startsWith('HN') ? p.hn : `HN ${p.hn}`) : '';
                                      const params = p.parameters ? (Array.isArray(p.parameters) ? p.parameters.join(', ') : p.parameters) : '';
                                      if (!hnStr) return null;
                                      return (
                                        <span
                                          key={pIdx}
                                          style={{
                                            background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
                                            padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                          }}
                                        >
                                          {hnStr} {params ? `• [${params}]` : ''}
                                        </span>
                                      );
                                    })}

                                    {/* Toggle Inline Button */}
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandLog(log.id ?? idx)}
                                      style={{
                                        background: expandedLogIds.has(log.id ?? idx) ? '#0284c7' : '#f1f5f9',
                                        color: expandedLogIds.has(log.id ?? idx) ? '#ffffff' : '#0369a1',
                                        border: '1px solid #bae6fd',
                                        borderRadius: '6px',
                                        padding: '2px 8px',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.15s',
                                      }}
                                    >
                                      <span>{'{ }'}</span>
                                      <span>{expandedLogIds.has(log.id ?? idx) ? 'ซ่อน JSON' : 'ดู JSON'}</span>
                                    </button>

                                    {/* Open Modal Button */}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedLogForModal(log)}
                                      style={{
                                        background: '#f8fafc',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '2px 8px',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                      }}
                                      title="เปิดดูในหน้าต่างป๊อปอัป"
                                    >
                                      <span>🔍</span>
                                      <span>ขยายดู</span>
                                    </button>
                                  </div>

                                  {/* Inline Expanded JSON */}
                                  {expandedLogIds.has(log.id ?? idx) && (
                                    <div style={{
                                      marginTop: '6px', padding: '10px 14px', background: '#0f172a',
                                      borderRadius: '8px', border: '1px solid #334155',
                                      overflowX: 'auto', maxHeight: '250px',
                                    }}>
                                      <pre
                                        style={{
                                          margin: 0, fontSize: '11px', lineHeight: 1.5,
                                          fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: formatJsonSyntax(JSON.stringify(log.details, null, 2)) }}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ SECTION: USERS ═══════════════ */}
        {activeSection === 'users' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <SectionTitle icon="👥" title="จัดการบัญชีผู้ใช้งาน" subtitle={`${users.length} บัญชีในระบบ`} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={loadUsers}
                  disabled={isLoadingUsers}
                  style={{
                    padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {isLoadingUsers ? '⏳' : '🔄'} รีเฟรช
                </button>
                <button
                  onClick={() => setShowRegisterForm((v) => !v)}
                  style={{
                    padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: 'none',
                    background: showRegisterForm ? '#fef2f2' : '#16a34a',
                    color: showRegisterForm ? '#dc2626' : '#fff',
                  }}
                >
                  {showRegisterForm ? '✕ ยกเลิก' : '+ เพิ่มผู้ใช้ใหม่'}
                </button>
              </div>
            </div>

            {/* ── Add User Form ── */}
            {showRegisterForm && (
              <div style={{
                background: '#fff', borderRadius: '14px', border: '1px solid #bbf7d0',
                padding: '20px', marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(22,163,74,0.1)',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#15803d', marginBottom: '14px' }}>
                  ➕ เพิ่มบัญชีผู้ใช้ใหม่
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>ชื่อ *</label>
                    <input
                      type="text"
                      placeholder="ชื่อจริง"
                      value={registerForm.firstname}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, firstname: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>นามสกุล *</label>
                    <input
                      type="text"
                      placeholder="นามสกุล"
                      value={registerForm.lastname}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, lastname: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Username * (≥4 ตัว)</label>
                    <input
                      type="text"
                      placeholder="username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>Password * (≥6 ตัว)</label>
                    <input
                      type="password"
                      placeholder="••••••"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>ตำแหน่ง *</label>
                    <select
                      value={registerForm.role}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, role: e.target.value as typeof registerForm.role }))}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="nurse">💉 พยาบาล</option>
                      <option value="doctor">🩺 แพทย์</option>
                      <option value="it_admin">💻 IT Admin</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={handleRegister}
                  disabled={isRegistering}
                  style={{
                    padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 800,
                    cursor: isRegistering ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    border: 'none', color: '#fff',
                    background: isRegistering ? '#94a3b8' : 'linear-gradient(135deg,#16a34a,#15803d)',
                    boxShadow: isRegistering ? 'none' : '0 4px 14px rgba(22,163,74,.3)',
                  }}
                >
                  {isRegistering ? '⏳ กำลังเพิ่ม...' : '✅ บันทึกผู้ใช้ใหม่'}
                </button>
              </div>
            )}

            {isLoadingUsers ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>⏳ กำลังโหลด...</div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                ⚠️ ไม่สามารถดึงข้อมูลได้ — ตรวจสอบการเชื่อมต่อ backend
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 1fr 100px 170px',
                  padding: '12px 20px', background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <span>ชื่อ-สกุล</span>
                  <span>Username</span>
                  <span>ตำแหน่ง</span>
                  <span style={{ textAlign: 'right' }}>จัดการ</span>
                </div>
                {users.map((user, i) => {
                  const badge = roleBadge(user.role);
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <div
                      key={user.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '1.2fr 1fr 100px 170px',
                        padding: '14px 20px', alignItems: 'center',
                        borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none',
                        transition: 'background 0.15s',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                          {user.firstname} {user.lastname}
                          {isSelf && <span style={{ fontSize: '10px', marginLeft: '6px', color: '#6d28d9', fontWeight: 600 }}>(คุณ)</span>}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                          สมัคร: {new Date(user.created_at).toLocaleDateString('th-TH')}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                        @{user.username}
                      </div>
                      <div>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                          borderRadius: '8px', background: badge.bg,
                          color: badge.color, border: `1px solid ${badge.border}`,
                        }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          style={{
                            padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af',
                            display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
                          }}
                          title="รีเซ็ตรหัสผ่านใหม่"
                          onMouseOver={(e) => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#fff'; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1e40af'; }}
                        >
                          <span>🔑</span>
                          <span>รีเซ็ต</span>
                        </button>
                        {!isSelf ? (
                          <button
                            onClick={() => setDeleteTargetUser(user)}
                            style={{
                              padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit',
                              border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                              display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.15s',
                            }}
                            title="ลบผู้ใช้นี้ออกจากระบบอย่างถาวร"
                            onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                          >
                            <span>🗑️</span>
                            <span>ลบ</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8', padding: '6px 8px', fontStyle: 'italic' }}>
                            (คุณ)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ SECTION: TOOLS ═══════════════ */}
        {activeSection === 'tools' && (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <SectionTitle icon="🔧" title="เครื่องมือระบบ" subtitle="จัดการ Cache, Reset Dashboard และ Simulator" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Patient Memory Cleanup */}
              <ToolCard
                icon="🛡️"
                iconGradient={['#ea580c', '#c2410c']}
                title="ล้างหน่วยความจำผู้ป่วย (Patient Memory Guard)"
                description={
                  <>
                    ล้างหน่วยความจำและ LocalStorage ของผู้ป่วยที่ไม่ได้รักษา เพื่อคืนทรัพยากร RAM
                    <br />
                    <div style={{
                      marginTop: '8px', padding: '10px 12px', background: '#f8fafc',
                      borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '11px',
                    }}>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span>👥 ผู้ป่วยในหน่วยความจำ: <strong>{memoryAudit.totalPatientsInMemory} ราย</strong></span>
                        <span style={{ color: '#16a34a' }}>
                          🛡️ กำลังรักษา / จับเวลา (คงไว้): <strong>{memoryAudit.activeTreatedCount} ราย</strong>
                        </span>
                        <span style={{ color: '#ea580c' }}>
                          🧹 พร้อมเคลียร์: <strong>{memoryAudit.inactiveCount} ราย</strong>
                        </span>
                      </div>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '11px', marginTop: '6px', display: 'block' }}>
                      {cacheStats && `Backend Cache: ${cacheStats.last_seen_vitals_count} vitals · ${cacheStats.patients_cache_count} patients`}
                    </span>
                  </>
                }
                buttonLabel="🧹 ล้าง Memory ผู้ป่วยที่ไม่ได้รักษา"
                buttonColor="#ea580c"
                onAction={() => setShowConfirmClear(true)}
                dangerNote="🛡️ คุ้มครองผู้ป่วยที่กำลังรักษาอัตโนมัติ"
              />

              {/* ⚠️ Full Reset Dashboard */}
              <ToolCard
                icon="⚠️"
                iconGradient={['#dc2626', '#b91c1c']}
                title="Reset Dashboard ทั้งหมด"
                description={
                  <>
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ อันตราย:</span> ล้างข้อมูลการรักษาทั้งหมดออกจาก Backend DB และ Frontend store
                    <br />
                    รวมถึง Checklist, Timeline, Timer, สถานะ Sepsis ทุกราย
                    <br />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>ใช้เมื่อต้องการ Reset ระบบสู่ Zero-State ใหม่</span>
                  </>
                }
                buttonLabel="🗑️ Reset Dashboard ทั้งหมด"
                buttonColor="#dc2626"
                onAction={() => setShowConfirmReset(true)}
                dangerNote="⚠️ ไม่สามารถกู้คืนได้!"
              />

              {/* Auto-clear Info */}
              <ToolCard
                icon="🌙"
                iconGradient={['#6d28d9', '#4c1d95']}
                title="Auto-Clear ทุกเที่ยงคืน"
                description={
                  <>
                    ระบบจะล้าง <code>last_seen_vitals</code> อัตโนมัติทุกเที่ยงคืน
                    เพื่อป้องกัน Memory Leak เมื่อระบบรันต่อเนื่องหลายวัน
                    <br />
                    {cacheStats?.last_clear_date && (
                      <span style={{ color: '#6d28d9', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                        ล้างล่าสุด: {cacheStats.last_clear_date}
                      </span>
                    )}
                  </>
                }
                buttonLabel="🔄 รีเฟรชสถานะ"
                buttonColor="#6d28d9"
                onAction={loadCacheStats}
                dangerNote={null}
              />

              {/* HOSxP Config */}
              <ToolCard
                icon="⚙️"
                iconGradient={['#0891b2', '#0e7490']}
                title="ตั้งค่า HOSxP Connection"
                description={
                  <>
                    แก้ไขไฟล์ <code>backend/.env</code> ด้วยข้อมูลด้านล่างแล้วรีสตาร์ท Docker:
                    <pre style={{
                      marginTop: '10px', padding: '10px 14px',
                      background: '#0f172a', color: '#7dd3fc',
                      borderRadius: '10px', fontSize: '11px', lineHeight: 1.8,
                      fontFamily: 'monospace', overflowX: 'auto',
                    }}>
{`DB_HOST=192.168.2.230
DB_PORT=3306
DB_USER=bk
DB_PASSWORD=bk
DB_NAME=hos`}
                    </pre>
                  </>
                }
                buttonLabel="📋 คัดลอก .env"
                buttonColor="#0891b2"
                onAction={() => {
                  navigator.clipboard.writeText(
                    'DB_HOST=192.168.2.230\nDB_PORT=3306\nDB_USER=bk\nDB_PASSWORD=bk\nDB_NAME=hos'
                  );
                  showToast('📋 คัดลอก .env config แล้ว', 'success');
                }}
                dangerNote={null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  fontSize: '12px',
  fontFamily: 'inherit',
  outline: 'none',
  background: '#f8fafc',
  color: '#1e293b',
  boxSizing: 'border-box',
};

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{icon}</span> {title}
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{subtitle}</div>
    </div>
  );
}

function StatusCard({
  icon, title, subtitle, status, detail, gradient, onRefresh, isLoading,
}: {
  icon: string;
  title: string;
  subtitle: string;
  status: 'connected' | 'disconnected' | 'loading' | 'info';
  detail: string;
  gradient: [string, string];
  onRefresh: () => void;
  isLoading: boolean;
}) {
  const statusColors = {
    connected: { bg: '#f0fdf4', dot: '#16a34a', text: 'เชื่อมต่อแล้ว' },
    disconnected: { bg: '#fef2f2', dot: '#dc2626', text: 'ขาดการเชื่อมต่อ' },
    loading: { bg: '#f8fafc', dot: '#94a3b8', text: 'กำลังตรวจสอบ...' },
    info: { bg: '#fffbeb', dot: '#d97706', text: 'ข้อมูลแคช' },
  };
  const sc = statusColors[status];

  return (
    <div style={{
      background: '#fff', borderRadius: '16px',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ height: '4px', background: `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})` }} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            boxShadow: `0 4px 12px ${gradient[0]}44`,
          }}>{icon}</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{title}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>{subtitle}</div>
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 10px', borderRadius: '10px', background: sc.bg,
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: sc.dot }}>{sc.text}</span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', lineHeight: 1.5 }}>{detail}</div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          style={{
            marginTop: '10px', width: '100%', padding: '6px',
            borderRadius: '8px', fontSize: '11px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b',
            transition: 'all 0.15s',
          }}
        >
          {isLoading ? '⏳ ตรวจสอบ...' : '🔄 ตรวจสอบ'}
        </button>
      </div>
    </div>
  );
}

function ToolCard({
  icon, iconGradient, title, description, buttonLabel, buttonColor, onAction, dangerNote,
}: {
  icon: string;
  iconGradient: [string, string];
  title: string;
  description: React.ReactNode;
  buttonLabel: string;
  buttonColor: string;
  onAction: () => void;
  dangerNote: string | null;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
          background: `linear-gradient(135deg, ${iconGradient[0]}, ${iconGradient[1]})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          boxShadow: `0 6px 16px ${iconGradient[0]}44`,
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>{description}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
            <button
              onClick={onAction}
              style={{
                padding: '10px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', color: '#fff', border: 'none',
                background: `linear-gradient(135deg, ${buttonColor}, ${buttonColor}cc)`,
                boxShadow: `0 4px 14px ${buttonColor}44`,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ''; }}
            >
              {buttonLabel}
            </button>
            {dangerNote && (
              <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>
                {dangerNote}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{value}</div>
    </div>
  );
}
