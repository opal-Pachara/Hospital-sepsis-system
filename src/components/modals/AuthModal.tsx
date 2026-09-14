import { useState } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import type { UserRole } from '../../store/useRTSASStore';
import { showToast } from '../common/Toast';
import { extractErrorMessage } from '../../utils/errorUtils';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface RoleOption {
  value: UserRole;
  label: string;
  icon: string;
  desc: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
}

const roleOptions: RoleOption[] = [
  {
    value: 'doctor',
    label: 'แพทย์',
    icon: '🩺',
    desc: 'วินิจฉัย & สั่ง Sepsis Bundle',
    badgeBg: '#ecfdf5',
    badgeBorder: '#a7f3d0',
    badgeColor: '#059669',
  },
  {
    value: 'nurse',
    label: 'พยาบาล (พว.)',
    icon: '💉',
    desc: 'คัดกรอง & บันทึก Vitals',
    badgeBg: '#eff6ff',
    badgeBorder: '#bfdbfe',
    badgeColor: '#2563eb',
  },
  {
    value: 'it_admin',
    label: 'เจ้าหน้าที่ IT',
    icon: '💻',
    desc: 'จัดการระบบ & ผู้ใช้งาน',
    badgeBg: '#f5f3ff',
    badgeBorder: '#ddd6fe',
    badgeColor: '#7c3aed',
  },
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { setAuthUser } = useRTSASStore();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);

  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register State
  const [regFirstname, setRegFirstname] = useState('');
  const [regLastname, setRegLastname] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('nurse');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Sync mode and clear errors when modal opens or defaultMode changes (render-phase adjustment)
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevDefaultMode, setPrevDefaultMode] = useState(defaultMode);

  if (isOpen !== prevOpen || defaultMode !== prevDefaultMode) {
    setPrevOpen(isOpen);
    setPrevDefaultMode(defaultMode);
    if (isOpen) {
      setMode(defaultMode);
      setLoginError('');
      setRegError('');
      setRegSuccess('');
    }
  }

  if (!isOpen) return null;

  // ── Login Handler ────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('กรุณากรอก Username และ Password');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoginError(extractErrorMessage(data.detail, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'));
        return;
      }

      localStorage.setItem('rtsas_token', data.access_token);
      const u = data.user;
      setAuthUser(
        {
          id: u.id,
          username: u.username,
          firstname: u.firstname,
          lastname: u.lastname,
          role: u.role,
          is_active: u.is_active,
          name: u.full_name ?? `${u.firstname} ${u.lastname}`,
        },
        data.access_token
      );
      showToast(`เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ ${u.firstname} ${u.lastname}`, 'success', 3000);
      onClose();
    } catch {
      setLoginError('ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบการเชื่อมต่อเครือข่าย');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Register Handler ─────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regFirstname.trim() || !regLastname.trim()) {
      setRegError('กรุณากรอกชื่อและนามสกุลให้ครบถ้วน');
      return;
    }
    if (!regUsername.trim() || regUsername.trim().length < 4) {
      setRegError('Username ต้องมีอย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (regPassword.length < 6) {
      setRegError('Password ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Password และ Confirm Password ไม่ตรงกัน');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          password: regPassword,
          firstname: regFirstname.trim(),
          lastname: regLastname.trim(),
          role: regRole,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRegError(extractErrorMessage(data.detail, 'ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง'));
        return;
      }

      setRegSuccess(`สร้างบัญชีสำเร็จ! กำลังเข้าสู่ระบบ...`);

      // Attempt auto-login seamlessly
      try {
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: regUsername.trim(),
            password: regPassword,
          }),
        });
        if (loginRes.ok) {
          const loginData = await loginRes.json().catch(() => ({}));
          if (loginData.access_token && loginData.user) {
            localStorage.setItem('rtsas_token', loginData.access_token);
            const u = loginData.user;
            setAuthUser(
              {
                id: u.id,
                username: u.username,
                firstname: u.firstname,
                lastname: u.lastname,
                role: u.role,
                is_active: u.is_active,
                name: u.full_name ?? `${u.firstname} ${u.lastname}`,
              },
              loginData.access_token
            );
            showToast(`สมัครสมาชิกและเข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ ${u.firstname} ${u.lastname}`, 'success', 3500);
            onClose();
            return;
          }
        }
      } catch {
        // Fallback to manual login tab
      }

      // If auto-login couldn't complete, smoothly transition to login tab
      showToast('สมัครสมาชิกสำเร็จแล้ว! กรุณาเข้าสู่ระบบ', 'success', 3500);
      setTimeout(() => {
        setMode('login');
        setLoginUsername(regUsername.trim());
        setLoginPassword('');
        setRegSuccess('');
      }, 1000);
    } catch {
      setRegError('ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบการเชื่อมต่อเครือข่าย');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center animate-fade-in p-4"
      style={{ background: 'rgba(10, 10, 20, 0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="animate-slideUp"
        style={{
          width: '460px',
          maxWidth: '95vw',
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -12px rgba(37, 99, 235, .3), 0 0 0 1px rgba(37, 99, 235, .12)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Blue Top Accent Bar (ReminderModal match) ─── */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563eb, #0891b2, #10b981, #2563eb)' }} />

        {/* ─── Header (Matching ReminderModal header structure) ─── */}
        <div style={{
          padding: '18px 22px 14px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 50%, #e0f2fe 100%)',
          display: 'flex', alignItems: 'flex-start', gap: '14px',
          borderBottom: '1px solid rgba(191, 219, 254, .5)',
        }}>
          {/* Hospital/Lock icon with shadow */}
          <div
            style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #2563eb, #0891b2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', flexShrink: 0, color: '#fff',
              boxShadow: '0 6px 18px rgba(37, 99, 235, .35)',
            }}
          >
            {mode === 'login' ? '🔐' : '📝'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#1e40af', letterSpacing: '-0.3px', lineHeight: 1.3 }}>
              {mode === 'login' ? 'เข้าสู่ระบบ RTSAS' : 'สมัครสมาชิกผู้ใช้งาน RTSAS'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, color: '#2563eb',
                background: '#fff', border: '1.5px solid #bfdbfe', borderRadius: '8px',
                padding: '2px 8px',
              }}>
                โรงพยาบาลบางคล้า
              </span>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                {mode === 'login' ? 'สำหรับบุคลากร ER' : 'สร้างบัญชีใหม่'}
              </span>
            </div>
          </div>

          {/* Close button (ReminderModal match) */}
          <button
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
            title="ปิดหน้าต่าง"
          >
            ✕
          </button>
        </div>

        {/* ─── Body ─── */}
        <div style={{ padding: '18px 22px 22px' }}>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '14px',
            gap: '4px',
          }}>
            <button
              type="button"
              id="tab-btn-login"
              onClick={() => { setMode('login'); setLoginError(''); }}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: '9px',
                fontSize: '11px', fontWeight: mode === 'login' ? 700 : 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                background: mode === 'login' ? '#fff' : 'transparent',
                color: mode === 'login' ? '#2563eb' : '#64748b',
                border: mode === 'login' ? '1px solid #bfdbfe' : '1px solid transparent',
                boxShadow: mode === 'login' ? '0 2px 6px rgba(37,99,235,0.12)' : 'none',
              }}
            >
              <span>🔐</span>
              <span>เข้าสู่ระบบ</span>
            </button>
            <button
              type="button"
              id="tab-btn-register"
              onClick={() => { setMode('register'); setRegError(''); }}
              style={{
                flex: 1, padding: '7px 10px', borderRadius: '9px',
                fontSize: '11px', fontWeight: mode === 'register' ? 700 : 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                background: mode === 'register' ? '#fff' : 'transparent',
                color: mode === 'register' ? '#059669' : '#64748b',
                border: mode === 'register' ? '1px solid #a7f3d0' : '1px solid transparent',
                boxShadow: mode === 'register' ? '0 2px 6px rgba(5,150,105,0.12)' : 'none',
              }}
            >
              <span>📝</span>
              <span>สมัครสมาชิก</span>
            </button>
          </div>

          {/* Info message card with Left Accent Bar (ReminderModal match) */}
          <div style={{
            padding: '12px 14px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #eff6ff, #f8fafc)',
            border: '1px solid #bfdbfe', marginBottom: '14px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
              background: 'linear-gradient(to bottom, #2563eb, #0891b2)',
              borderRadius: '14px 0 0 14px',
            }} />
            <div style={{ paddingLeft: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
                {mode === 'login' ? '🔑 ยืนยันตัวตนแพทย์ / พยาบาล ER' : '📋 กรอกข้อมูลเพื่อสร้างบัญชีใหม่'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6 }}>
                {mode === 'login'
                  ? 'เข้าสู่ระบบเพื่อบันทึกสัญญาณชีพและดำเนินการ Sepsis Bundle 60 นาที'
                  : 'เลือกระดับบทบาทและกรอกข้อมูลให้ครบถ้วนเพื่อเข้าใช้งานระบบ'}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: LOGIN FORM                                               */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              {loginError && (
                <div style={{
                  padding: '9px 12px', borderRadius: '10px',
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  color: '#dc2626', fontSize: '11px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }} className="animate-shake">
                  <span>⚠️</span>
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: '13px', pointerEvents: 'none' }}>
                    👤
                  </span>
                  <input
                    type="text"
                    id="input-login-username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="เช่น doctor_somchai"
                    style={{
                      width: '100%', padding: '9px 12px 9px 34px',
                      borderRadius: '10px', border: '1px solid #cbd5e1',
                      fontSize: '12px', color: '#1e293b', background: '#f8fafc',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  รหัสผ่าน (Password)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: '13px', pointerEvents: 'none' }}>
                    🔒
                  </span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    id="input-login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%', padding: '9px 34px 9px 34px',
                      borderRadius: '10px', border: '1px solid #cbd5e1',
                      fontSize: '12px', color: '#1e293b', background: '#f8fafc',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    style={{
                      position: 'absolute', right: '8px',
                      background: 'none', border: 'none', color: '#94a3b8',
                      fontSize: '13px', cursor: 'pointer', padding: '2px',
                    }}
                    title={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showLoginPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Action Buttons (ReminderModal match) */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  id="btn-submit-login"
                  disabled={loginLoading}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '14px',
                    fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    color: '#fff', border: 'none',
                    background: 'linear-gradient(135deg, #2563eb, #0891b2)',
                    boxShadow: '0 6px 20px -4px rgba(37, 99, 235, .35)',
                    transition: 'all 0.25s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    opacity: loginLoading ? 0.75 : 1,
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(37, 99, 235, .45)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(37, 99, 235, .35)'; }}
                >
                  {loginLoading ? '⏳ กำลังเข้าสู่ระบบ...' : '🔐 เข้าสู่ระบบ'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '14px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    color: '#64748b', border: '1px solid #e2e8f0', background: '#f8fafc',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          ) : (
            /* ═══════════════════════════════════════════════════════════════ */
            /* TAB 2: REGISTER FORM                                            */
            /* ═══════════════════════════════════════════════════════════════ */
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              {regError && (
                <div style={{
                  padding: '9px 12px', borderRadius: '10px',
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  color: '#dc2626', fontSize: '11px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }} className="animate-shake">
                  <span>⚠️</span>
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div style={{
                  padding: '9px 12px', borderRadius: '10px',
                  background: '#f0fdf4', border: '1px solid #86efac',
                  color: '#16a34a', fontSize: '11px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span>✅</span>
                  <span>{regSuccess}</span>
                </div>
              )}

              {/* 1. Name & Surname Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    ชื่อจริง (Firstname)
                  </label>
                  <input
                    type="text"
                    id="input-reg-firstname"
                    value={regFirstname}
                    onChange={(e) => setRegFirstname(e.target.value)}
                    placeholder="เช่น สมชาย"
                    style={{
                      width: '100%', padding: '8px 10px',
                      borderRadius: '10px', border: '1px solid #cbd5e1',
                      fontSize: '11px', color: '#1e293b', background: '#f8fafc',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    นามสกุล (Lastname)
                  </label>
                  <input
                    type="text"
                    id="input-reg-lastname"
                    value={regLastname}
                    onChange={(e) => setRegLastname(e.target.value)}
                    placeholder="เช่น ใจมั่นคง"
                    style={{
                      width: '100%', padding: '8px 10px',
                      borderRadius: '10px', border: '1px solid #cbd5e1',
                      fontSize: '11px', color: '#1e293b', background: '#f8fafc',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* 2. Interactive Role Selection Cards */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  ตำแหน่ง / บทบาทหน้าที่
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roleOptions.map((opt) => {
                    const isSelected = regRole === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRegRole(opt.value)}
                        style={{
                          padding: '8px 6px',
                          borderRadius: '10px',
                          border: isSelected ? `1.5px solid ${opt.badgeColor}` : '1px solid #e2e8f0',
                          background: isSelected ? opt.badgeBg : '#f8fafc',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontSize: '16px' }}>{opt.icon}</div>
                        <div style={{
                          fontSize: '11px', fontWeight: 700,
                          color: isSelected ? opt.badgeColor : '#334155',
                          marginTop: '2px',
                        }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px', lineHeight: 1.2 }}>
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Username */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: '12px', pointerEvents: 'none' }}>
                    👤
                  </span>
                  <input
                    type="text"
                    id="input-reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="เช่น somchai_nurse"
                    style={{
                      width: '100%', padding: '8px 10px 8px 30px',
                      borderRadius: '10px', border: '1px solid #cbd5e1',
                      fontSize: '11px', color: '#1e293b', background: '#f8fafc',
                      fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* 4. Passwords Row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    รหัสผ่าน
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      id="input-reg-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="อย่างน้อย 6 ตัว"
                      style={{
                        width: '100%', padding: '8px 28px 8px 10px',
                        borderRadius: '10px', border: '1px solid #cbd5e1',
                        fontSize: '11px', color: '#1e293b', background: '#f8fafc',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      style={{
                        position: 'absolute', right: '6px',
                        background: 'none', border: 'none', color: '#94a3b8',
                        fontSize: '12px', cursor: 'pointer', padding: '1px',
                      }}
                    >
                      {showRegPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    ยืนยันรหัสผ่าน
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      id="input-reg-confirm-password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่าน"
                      style={{
                        width: '100%', padding: '8px 28px 8px 10px',
                        borderRadius: '10px', border: '1px solid #cbd5e1',
                        fontSize: '11px', color: '#1e293b', background: '#f8fafc',
                        fontFamily: 'inherit', outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      style={{
                        position: 'absolute', right: '6px',
                        background: 'none', border: 'none', color: '#94a3b8',
                        fontSize: '12px', cursor: 'pointer', padding: '1px',
                      }}
                    >
                      {showRegConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons (ReminderModal match) */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="submit"
                  id="btn-submit-register"
                  disabled={regLoading}
                  style={{
                    flex: 2, padding: '12px', borderRadius: '14px',
                    fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    color: '#fff', border: 'none',
                    background: 'linear-gradient(135deg, #059669, #0284c7)',
                    boxShadow: '0 6px 20px -4px rgba(5, 150, 105, .35)',
                    transition: 'all 0.25s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    opacity: regLoading ? 0.75 : 1,
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px -4px rgba(5, 150, 105, .45)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(5, 150, 105, .35)'; }}
                >
                  {regLoading ? '⏳ กำลังบันทึก...' : '📝 ลงทะเบียนผู้ใช้'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '14px',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    color: '#64748b', border: '1px solid #e2e8f0', background: '#f8fafc',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}

          {/* Progress / Security Indicator (ReminderModal progress indicator match) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px',
            padding: '7px 10px', borderRadius: '10px',
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '12px' }}>🔒</div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>
              ระบบความปลอดภัย: <strong style={{ color: '#2563eb' }}>bcrypt & JWT 8 ชม.</strong>
            </div>
            <div style={{
              marginLeft: 'auto', fontSize: '9px', fontWeight: 700, color: '#16a34a',
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px',
              padding: '1px 6px',
            }}>
              ✓ ปลอดภัย
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
