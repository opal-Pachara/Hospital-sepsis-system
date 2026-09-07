import { useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { UserRole } from '../store/useRTSASStore';
import { showToast } from './Toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const roleOptions: { value: UserRole; label: string; icon: string; desc: string }[] = [
  { value: 'doctor',   label: 'แพทย์',          icon: '🩺', desc: 'ยืนยันการวินิจฉัย' },
  { value: 'nurse',    label: 'พยาบาล',          icon: '💉', desc: 'Sepsis Bundle & Vitals' },
  { value: 'it_admin', label: 'เจ้าหน้าที่ IT',  icon: '💻', desc: 'จัดการระบบและ Users' },
];

type PageMode = 'login' | 'register';

export default function LoginPage() {
  const { setAuthUser } = useRTSASStore();
  const [mode, setMode] = useState<PageMode>('login');

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

  // ── Login ──────────────────────────────────────────────────────────────
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
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.detail || 'เข้าสู่ระบบล้มเหลว');
        return;
      }
      // Store JWT in localStorage for persistence across refreshes
      localStorage.setItem('rtsas_token', data.access_token);
      // Update Zustand store
      setAuthUser(data.user, data.access_token);
      showToast(`ยินดีต้อนรับ ${data.user.firstname} ${data.user.lastname}!`, 'success', 3000);
    } catch {
      setLoginError('ไม่สามารถเชื่อมต่อ Server ได้ — ตรวจสอบ Backend');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Register ───────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regFirstname.trim() || !regLastname.trim()) { setRegError('กรุณากรอกชื่อและนามสกุล'); return; }
    if (!regUsername.trim() || regUsername.trim().length < 4) { setRegError('Username ต้องมีอย่างน้อย 4 ตัวอักษร'); return; }
    if (regPassword.length < 6) { setRegError('Password ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    if (regPassword !== regConfirmPassword) { setRegError('Password ไม่ตรงกัน'); return; }

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
        setRegError(data.detail || 'สมัครล้มเหลว');
        return;
      }
      setRegSuccess(`สร้างบัญชีสำเร็จ! กรุณาเข้าสู่ระบบด้วย Username: ${regUsername}`);
      showToast('สร้างบัญชีสำเร็จแล้ว!', 'success', 4000);
      setTimeout(() => {
        setLoginUsername(regUsername.trim());
        setRegFirstname(''); setRegLastname(''); setRegUsername('');
        setRegPassword(''); setRegConfirmPassword('');
        setMode('login');
      }, 1500);
    } catch {
      setRegError('ไม่สามารถเชื่อมต่อ Server ได้ — ตรวจสอบ Backend');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0c4a6e 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: "'Inter', 'Segoe UI', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(8,145,178,0.1) 0%, transparent 50%)',
      }} />

      {/* Floating particles (decorative) */}
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${[8,12,6,10,8,14][i]}px`,
          height: `${[8,12,6,10,8,14][i]}px`,
          borderRadius: '50%',
          background: `rgba(${['37,99,235','8,145,178','16,185,129','37,99,235','8,145,178','16,185,129'][i]}, 0.15)`,
          top: `${[15,65,35,80,20,55][i]}%`,
          left: `${[10,85,25,70,55,40][i]}%`,
          animation: 'none',
        }} />
      ))}

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '460px',
        background: 'rgba(255,255,255,0.98)',
        borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 25px 60px -10px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #0891b2)',
          padding: '24px 28px 20px', color: '#fff', textAlign: 'center',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '6px' }}>🏥</div>
          <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.3px' }}>
            ระบบแจ้งเตือนภาวะติดเชื้อในกระแสเลือด
          </div>
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
            RTSAS · โรงพยาบาลบางคล้า · เฉพาะภายใน LAN โรงพยาบาลเท่านั้น
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderBottom: '1px solid #dde3ed' }}>
          {(['login', 'register'] as PageMode[]).map((m) => (
            <button key={m} onClick={() => { setMode(m); setLoginError(''); setRegError(''); setRegSuccess(''); }}
              style={{
                flex: 1, padding: '12px 0', fontSize: '12px', fontWeight: 700,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#2563eb' : '#64748b',
                borderBottom: mode === m ? '2px solid #2563eb' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {m === 'login' ? '🔐 เข้าสู่ระบบ' : '📝 สมัครใช้งาน'}
            </button>
          ))}
        </div>

        {/* ── LOGIN FORM ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ padding: '24px 28px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Username</label>
              <input id="login-username" type="text" autoComplete="username" autoFocus
                value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="กรอก Username" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Password</label>
              <input id="login-password" type="password" autoComplete="current-password"
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="กรอก Password" style={inputStyle} />
            </div>

            {loginError && <div style={errorStyle}>⚠ {loginError}</div>}

            <button id="login-submit-btn" type="submit" disabled={loginLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, border: 'none',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                color: '#fff', fontFamily: 'inherit',
                background: loginLoading ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #0891b2)',
                boxShadow: loginLoading ? 'none' : '0 4px 14px -2px rgba(37,99,235,.4)',
                transition: 'all 0.2s',
              }}
            >
              {loginLoading ? '⌛ กำลังตรวจสอบ...' : '🔐 เข้าสู่ระบบ'}
            </button>

            <div style={{
              marginTop: '16px', padding: '10px 12px',
              background: '#f0f9ff', border: '1px solid #bae6fd',
              borderRadius: '8px', fontSize: '10px', color: '#0369a1',
              textAlign: 'center', lineHeight: 1.7,
            }}>
              ยังไม่มีบัญชี? กด <strong>"สมัครใช้งาน"</strong> ด้านบน<br />
              <span style={{ color: '#64748b' }}>ระบบนี้ใช้งานเฉพาะภายใน LAN โรงพยาบาลบางคล้า</span>
            </div>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ padding: '24px 28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>ชื่อจริง *</label>
                <input id="reg-firstname" type="text"
                  value={regFirstname} onChange={(e) => setRegFirstname(e.target.value)}
                  placeholder="เช่น สมชาย" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>นามสกุล *</label>
                <input id="reg-lastname" type="text"
                  value={regLastname} onChange={(e) => setRegLastname(e.target.value)}
                  placeholder="เช่น ใจดี" style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>ตำแหน่ง / บทบาท *</label>
              <select id="reg-role" value={regRole} onChange={(e) => setRegRole(e.target.value as UserRole)}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.icon} {r.label} — {r.desc}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Username *</label>
              <input id="reg-username" type="text" autoComplete="username"
                value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                placeholder="อย่างน้อย 4 ตัวอักษร" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={labelStyle}>Password *</label>
                <input id="reg-password" type="password" autoComplete="new-password"
                  value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="อย่างน้อย 6 ตัว" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ยืนยัน Password *</label>
                <input id="reg-confirm-password" type="password" autoComplete="new-password"
                  value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="กรอกซ้ำ" style={inputStyle} />
              </div>
            </div>

            {regError && <div style={errorStyle}>⚠ {regError}</div>}
            {regSuccess && (
              <div style={{
                marginBottom: '14px', padding: '10px 12px',
                background: '#f0fdf4', border: '1px solid #86efac',
                borderRadius: '8px', fontSize: '11px', color: '#16a34a', fontWeight: 600,
              }}>✅ {regSuccess}</div>
            )}

            <button id="reg-submit-btn" type="submit" disabled={regLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px',
                fontSize: '13px', fontWeight: 700, border: 'none',
                cursor: regLoading ? 'not-allowed' : 'pointer',
                color: '#fff', fontFamily: 'inherit',
                background: regLoading ? '#94a3b8' : 'linear-gradient(135deg, #16a34a, #0d9488)',
                boxShadow: regLoading ? 'none' : '0 4px 14px -2px rgba(22,163,74,.35)',
              }}
            >
              {regLoading ? '⌛ กำลังสร้างบัญชี...' : '📝 สร้างบัญชีใหม่'}
            </button>

            <div style={{ marginTop: '12px', fontSize: '9px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
              บัญชีจะถูกบันทึกใน Auth Database ของระบบ (MySQL ใน Docker)<br />
              Production ใช้ระบบภายในโรงพยาบาล เชื่อมผ่าน LAN Network
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#475569',
  display: 'block', marginBottom: '5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '9px',
  border: '1px solid #dde3ed', fontSize: '12px',
  fontFamily: 'inherit', outline: 'none',
  background: '#f8fafc', boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  marginBottom: '14px', padding: '8px 12px',
  background: '#fef2f2', border: '1px solid #fca5a5',
  borderRadius: '8px', fontSize: '11px', color: '#dc2626', fontWeight: 600,
};
