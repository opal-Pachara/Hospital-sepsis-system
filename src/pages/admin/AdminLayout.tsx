import { useState, useEffect } from 'react';
import { useRTSASStore } from '../../store/useRTSASStore';
import { PatientSimulator } from './PatientSimulator';
import { DashboardCleaner } from './DashboardCleaner';
import { AlertSimulator } from './AlertSimulator';
import { DatabaseFailoverTester } from './DatabaseFailoverTester';
import { UserManagement } from './UserManagement';
import { showToast } from '../../components/common/Toast';

export type AdminTab = 'status' | 'patient_entry' | 'cleaner' | 'alerts' | 'failover' | 'users' | 'simulator';

interface AdminLayoutProps {
  initialTab?: AdminTab;
  onNavigateClinical: () => void;
  onNavigateTreatedDashboard: () => void;
  onTabChange?: (tab: AdminTab) => void;
}

export function AdminLayout({
  initialTab = 'status',
  onNavigateClinical,
  onNavigateTreatedDashboard,
  onTabChange,
}: AdminLayoutProps) {
  const normalizedInitial = (initialTab === 'simulator' || initialTab === 'failover') ? 'status' : initialTab;
  const [activeTab, setActiveTab] = useState<AdminTab>(normalizedInitial);
  const { authUser, isAuthenticated, setAuthUser, clearAuth } = useRTSASStore();
  const [isQuickLoggingIn, setIsQuickLoggingIn] = useState<boolean>(false);

  useEffect(() => {
    if (initialTab) {
      const norm = (initialTab === 'simulator' || initialTab === 'failover') ? 'status' : initialTab;
      setActiveTab(norm);
    }
  }, [initialTab]);

  const handleTabClick = (tab: AdminTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Quick dev/test login as it_admin
  const handleQuickLogin = async () => {
    setIsQuickLoggingIn(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'adminpassword',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthUser(data.user, data.access_token);
        localStorage.setItem('rtsas_token', data.access_token);
        showToast('⚡ เข้าสู่ระบบในฐานะ IT Admin สำเร็จ (Dev Mode)', 'success', 3000);
      } else {
        const mockAdmin = {
          id: 999,
          username: 'admin',
          firstname: 'ผู้ดูแลระบบ',
          lastname: 'IT Admin',
          role: 'it_admin' as const,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setAuthUser(mockAdmin, 'mock_admin_token');
        showToast('⚡ เข้าสู่ระบบในฐานะ IT Admin สำเร็จ (Local Mode)', 'success', 3000);
      }
    } catch {
      const mockAdmin = {
        id: 999,
        username: 'admin',
        firstname: 'ผู้ดูแลระบบ',
        lastname: 'IT Admin',
        role: 'it_admin' as const,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setAuthUser(mockAdmin, 'mock_admin_token');
      showToast('⚡ เข้าสู่ระบบในฐานะ IT Admin สำเร็จ (Local Mode)', 'success', 3000);
    } finally {
      setIsQuickLoggingIn(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    localStorage.removeItem('rtsas_token');
    showToast('ออกจากระบบเรียบร้อย', 'info');
  };

  return (
    <div
      id="admin-management-suite"
      className="flex-1 overflow-y-auto bg-surface-base"
      style={{ fontFamily: 'inherit', paddingBottom: '40px' }}
    >
      {/* ─── Top Sub-Header Bar ─── */}
      <div
        className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between flex-shrink-0 relative overflow-hidden"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
      >
        {/* Top gradient accent line (3px) */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #2563eb, #8b5cf6, #06b6d4)' }}
        />

        {/* Left: Title + Hospital Details */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-xs flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              border: '1px solid #bfdbfe',
              color: '#2563eb',
            }}
          >
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black text-slate-800 tracking-tight">
                ศูนย์จัดการและควบคุมระบบ RTSAS (Hospital IT Administration Suite)
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 uppercase">
                /admin URL Mode
              </span>
            </div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">
              โรงพยาบาลบางคล้า · จัดการการเชื่อมต่อฐานข้อมูล HOSxP MySQL, บันทึกเหตุการณ์สด (Live Logs), บริหารจัดการบัญชี และล้างระบบ
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5">
          {isAuthenticated && authUser?.role === 'it_admin' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                <span>💻</span>
                <span>@{authUser.username} (IT Admin)</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-red-600 font-bold px-2 py-1 cursor-pointer transition-colors"
                title="ออกจากระบบ"
              >
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <button
              type="button"
              id="btn-quick-admin-login"
              onClick={handleQuickLogin}
              disabled={isQuickLoggingIn}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 flex items-center gap-1.5 shadow-xs"
              title="เข้าสู่ระบบในฐานะ IT Admin"
            >
              <span>⚡</span>
              <span>{isQuickLoggingIn ? 'กำลังล็อกอิน...' : 'ล็อกอิน IT Admin ด่วน'}</span>
            </button>
          )}

          {/* Return to Clinical Bedside Button */}
          <button
            type="button"
            id="btn-back-to-clinical"
            onClick={onNavigateClinical}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-500/25"
          >
            <span>🏥</span>
            <span>กลับหน้าติดตามสด (ER Bedside)</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Container ─── */}
      <div style={{ padding: '16px 20px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ─── Navigation Bar ─── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto">
          {/* Tab 1: Status & DB Connection & Logs */}
          <button
            type="button"
            id="tab-status"
            onClick={() => handleTabClick('status')}
            className={`flex-1 min-w-[210px] py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 ${
              activeTab === 'status' || activeTab === 'failover'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>📡</span>
            <span>สถานะระบบ, ต่อ/ตัด DB จริง & Logs</span>
          </button>

          {/* Tab 2: Add Patient to DB */}
          <button
            type="button"
            id="tab-patient-entry"
            onClick={() => handleTabClick('patient_entry')}
            className={`flex-1 min-w-[190px] py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 ${
              activeTab === 'patient_entry' || activeTab === 'simulator'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>➕</span>
            <span>เพิ่มข้อมูลผู้ป่วยลงฐานข้อมูล</span>
          </button>

          {/* Tab 3: User Management */}
          <button
            type="button"
            id="tab-users"
            onClick={() => handleTabClick('users')}
            className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>👥</span>
            <span>จัดการผู้ใช้งาน (Users)</span>
          </button>

          {/* Tab 4: Cleaner & System Reset */}
          <button
            type="button"
            id="tab-cleaner"
            onClick={() => handleTabClick('cleaner')}
            className={`flex-1 min-w-[190px] py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 ${
              activeTab === 'cleaner'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>🧹</span>
            <span>จัดการข้อมูล & ล้างระบบ (Reset)</span>
          </button>

          {/* Tab 5: Audio & Alerts Diagnostics */}
          <button
            type="button"
            id="tab-alerts"
            onClick={() => handleTabClick('alerts')}
            className={`flex-1 min-w-[170px] py-2.5 px-4 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2 ${
              activeTab === 'alerts'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>🚨</span>
            <span>ระบบเสียงเตือน & การแจ้งเตือน</span>
          </button>
        </div>

        {/* ─── Active Tab Content View ─── */}
        <div className="transition-all">
          {(activeTab === 'status' || activeTab === 'failover') && (
            <DatabaseFailoverTester />
          )}

          {(activeTab === 'patient_entry' || activeTab === 'simulator') && (
            <PatientSimulator onNavigateClinical={onNavigateClinical} />
          )}

          {activeTab === 'users' && (
            <UserManagement />
          )}

          {activeTab === 'cleaner' && (
            <DashboardCleaner onNavigateTreatedDashboard={onNavigateTreatedDashboard} />
          )}

          {activeTab === 'alerts' && (
            <AlertSimulator />
          )}
        </div>
      </div>
    </div>
  );
}
