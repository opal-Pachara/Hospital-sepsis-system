import { useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { UserRole } from '../store/useRTSASStore';
import { showToast } from './Toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const roleOptions: { value: UserRole; label: string; icon: string; desc: string }[] = [
  { value: 'doctor',   label: 'แพทย์',          icon: '🩺', desc: 'ยืนยันการวินิจฉัยและสั่งการรักษา' },
  { value: 'nurse',    label: 'พยาบาล',          icon: '💉', desc: 'คัดกรอง, Sepsis Bundle & Vitals' },
  { value: 'it_admin', label: 'เจ้าหน้าที่ IT',  icon: '💻', desc: 'จัดการระบบและผู้ใช้งาน' },
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { setAuthUser } = useRTSASStore();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [regFirstname, setRegFirstname] = useState('');
  const [regLastname, setRegLastname] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('nurse');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
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
        setLoginError(data.detail || 'เข้าสู่ระบบล้มเหลว ตรวจสอบ Username/Password');
        return;
      }

      localStorage.setItem('rtsas_token', data.access_token);
      setAuthUser(data.user, data.access_token);
      showToast(`เข้าสู่ระบบสำเร็จ: ยินดีต้อนรับ ${data.user.firstname} ${data.user.lastname}`, 'success', 3000);
      onClose();
    } catch {
      // Graceful offline fallback demo login if backend is not running
      const fallbackUser = {
        id: 1,
        username: loginUsername.trim(),
        firstname: loginUsername.trim(),
        lastname: '(ออฟไลน์)',
        role: 'nurse' as UserRole,
        is_active: true,
        name: `${loginUsername.trim()} (ออฟไลน์)`,
      };
      setAuthUser(fallbackUser, 'mock_offline_token');
      showToast(`เข้าสู่ระบบ (โหมดออฟไลน์): ยินดีต้อนรับ ${fallbackUser.name}`, 'info', 3000);
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
      setRegError('กรุณากรอกชื่อและนามสกุล');
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
        setRegError(data.detail || 'สมัครสมาชิกไม่สำเร็จ');
        return;
      }

      setRegSuccess(`สร้างบัญชีสำเร็จ! เข้าสู่ระบบด้วย Username: ${regUsername}`);
      showToast('สมัครสมาชิกสำเร็จแล้ว! กรุณาเข้าสู่ระบบ', 'success', 4000);
      setTimeout(() => {
        setMode('login');
        setLoginUsername(regUsername);
        setLoginPassword('');
        setRegSuccess('');
      }, 1200);
    } catch {
      // Offline fallback registration
      setRegSuccess(`สร้างบัญชีจำลอง (${regFirstname} ${regLastname}) สำเร็จ!`);
      showToast('สมัครสมาชิก (โหมดออฟไลน์) สำเร็จ!', 'success', 3000);
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
      className="fixed inset-0 z-[1000] flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-[460px] max-w-[95vw] overflow-hidden shadow-2xl animate-slideUp relative"
        style={{ border: '1px solid #cbd5e1' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, #1e40af 0%, #0284c7 100%)',
          color: '#fff',
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl shadow-inner">
                🏥
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight text-white">
                  ระบบ RTSAS โรงพยาบาลบางคล้า
                </h3>
                <p className="text-xs text-blue-100 font-medium">
                  {mode === 'login' ? 'เข้าสู่ระบบเพื่อบันทึกและจัดการ Sepsis Bundle' : 'ลงทะเบียนผู้ใช้งานใหม่ (แพทย์/พยาบาล/IT)'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-all"
            >
              ✕
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-black/20 p-1 rounded-xl mt-4 gap-1">
            <button
              type="button"
              onClick={() => { setMode('login'); setLoginError(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              🔐 เข้าสู่ระบบ (Login)
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setRegError(''); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white text-blue-700 shadow'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              📝 สมัครสมาชิก (Register)
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* ─── LOGIN FORM ─── */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
              {loginError && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  color: '#dc2626', fontSize: '12px', fontWeight: 600,
                }}>
                  ⚠️ {loginError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="เช่น doctor_somchai"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  รหัสผ่าน (Password)
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #0891b2)',
                  opacity: loginLoading ? 0.7 : 1,
                }}
              >
                {loginLoading ? '⏳ กำลังเข้าสู่ระบบ...' : '🔐 เข้าสู่ระบบ'}
              </button>

              <div className="text-center mt-2 text-xs text-slate-500">
                ยังไม่มีบัญชีผู้ใช้?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  สมัครสมาชิกที่นี่
                </button>
              </div>
            </form>
          ) : (
            /* ─── REGISTER FORM ─── */
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              {regError && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: '#fef2f2', border: '1px solid #fca5a5',
                  color: '#dc2626', fontSize: '12px', fontWeight: 600,
                }}>
                  ⚠️ {regError}
                </div>
              )}

              {regSuccess && (
                <div style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: '#f0fdf4', border: '1px solid #86efac',
                  color: '#16a34a', fontSize: '12px', fontWeight: 600,
                }}>
                  ✅ {regSuccess}
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อ (Firstname)
                  </label>
                  <input
                    type="text"
                    value={regFirstname}
                    onChange={(e) => setRegFirstname(e.target.value)}
                    placeholder="สมพงษ์"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    นามสกุล (Lastname)
                  </label>
                  <input
                    type="text"
                    value={regLastname}
                    onChange={(e) => setRegLastname(e.target.value)}
                    placeholder="ใจมั่นคง"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Role Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ตำแหน่ง / บทบาท (Role Dropdown)
                </label>
                <div className="relative">
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white appearance-none cursor-pointer focus:outline-none focus:border-blue-500"
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.icon} {opt.label} — ({opt.desc})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    ▼
                  </div>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="เช่น somchai_nurse"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รหัสผ่าน
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ยืนยันรหัสผ่าน
                  </label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #059669, #0284c7)',
                  opacity: regLoading ? 0.7 : 1,
                }}
              >
                {regLoading ? '⏳ กำลังบันทึกข้อมูล...' : '📝 ลงทะเบียนผู้ใช้'}
              </button>

              <div className="text-center mt-1 text-xs text-slate-500">
                มีบัญชีอยู่แล้ว?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-blue-600 font-bold hover:underline"
                >
                  เข้าสู่ระบบที่นี่
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
