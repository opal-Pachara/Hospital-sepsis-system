import { useEffect, useState, useCallback } from 'react';
import { useRTSASStore, isTreatmentTimelineEvent, isHistoricalPatient } from './store/useRTSASStore';
import { useAssessmentReminders, useGlobalCountdownTicker } from './hooks/useTimers';
import { usePatientData, useWebSocketAlerts } from './hooks/useBackend';
// Layout & Navigation
import { Header, Sidebar, StatusBar } from './components/layout';

// Clinical Panels
import {
  PatientInfoBar,
  VitalSignsGrid,
  NewsCalculationLogic,
  ChecklistPanel,
  TimelinePanel,
} from './components/panels';

// Modals
import {
  AlertModal,
  ReminderModal,
  AssessmentFormModal,
  MultiAlertModal,
  SepsisConfirmModal,
  GlobalAuthModal,
} from './components/modals';

// Common UI & Feedback
import {
  ToastContainer,
  LoadingSkeleton,
  ErrorBanner,
  CountdownBanner,
  AlertSummaryBanner,
  showToast,
} from './components/common';

// Pages
import { AdminPage, AdminLayout, type AdminTab, TreatedDashboard } from './pages';

const API_BASE = import.meta.env.VITE_API_URL || '';

export type AppView = 'dashboard' | 'admin' | 'treated_dashboard';

