import { useState } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';
import type { UserRole } from '../store/useRTSASStore';

const roleOptions: { value: UserRole; label: string; icon: string }[] = [
  { value: 'doctor', label: 'แพทย์', icon: '🩺' },
  { value: 'nurse', label: 'พยาบาล', icon: '💉' },
  { value: 'researcher', label: 'ผู้วิจัย', icon: '🔬' },
  { value: 'it_admin', label: 'เจ้าหน้าที่ IT', icon: '💻' },
];

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Callback when authentication succeeds */
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const { authenticateUser } = useRTSASStore();
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('nurse');
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 4) {
      setError('กรุณาใส่ PIN 4 หลัก');
      return;
    }

    // Auto-generate display name from role
    const roleNameMap: Record<UserRole, string> = {
      doctor: 'แพทย์',
      nurse: 'พยาบาล',
      researcher: 'ผู้วิจัย',
      it_admin: 'เจ้าหน้าที่ IT',
    };
    const autoName = roleNameMap[role];

    const success = authenticateUser(pin, autoName, role);
    if (success) {
      setPin('');
      setError('');
      onSuccess?.();
      onClose();
    } else {
      setError('PIN ไม่ถูกต้อง');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl w-[420px] shadow-2xl overflow-hidden ${isShaking ? 'animate-shake' : ''}`}
        style={{ border: '1px solid #dde3ed' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #2563eb, #0891b2)',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700 }}>🔐 ยืนยันตัวตน</div>
          <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '4px' }}>
            เลือกบทบาทและระบุ PIN เพื่อเข้าสู่ระบบ
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {/* Role */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              บทบาท
            </label>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  style={{
                    padding: '8px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: role === opt.value ? '2px solid #2563eb' : '1px solid #dde3ed',
                    background: role === opt.value ? '#eff6ff' : '#f8fafc',
                    color: role === opt.value ? '#2563eb' : '#475569',
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* PIN */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              PIN (4 หลัก)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • •"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: error ? '2px solid #dc2626' : '1px solid #dde3ed',
                fontSize: '18px', fontFamily: 'inherit',
                letterSpacing: '8px', textAlign: 'center',
                outline: 'none', background: '#f8fafc',
              }}
            />
            {error && (
              <div style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600, marginTop: '4px' }}>
                ⚠ {error}
              </div>
            )}
          </div>

          {/* Demo hint */}
          <div style={{
            fontSize: '9px', color: '#94a3b8', textAlign: 'center',
            marginBottom: '14px', padding: '6px', borderRadius: '6px',
            background: '#f1f5f9', border: '1px solid #e2e8f0',
          }}>
            🧪 Demo Mode: PIN = <strong>1234</strong> &nbsp;|&nbsp; Production: ใช้ระบบ AD/LDAP ของโรงพยาบาล
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: '1px solid #dde3ed', background: '#f8fafc',
                color: '#64748b', fontFamily: 'inherit',
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              style={{
                flex: 2, padding: '10px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                border: 'none', color: '#fff', fontFamily: 'inherit',
                background: 'linear-gradient(135deg, #2563eb, #0891b2)',
                boxShadow: '0 4px 12px -2px rgba(37, 99, 235, .3)',
              }}
            >
              🔐 เข้าสู่ระบบ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
