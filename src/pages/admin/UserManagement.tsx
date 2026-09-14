import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import { showToast } from '../../components/common/Toast';
import { extractErrorMessage } from '../../utils/errorUtils';

interface UserRecord {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  role: 'doctor' | 'nurse' | 'it_admin';
  is_active: boolean;
  created_at: string;
}

const roleBadge = (role: string) => {
  if (role === 'doctor') return { label: '🩺 แพทย์', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' };
  if (role === 'nurse') return { label: '💉 พยาบาล', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
  return { label: '💻 IT Admin', bg: '#f5f3ff', color: '#6d28d9', border: '#c4b5fd' };
};

export function UserManagement() {
  const { authToken, authUser } = useRTSASStore();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null);

  // Add User Form State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newFirstname, setNewFirstname] = useState<string>('');
  const [newLastname, setNewLastname] = useState<string>('');
  const [newRole, setNewRole] = useState<'doctor' | 'nurse' | 'it_admin'>('nurse');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: authToken ? `Bearer ${authToken}` : '',
    }),
    [authToken]
  );

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/auth/users', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else if (res.status === 401 || res.status === 403) {
        // Not authenticated yet
        setUsers([]);
      }
    } catch {
      // Offline / error
    } finally {
      setIsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDeactivate = async (userId: number, username: string) => {
    setDeactivatingId(userId);
    try {
      const res = await fetch(`/auth/users/${userId}/deactivate`, {
        method: 'PUT',
        headers: authHeaders,
      });
      if (res.ok) {
        showToast(`✅ ระงับการใช้งาน @${username} แล้ว`, 'success');
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      showToast('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน', 'error');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          firstname: newFirstname.trim(),
          lastname: newLastname.trim(),
          role: newRole,
        }),
      });

      if (res.ok) {
        showToast(`✅ สร้างบัญชี @${newUsername} สำเร็จ`, 'success');
        setShowAddModal(false);
        setNewUsername('');
        setNewPassword('');
        setNewFirstname('');
        setNewLastname('');
        loadUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(extractErrorMessage(err.detail, 'ไม่สามารถสร้างผู้ใช้งานได้'), 'error');
      }
    } catch {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.firstname.toLowerCase().includes(q) ||
        u.lastname.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header Info */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0 shadow-md shadow-blue-500/25">
            👥
          </div>
          <div>
            <div className="text-base font-black text-slate-800">
              จัดการผู้ใช้งานและสิทธิ์บุคลากร (User & Role Management)
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              จัดการบัญชีแพทย์, พยาบาล ER และผู้ดูแลระบบ IT Admin ทั้งหมดในระบบ RTSAS
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-all shadow-md shadow-blue-500/25 flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>เพิ่มผู้ใช้งานใหม่</span>
        </button>
      </div>

      {/* User Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
        {/* Search Bar */}
        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            placeholder="🔍 ค้นหาตามชื่อ, Username หรือบทบาท..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-sm text-xs px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 transition-colors"
          />
          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
            ทั้งหมด {filteredUsers.length} รายการ
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-slate-400">กำลังโหลดรายชื่อผู้ใช้...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              {users.length === 0
                ? 'ยังไม่มีรายชื่อผู้ใช้งาน หรือยังไม่ได้เข้าสู่ระบบ IT Admin'
                : 'ไม่พบบัญชีผู้ใช้ที่ตรงกับคำค้นหา'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase">
                  <th className="pb-3 pl-2">ชื่อผู้ใช้ (Username)</th>
                  <th className="pb-3">ชื่อ - สกุล</th>
                  <th className="pb-3">บทบาท (Role)</th>
                  <th className="pb-3">สถานะ</th>
                  <th className="pb-3">วันที่สร้าง</th>
                  <th className="pb-3 text-right pr-2">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const badge = roleBadge(u.role);
                  const isCurrent = authUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pl-2 font-mono font-bold text-slate-800">
                        @{u.username}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold">
                            คุณ
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-700 font-medium">
                        {u.firstname} {u.lastname}
                      </td>
                      <td className="py-3">
                        <span
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.is_active ? 'เปิดใช้งาน' : 'ระงับการใช้งาน'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 text-[11px] font-mono">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td className="py-3 text-right pr-2">
                        {!isCurrent && u.is_active && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u.id, u.username)}
                            disabled={deactivatingId === u.id}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg text-red-600 hover:bg-red-50 border border-red-200 cursor-pointer transition-colors"
                          >
                            {deactivatingId === u.id ? '⏳...' : 'ระงับสิทธิ์'}
                          </button>
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

      {/* ─── Add User Modal ─── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(10, 10, 20, 0.65)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-white rounded-2xl w-[480px] max-w-[90vw] overflow-hidden shadow-2xl border border-slate-200 animate-slideUp">
            <div className="h-1.5 bg-gradient-to-r from-blue-600 to-indigo-600" />
            <form onSubmit={handleCreateUser} className="p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span>➕</span> เพิ่มผู้ใช้งานใหม่
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    ชื่อผู้ใช้ (Username) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. nurse_er01"
                    className="w-full text-xs font-mono px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    รหัสผ่าน (Password) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">ชื่อ</label>
                  <input
                    type="text"
                    value={newFirstname}
                    onChange={(e) => setNewFirstname(e.target.value)}
                    placeholder="ชื่อจริง"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">นามสกุล</label>
                  <input
                    type="text"
                    value={newLastname}
                    onChange={(e) => setNewLastname(e.target.value)}
                    placeholder="นามสกุล"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">บทบาทหน้าที่ (Role)</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="nurse">💉 พยาบาล (Nurse)</option>
                  <option value="doctor">🩺 แพทย์ (Doctor)</option>
                  <option value="it_admin">💻 ผู้ดูแลระบบ (IT Admin)</option>
                </select>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-md shadow-blue-500/25"
                >
                  {isCreating ? 'กำลังบันทึก...' : 'บันทึกผู้ใช้'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