function parseUrlRoute(): { view: AppView; adminTab: AdminTab } {
  const path = window.location.pathname;
  if (path.startsWith('/admin')) {
    const sub = path.replace('/admin', '').replace(/^\//, '');
    let tab: AdminTab = 'status';
    if (sub === 'cleaner' || sub === 'alerts' || sub === 'failover' || sub === 'users' || sub === 'status') {
      tab = sub as AdminTab;
    }
    return { view: 'admin', adminTab: tab };
  }
  if (path.startsWith('/treated-dashboard')) {
    return { view: 'treated_dashboard', adminTab: 'status' };
  }
  return { view: 'dashboard', adminTab: 'status' };
}

function EmptyState() {
  const patients = useRTSASStore((s) => s.patients);
  const hasPatients = patients && patients.length > 0;

  return (
    <div className="flex-1 w-full h-full min-w-0 flex flex-col items-center justify-center p-6 md:p-10 bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9]/60 to-[#e2e8f0]/40 relative overflow-hidden select-none">
      {/* Subtle background ambient dot pattern */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main Empty State Card */}
      <div
        className="relative z-10 w-full bg-white/95 backdrop-blur-sm border border-slate-400/90 rounded-2xl p-8 shadow-xl shadow-slate-200/60 text-center transition-all flex-shrink-0 flex flex-col items-stretch"
        style={{ width: '150%' ,height: '22%', maxWidth: '540px', minWidth: '420px' }}
      >
        {/* Top Accent Line */}
        {/* <div className="absolute top-0 left-8 right-8 h-1 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400" /> */}

        {/* Icon with pulsing badge */}
        <div className="flex justify-center mb-5">
          <div className="relative inline-flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-xs border ${
                hasPatients
                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200/80 text-blue-600'
                  : 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200/80 text-emerald-600'
              }`}
            >
              {hasPatients ? '📋' : '🏥'}
            </div>
            {/* {hasPatients && (
              <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-black text-white ring-4 ring-white shadow-xs">
              </span>
            )} */}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-slate-800 mb-2 tracking-tight text-center">
          {hasPatients ? 'ยังไม่เลือกใครมารักษา' : 'ไม่มีผู้ป่วยที่จุดคัดกรอง ER ในขณะนี้'}
        </h3>

        {/* Description */}
        <p
          className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 text-center"
          style={{ width: '100%', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}
        >
          {hasPatients
            ? 'กรุณาคลิกเลือกผู้ป่วยจากแถบรายชื่อด้านซ้าย เพื่อตรวจสอบสัญญาณชีพ คะแนน NEWS และเริ่มกระบวนการรักษา Sepsis'
            : 'ระบบกำลังเชื่อมต่อฐานข้อมูล HOSxP MySQL (Sync ทุก 10 วินาที) รอรับข้อมูลสัญญาณชีพและผู้ป่วยรายใหม่จากจุดคัดกรอง ER โดยอัตโนมัติ'}
        </p>

        {/* Interactive / Guidance Cue */}
        

        {/* Quick Feature Checklist / Highlights */}
      </div>
    </div>
  );
}

/**
 * Detail Panel (RIGHT) — Patient Info + Vitals + NEWS
 * ตำแหน่ง: ขวาสุด (order: 2)
 */
function DetailPanel() {
  const selectedPatient = useRTSASStore((s) => s.selectedPatient);

  if (!selectedPatient || !selectedPatient.latestNewsResult) return null;

  return (
    <div className="detail-panel-col">
      <div className="detail-panel-col-inner">
        <PatientInfoBar patient={selectedPatient} />
        <VitalSignsGrid newsResult={selectedPatient.latestNewsResult} />
        <NewsCalculationLogic newsResult={selectedPatient.latestNewsResult} />
      </div>
    </div>
  );
}

/**
 * Workflow Panel (CENTER) — Countdown + Checklist/Timeline tabs
 * ตำแหน่ง: กลาง (order: 1)
 */
function WorkflowPanel() {
  const { selectedPatient, ui, setActiveTab, timeline } = useRTSASStore();

  if (!selectedPatient) return null;

  const treatmentCount = (timeline || []).filter(isTreatmentTimelineEvent).length;

  return (
    <div className="workflow-panel-col">
      {/* Countdown Banner — show only when active */}
      <CountdownBanner />

      {/* Tabs */}
      <div className="flex border-b border-border-default flex-shrink-0">
        <button
          id="tab-checklist"
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 py-2.5 text-[11px] font-semibold cursor-pointer transition-all relative border-b-2 ${
            ui.activeTab === 'checklist'
              ? 'text-brand-primary border-brand-primary'
              : 'text-text-muted hover:text-text-secondary border-transparent'
          }`}
          style={{ background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontFamily: 'inherit' }}
        >
          ☑ Checklist
        </button>
        <button
          id="tab-timeline"
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-2.5 text-[11px] font-semibold cursor-pointer transition-all relative border-b-2 ${
            ui.activeTab === 'timeline'
              ? 'text-brand-primary border-brand-primary'
              : 'text-text-muted hover:text-text-secondary border-transparent'
          }`}
          style={{ background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', fontFamily: 'inherit' }}
        >
          📅 Timeline
          {treatmentCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center px-1.5 h-4 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700">
              {treatmentCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {ui.activeTab === 'checklist' ? <ChecklistPanel /> : <TimelinePanel />}
      </div>
    </div>
  );
}

export default function App() {
  const { setAuthUser, isAuthenticated, currentUser, logoutUser } = useRTSASStore();
  const initialRoute = parseUrlRoute();
  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [adminTab, setAdminTab] = useState<AdminTab>(initialRoute.adminTab);

  const navigate = useCallback((view: AppView, tab?: AdminTab) => {
    if (view === 'treated_dashboard') {
      const user = useRTSASStore.getState().currentUser;
      const isAuth = useRTSASStore.getState().isAuthenticated;
      const isDocNurse = isAuth && (user?.role === 'doctor' || user?.role === 'nurse');
      if (!isDocNurse) {
        showToast('เฉพาะแพทย์และพยาบาลเท่านั้นที่สามารถเข้าถึงระบบ Dashboard ได้ กรุณาเข้าสู่ระบบ', 'warning');
        return;
      }
    }
    setCurrentView(view);
    if (view === 'admin') {
      const targetTab = tab || adminTab || 'status';
      setAdminTab(targetTab);
      window.history.pushState({ view, tab: targetTab }, '', `/admin/${targetTab}`);
    } else if (view === 'treated_dashboard') {
      window.history.pushState({ view }, '', '/treated-dashboard');
    } else {
      window.history.pushState({ view }, '', '/');
    }
  }, [adminTab]);

  // IT Admin isolation: ensure IT Admin is always routed directly to admin panel
  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'it_admin' && currentView !== 'admin') {
      setCurrentView('admin');
      window.history.pushState({ view: 'admin' }, '', '/admin');
    }
  }, [isAuthenticated, currentUser?.role, currentView]);

  // Restrict treated dashboard viewing to authenticated doctor or nurse
  useEffect(() => {
    const isDocNurse = isAuthenticated && (currentUser?.role === 'doctor' || currentUser?.role === 'nurse');
    if (currentView === 'treated_dashboard' && !isDocNurse) {
      setCurrentView('dashboard');
      window.history.pushState({ view: 'dashboard' }, '', '/');
      showToast('เฉพาะแพทย์และพยาบาลเท่านั้นที่สามารถเข้าถึงระบบ Dashboard ได้ กรุณาเข้าสู่ระบบ', 'warning');
    }
  }, [currentView, isAuthenticated, currentUser?.role]);

  useEffect(() => {
    const handlePopState = () => {
      const route = parseUrlRoute();
      setCurrentView(route.view);
      setAdminTab(route.adminTab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleBackToClinical = useCallback(() => {
    navigate('dashboard');
  }, [navigate]);

  const handleSelectPatientTimeline = useCallback(async (patientId: string) => {
    await useRTSASStore.getState().selectPatientAsync(patientId, true);
    useRTSASStore.getState().setActiveTab('timeline');
    navigate('dashboard');
  }, [navigate]);

  // Auto-login: validate stored JWT on mount
  useEffect(() => {
    if (isAuthenticated) return;
    const token = localStorage.getItem('rtsas_token');
    if (!token) return;
    // Verify token with backend
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((user) => {
        setAuthUser(
          { ...user, name: `${user.firstname} ${user.lastname}` },
          token
        );
        if (user.role === 'it_admin') {
          setCurrentView('admin');
          window.history.pushState({ view: 'admin' }, '', '/admin');
        }
      })
      .catch(() => localStorage.removeItem('rtsas_token'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire up assessment reminder auto-triggering
  useAssessmentReminders();
  useGlobalCountdownTicker();

  // --- Real-time backend integration ---
  // 1. Initial HTTP fetch + 60s refresh from GET /api/patients
  const { fetchPatients } = usePatientData();
  // 2. WebSocket connection for real-time alerts from /ws/alerts
  useWebSocketAlerts();

  const selectedPatient = useRTSASStore((s) => s.selectedPatient);
  const isHistorical = useRTSASStore((s) => isHistoricalPatient(s.selectedPatient, s.patientData));
  const currentData = useRTSASStore((s) => (s.selectedPatient ? s.patientData[s.selectedPatient.id] : null));
  const isLoading = useRTSASStore((s) => s.ui.isLoading);

  if (isLoading) {
    return (
      <>
        <ErrorBanner fetchPatients={fetchPatients} />
        <LoadingSkeleton />
      </>
    );
  }

  // ─── Admin Panel View ───
  if (currentView === 'admin') {
    return (
      <>
        <AdminPage
          onBack={() => {
            logoutUser();
            setCurrentView('dashboard');
            window.history.pushState({ view: 'dashboard' }, '', '/');
          }}
        />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-base relative">
      <AlertSummaryBanner />
      <ErrorBanner fetchPatients={fetchPatients} />

      <Header onNavigateAdmin={() => navigate('admin', 'status')} />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT — Sidebar (Patient List) */}
        <Sidebar
          onRefresh={() => fetchPatients(true)}
          onNavigateTreatedDashboard={() => navigate('treated_dashboard')}
          onNavigateClinical={() => navigate('dashboard')}
        />

        {/* MAIN CONTENT — Workflow (center) + Detail (right) OR Treated Dashboard */}
        {currentView === 'treated_dashboard' && (isAuthenticated && (currentUser?.role === 'doctor' || currentUser?.role === 'nurse')) ? (
          <TreatedDashboard
            onBackToClinical={handleBackToClinical}
            onSelectPatientTimeline={handleSelectPatientTimeline}
          />
        ) : (
          <main className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Historical Patient Archive Top Banner */}
            {selectedPatient && isHistorical && (
              <div
                id="historical-patient-banner"
                className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-900 flex-shrink-0"
                style={{ zIndex: 15 }}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                    🔒 แฟ้มประวัติการรักษาย้อนหลัง (โหมดอ่านอย่างเดียว)
                  </span>
                  <span className="text-[11px] text-amber-900">
                    HN: <strong>{selectedPatient.hn}</strong> | เวลามาถึง ER: {new Date(selectedPatient.arrivalTime).toLocaleString('th-TH')}
                    {currentData?.treatmentCompleted && ' | ✅ สิ้นสุดการรักษาแล้ว'}
                    {currentData?.sepsisRuledOut && ' | 🟢 แพทย์ Rule Out Sepsis'}
                  </span>
                  <span className="text-[10px] text-amber-700">
                    (ล็อคการแก้ไขเพื่อรักษาความถูกต้องของข้อมูลตามกฎหมายเวชระเบียน)
                  </span>
                </div>
                <button
                  type="button"
                  id="btn-back-to-treated-dashboard"
                  onClick={() => navigate('treated_dashboard')}
                  className="text-xs font-semibold px-3 py-1 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-amber-900 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <span>←</span> กลับหน้ารายงานผู้ป่วยที่รักษาแล้ว
                </button>
              </div>
            )}

            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* CENTER — Checklist/Timeline */}
              <WorkflowPanel />

              {/* RIGHT — Patient Detail + Vitals + NEWS */}
              <DetailPanel />

              {/* Show empty state if no patient selected */}
              {!selectedPatient && <EmptyState />}
            </div>
          </main>
        )}
      </div>

      {/* BOTTOM — Status Bar + Demo */}
      <StatusBar />

      {/* Modals */}
      <AlertModal />
      <MultiAlertModal />
      <ReminderModal />
      <AssessmentFormModal />
      <SepsisConfirmModal />
      <GlobalAuthModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
