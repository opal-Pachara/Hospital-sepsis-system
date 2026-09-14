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
// Main AdminPage
// ---------------------------------------------------------------------------

interface AdminPageProps {
  onBack: () => void;
}

const EMPTY_REGISTER = { firstname: '', lastname: '', username: '', password: '', role: 'nurse' as const };

export default function AdminPage({ onBack }: AdminPageProps) {
  const { currentUser, isAuthenticated, getPatientMemoryAudit, clearInactivePatientsMemory, clearTreatedPatients } = useRTSASStore();
  const memoryAudit = getPatientMemoryAudit();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isResettingDashboard, setIsResettingDashboard] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'status' | 'users' | 'tools'>('status');

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

  // Deactivate user
  const handleDeactivate = async (userId: number, username: string) => {
    if (!token) return;
    setDeactivatingId(userId);
    try {
      const res = await fetch(`${API_BASE}/auth/users/${userId}/deactivate`, {
        method: 'PUT',
        headers: authHeaders,
      });
      if (res.ok) {
        showToast(`✅ ระงับบัญชี @${username} แล้ว`, 'success');
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(extractErrorMessage(err.detail, 'ไม่สามารถระงับบัญชีได้'), 'error');
      }
    } catch {
      showToast('ไม่สามารถเชื่อมต่อกับ backend', 'error');
    } finally {
      setDeactivatingId(null);
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
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#64748b' }}>ต้องเข้าสู่ระบบในฐานะ IT Admin เท่านั้น</div>
        <button onClick={onBack} style={{
          padding: '10px 24px', borderRadius: '10px', fontSize: '13px',
          fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          border: 'none', background: '#2563eb', color: '#fff',
        }}>← กลับ Dashboard</button>
      </div>
    );
  }

  const nav = [
    { id: 'status', icon: '📡', label: 'สถานะระบบ' },
    { id: 'users', icon: '👥', label: 'จัดการผู้ใช้' },
    { id: 'tools', icon: '🔧', label: 'เครื่องมือระบบ' },
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

      {/* ─── Top Bar ─── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: '16px',
        flexShrink: 0, position: 'relative', overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6d28d9, #2563eb, #0891b2)' }} />

        <button
          id="btn-admin-back"
          onClick={onBack}
          style={{
            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b',
            display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s',
            marginTop: '3px',
          }}
          onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        >
          ← กลับ Dashboard
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
                  display: 'grid', gridTemplateColumns: '1fr 1fr 100px 80px 80px',
                  padding: '12px 20px', background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <span>ชื่อ-สกุล</span>
                  <span>Username</span>
                  <span>ตำแหน่ง</span>
                  <span>สถานะ</span>
                  <span>จัดการ</span>
                </div>
                {users.map((user, i) => {
                  const badge = roleBadge(user.role);
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <div
                      key={user.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 100px 80px 80px',
                        padding: '14px 20px', alignItems: 'center',
                        borderBottom: i < users.length - 1 ? '1px solid #f1f5f9' : 'none',
                        background: !user.is_active ? '#fefce8' : 'transparent',
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
                      <div>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 8px',
                          borderRadius: '8px',
                          background: user.is_active ? '#f0fdf4' : '#fef2f2',
                          color: user.is_active ? '#16a34a' : '#dc2626',
                          border: user.is_active ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        }}>
                          {user.is_active ? '● ใช้งาน' : '✕ ระงับ'}
                        </span>
                      </div>
                      <div>
                        {user.is_active && !isSelf ? (
                          <button
                            onClick={() => handleDeactivate(user.id, user.username)}
                            disabled={deactivatingId === user.id}
                            style={{
                              padding: '5px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                              cursor: deactivatingId === user.id ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                              border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                          >
                            {deactivatingId === user.id ? '⏳' : '✕ ระงับ'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#cbd5e1' }}>—</span>
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
