import { useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { UserRole } from '../store/useRTSASStore';
import { showToast } from './Toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface RoleOption {
  value: UserRole;
  label: string;
  sublabel: string;
  icon: string;
  desc: string;
  badgeColor: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
}

const roleOptions: RoleOption[] = [
  {
    value: 'doctor',
    label: 'แพทย์',
    sublabel: 'Physician / Doctor',
    icon: '🩺',
    desc: 'วินิจฉัย & สั่ง Sepsis Bundle',
    badgeColor: '#059669',
    activeBorder: '#10b981',
    activeBg: '#ecfdf5',
    activeText: '#065f46',
  },
  {
    value: 'nurse',
    label: 'พยาบาล',
    sublabel: 'Staff Nurse',
    icon: '💉',
    desc: 'คัดกรอง, บันทึก Vitals & Checklist',
    badgeColor: '#2563eb',
    activeBorder: '#3b82f6',
    activeBg: '#eff6ff',
    activeText: '#1e40af',
  },
  {
    value: 'it_admin',
    label: 'เจ้าหน้าที่ IT',
    sublabel: 'IT Administrator',
    icon: '💻',
    desc: 'ดูแล Server & สิทธิ์ผู้ใช้งาน',
    badgeColor: '#7c3aed',
    activeBorder: '#8b5cf6',
    activeBg: '#f5f3ff',
    activeText: '#5b21b6',
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

      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        return;
      }

      localStorage.setItem('rtsas_token', data.access_token);
      setAuthUser(data.user, data.access_token);
      showToast(`เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ ${data.user.firstname} ${data.user.lastname}`, 'success', 3000);
      onClose();
    } catch {
      // Offline fallback demo login
      const fallbackUser = {
        id: 1,
        username: loginUsername.trim(),
        firstname: loginUsername.trim(),
        lastname: '(สาธิต)',
        role: 'nurse' as UserRole,
        is_active: true,
        name: `${loginUsername.trim()} (สาธิต)`,
      };
      setAuthUser(fallbackUser, 'mock_offline_token');
      showToast(`เข้าสู่ระบบ (โหมดสาธิต): ยินดีต้อนรับ ${fallbackUser.name}`, 'info', 3000);
      onClose();
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
    if (!regUsername.trim() || regUsername.trim().length < 3) {
      setRegError('Username ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (regPassword.length < 4) {
      setRegError('Password ต้องมีอย่างน้อย 4 ตัวอักษร');
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

      const data = await res.json();
      if (!res.ok) {
        setRegError(data.detail || 'ไม่สามารถลงทะเบียนได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      setRegSuccess(`สร้างบัญชีสำเร็จ! กำลังสลับไปยังหน้าเข้าสู่ระบบ...`);
      showToast('สมัครสมาชิกสำเร็จแล้ว! กรุณาเข้าสู่ระบบ', 'success', 3500);
      setTimeout(() => {
        setMode('login');
        setLoginUsername(regUsername);
        setLoginPassword('');
        setRegSuccess('');
      }, 1000);
    } catch {
      // Offline fallback registration
      setRegSuccess(`สร้างบัญชีสาธิต (${regFirstname} ${regLastname}) เรียบร้อย!`);
      showToast('สมัครสมาชิก (โหมดสาธิต) สำเร็จ!', 'success', 3000);
      setTimeout(() => {
        setMode('login');
        setLoginUsername(regUsername);
        setRegSuccess('');
      }, 1000);
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center animate-fade-in p-4"
      style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-[520px] max-w-[95vw] overflow-hidden shadow-2xl animate-slideUp relative flex flex-col"
        style={{
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(37, 99, 235, 0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top 4px Gradient Accent Bar */}
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #2563eb, #0891b2, #10b981, #2563eb)' }} />

        {/* ─── Header Section ─── */}
        <div style={{
          padding: '22px 26px 18px',
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 60%, #f0fdf4 100%)',
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              {/* Hospital Emblem Badge */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl text-white shadow-md flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #0891b2)',
                  boxShadow: '0 6px 16px rgba(37,99,235,.28)',
                }}
              >
                🏥
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800 tracking-tight">
                    โรงพยาบาลบางคล้า
                  </h3>
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '2px 7px',
                    borderRadius: '6px', background: '#dbeafe', color: '#1e40af',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                  }}>
                    RTSAS
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ระบบแจ้งเตือนและติดตามภาวะติดเชื้อในกระแสเลือด
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-base transition-all cursor-pointer shadow-sm"
              title="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>

          {/* ─── Segmented Pill Tabs ─── */}
          <div className="flex bg-slate-200/70 p-1 rounded-2xl mt-4 border border-slate-200 gap-1.5">
            <button
              type="button"
              id="tab-btn-login"
              onClick={() => { setMode('login'); setLoginError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80 scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🔐</span>
              <span>เข้าสู่ระบบ (Sign In)</span>
            </button>
            <button
              type="button"
              id="tab-btn-register"
              onClick={() => { setMode('register'); setRegError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80 scale-[1.01]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📝</span>
              <span>สมัครสมาชิก (Register)</span>
            </button>
          </div>
        </div>

        {/* ─── Modal Form Body ─── */}
        <div style={{ padding: '22px 26px', maxHeight: '72vh', overflowY: 'auto' }}>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: LOGIN FORM                                               */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {loginError && (
                <div style={{
                  padding: '10px 14px', borderRadius: '12px',
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  color: '#dc2626', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }} className="animate-shake">
                  <span>⚠️</span>
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 text-sm pointer-events-none">
                    👤
                  </span>
                  <input
                    type="text"
                    id="input-login-username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="เช่น doctor_somchai"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-100 transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 text-sm pointer-events-none">
                    🔒
                  </span>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    id="input-login-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-700 text-sm p-1 rounded transition-all cursor-pointer"
                    title={showLoginPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  >
                    {showLoginPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-submit-login"
                disabled={loginLoading}
                className="w-full mt-1 py-3 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
                  opacity: loginLoading ? 0.75 : 1,
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                }}
              >
                {loginLoading ? (
                  <>
                    <span className="animate-spin text-base">⏳</span>
                    <span>กำลังตรวจสอบข้อมูล...</span>
                  </>
                ) : (
                  <>
                    <span>🔐</span>
                    <span>เข้าสู่ระบบ RTSAS</span>
                  </>
                )}
              </button>

              {/* Bottom Quick Switch */}
              <div className="text-center pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <span>ยังไม่มีบัญชีผู้ใช้งาน?</span>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  สมัครสมาชิกใหม่ที่นี่
                </button>
              </div>
            </form>
          ) : (
            /* ═══════════════════════════════════════════════════════════════ */
            /* TAB 2: REGISTER FORM                                            */
            /* ═══════════════════════════════════════════════════════════════ */
            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              {regError && (
                <div style={{
                  padding: '10px 14px', borderRadius: '12px',
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  color: '#dc2626', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }} className="animate-shake">
                  <span>⚠️</span>
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div style={{
                  padding: '10px 14px', borderRadius: '12px',
                  background: '#f0fdf4', border: '1px solid #86efac',
                  color: '#16a34a', fontSize: '12px', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span>✅</span>
                  <span>{regSuccess}</span>
                </div>
              )}

              {/* 1. Name & Surname Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อจริง (Firstname)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-slate-400 text-xs pointer-events-none">
                      🪪
                    </span>
                    <input
                      type="text"
                      id="input-reg-firstname"
                      value={regFirstname}
                      onChange={(e) => setRegFirstname(e.target.value)}
                      placeholder="เช่น สมชาย"
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    นามสกุล (Lastname)
                  </label>
                  <input
                    type="text"
                    id="input-reg-lastname"
                    value={regLastname}
                    onChange={(e) => setRegLastname(e.target.value)}
                    placeholder="เช่น ใจมั่นคง"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
              </div>

              {/* 2. Interactive Role Selection Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>ตำแหน่ง / บทบาทหน้าที่ (Select Role)</span>
                  <span className="text-[10px] text-slate-400 font-normal">เลือกตำแหน่งที่ตรงกับคุณ</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roleOptions.map((opt) => {
                    const isSelected = regRole === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRegRole(opt.value)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'shadow-sm ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                        }`}
                        style={{
                          background: isSelected ? opt.activeBg : undefined,
                          borderColor: isSelected ? opt.activeBorder : undefined,
                        }}
                      >
                        {isSelected && (
                          <div
                            className="absolute top-2 right-2 w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] font-bold"
                            style={{ background: opt.badgeColor }}
                          >
                            ✓
                          </div>
                        )}
                        <div className="text-xl mb-1">{opt.icon}</div>
                        <div>
                          <div className="text-xs font-bold" style={{ color: isSelected ? opt.activeText : '#1e293b' }}>
                            {opt.label}
                          </div>
                          <div className="text-[9px] text-slate-400 font-medium leading-tight mt-0.5">
                            {opt.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้ใช้งาน (Username)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400 text-xs pointer-events-none">
                    👤
                  </span>
                  <input
                    type="text"
                    id="input-reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="เช่น somchai_doctor"
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all"
                  />
                </div>
              </div>

              {/* 4. Passwords Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสผ่าน (Password)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      id="input-reg-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="อย่างน้อย 4 ตัว"
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                    >
                      {showRegPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      id="input-reg-confirm-password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="ยืนยันรหัสผ่าน"
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-slate-50/60 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                    >
                      {showRegConfirmPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Register Button */}
              <button
                type="submit"
                id="btn-submit-register"
                disabled={regLoading}
                className="w-full mt-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #0284c7 100%)',
                  opacity: regLoading ? 0.75 : 1,
                  boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
                }}
              >
                {regLoading ? (
                  <>
                    <span className="animate-spin text-sm">⏳</span>
                    <span>กำลังบันทึกข้อมูลสมาชิก...</span>
                  </>
                ) : (
                  <>
                    <span>📝</span>
                    <span>ยืนยันการลงทะเบียน</span>
                  </>
                )}
              </button>

              {/* Bottom Quick Switch */}
              <div className="text-center pt-1 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <span>มีบัญชีผู้ใช้งานอยู่แล้ว?</span>
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  เข้าสู่ระบบที่นี่
                </button>
              </div>
            </form>
          )}

          {/* Security Note Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] text-slate-400 text-center">
            <span>🔒</span>
            <span>ความปลอดภัยระดับโรงพยาบาล · รหัสผ่านเข้ารหัส bcrypt & JWT Session 8 ชม.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
