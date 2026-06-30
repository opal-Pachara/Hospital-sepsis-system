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
          <svg className="w-10 h-10 text-text-muted opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-secondary mb-1">Select a Patient</h3>
        <p className="text-sm text-text-muted max-w-xs">
          Choose a patient from the sidebar to view vitals, NEWS score, and manage the sepsis workflow.
        </p>
      </div>
    </div>
  );
}

function DetailPanel() {
  const selectedPatient = useRTSASStore((s) => s.selectedPatient);

  if (!selectedPatient || !selectedPatient.latestNewsResult) return <EmptyState />;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <PatientInfoBar patient={selectedPatient} />
      <VitalSignsGrid newsResult={selectedPatient.latestNewsResult} />
      <NewsCalculationLogic newsResult={selectedPatient.latestNewsResult} />
    </div>
  );
}

function WorkflowPanel() {
  const { selectedPatient, ui, setActiveTab, timeline } = useRTSASStore();

  if (!selectedPatient) return null;

  const unreadTimelineCount = timeline.length;

  return (
    <div className="w-[400px] flex-shrink-0 border-r border-border-default flex flex-col bg-surface-card/50">
      {/* Countdown Banner */}
      <div className="p-3 border-b border-border-default">
        <CountdownBanner />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default">
        <button
          id="tab-checklist"
          onClick={() => setActiveTab('checklist')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative ${
            ui.activeTab === 'checklist'
              ? 'text-brand-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Checklist
          </span>
          {ui.activeTab === 'checklist' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent rounded-full" />
          )}
        </button>
        <button
          id="tab-timeline"
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-all relative ${
            ui.activeTab === 'timeline'
              ? 'text-brand-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Timeline
            {ui.activeTab !== 'timeline' && unreadTimelineCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-brand-accent/20 text-brand-accent text-[10px] font-bold flex items-center justify-center">
                {unreadTimelineCount > 9 ? '9+' : unreadTimelineCount}
              </span>
            )}
          </span>
          {ui.activeTab === 'timeline' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-accent rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-3">
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
        `🏥 Patient ${highestRisk.fullName} selected — NEWS: ${highestRisk.latestNewsScore}`,
        highestRisk.latestNewsScore >= 7 ? 'red' : highestRisk.latestNewsScore >= 5 ? 'orange' : 'green',
        'System'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen flex flex-col bg-surface-base">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex overflow-hidden">
          <WorkflowPanel />
          <DetailPanel />
        </main>
      </div>

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
