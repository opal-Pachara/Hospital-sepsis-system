import { useEffect } from 'react';
import { useRTSASStore } from './store/useRTSASStore';
import { MOCK_PATIENTS } from './data/mockData';
import { useAssessmentReminders } from './hooks/useTimers';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PatientInfoBar from './components/PatientInfoBar';
import VitalSignsGrid from './components/VitalSignsGrid';
import NewsCalculationLogic from './components/NewsCalculationLogic';
import CountdownBanner from './components/CountdownBanner';
import ChecklistPanel from './components/ChecklistPanel';
import TimelinePanel from './components/TimelinePanel';
import AlertModal from './components/AlertModal';
import ReminderModal from './components/ReminderModal';
import AssessmentFormModal from './components/AssessmentFormModal';
import StatusBar from './components/StatusBar';
import { ToastContainer } from './components/Toast';

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl opacity-30">👤</span>
        </div>
        <h3 className="text-lg font-semibold text-text-secondary mb-1">เลือกผู้ป่วย</h3>
        <p className="text-sm text-text-muted max-w-xs">
          เลือกผู้ป่วยจากรายชื่อด้านซ้าย เพื่อดูสัญญาณชีพ คะแนน NEWS และจัดการ Sepsis Workflow
        </p>
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

  const unreadTimelineCount = timeline.length;

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
          {ui.activeTab !== 'timeline' && unreadTimelineCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
              style={{ background: '#dbeafe', color: '#2563eb' }}>
              {unreadTimelineCount > 9 ? '9+' : unreadTimelineCount}
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
  const { setPatients, selectPatient, addTimelineEvent } = useRTSASStore();

  // Wire up assessment reminder auto-triggering
  useAssessmentReminders();

  useEffect(() => {
    // Initialize with mock data
    setPatients(MOCK_PATIENTS);

    // Auto-select the highest risk patient
    if (MOCK_PATIENTS.length > 0) {
      const highestRisk = [...MOCK_PATIENTS].sort(
        (a, b) => b.latestNewsScore - a.latestNewsScore
      )[0];
      selectPatient(highestRisk.id);

      // Add initial system event
      addTimelineEvent(
        `🏥 เลือกผู้ป่วย ${highestRisk.fullName} — NEWS: ${highestRisk.latestNewsScore}`,
        highestRisk.latestNewsScore >= 7 ? 'red' : highestRisk.latestNewsScore >= 5 ? 'orange' : 'green',
        'System'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface-base">
      <Header />

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT — Sidebar (Patient List) */}
        <Sidebar />

        {/* MAIN CONTENT — Workflow (center) + Detail (right) */}
        <main className="flex-1 flex overflow-hidden min-h-0">
          {/* CENTER — Checklist/Timeline */}
          <WorkflowPanel />

          {/* RIGHT — Patient Detail + Vitals + NEWS */}
          <DetailPanel />

          {/* Show empty state if no patient selected */}
          {!useRTSASStore.getState().selectedPatient && <EmptyState />}
        </main>
      </div>

      {/* BOTTOM — Status Bar + Demo */}
      <StatusBar />

      {/* Modals */}
      <AlertModal />
      <ReminderModal />
      <AssessmentFormModal />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
