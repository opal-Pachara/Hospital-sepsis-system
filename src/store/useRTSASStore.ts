// =============================================================================
// RTSAS Global State Store (Zustand)
// =============================================================================
//
// Central state management for the Real-Time Sepsis Alert System.
// Uses Zustand slices pattern to organize state into logical domains.
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  Patient,
  VitalSigns,
  ChecklistPhase,
  TimelineEvent,
  CountdownTimer,
  AssessmentSchedule,
  UIState,
  ModalType,
  ActiveTab,
  ConnectionStatus,
  ChecklistItemStatus,
  TimelineEventColor,
} from '../types';
import {
  calculateNEWS,
  generateAssessmentSchedule,
  generateId,
} from '../utils/newsCalculator';

// ---------------------------------------------------------------------------
// Default Checklist Template
// ---------------------------------------------------------------------------

function createDefaultChecklist(): ChecklistPhase[] {
  return [
    {
      phase: 'initial_response',
      title: 'Phase 1: Initial Response',
      isUnlocked: true,
      isCompleted: false,
      items: [
        {
          id: 'triage',
          phase: 'initial_response',
          label: 'Triage Assessment Completed',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: false,
          inputValue: null,
          inputLabel: null,
          sortOrder: 1,
          isUnlocked: true,
        },
        {
          id: 'er_admission',
          phase: 'initial_response',
          label: 'ER Admission Registered',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: false,
          inputValue: null,
          inputLabel: null,
          sortOrder: 2,
          isUnlocked: true,
        },
        {
          id: 'initial_report',
          phase: 'initial_response',
          label: 'Initial Report to Physician',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: false,
          inputValue: null,
          inputLabel: null,
          sortOrder: 3,
          isUnlocked: true,
        },
      ],
    },
    {
      phase: 'doctor_confirmation',
      title: 'Phase 2: Doctor Confirmation',
      isUnlocked: false,
      isCompleted: false,
      items: [
        {
          id: 'doctor_confirm',
          phase: 'doctor_confirmation',
          label: 'Doctor Acknowledges Sepsis Alert & Starts Timer',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: false,
          inputValue: null,
          inputLabel: null,
          sortOrder: 1,
          isUnlocked: false,
        },
      ],
    },
    {
      phase: 'sepsis_bundle',
      title: 'Phase 3: Sepsis Bundle (Hour-1)',
      isUnlocked: false,
      isCompleted: false,
      items: [
        {
          id: 'hemoculture',
          phase: 'sepsis_bundle',
          label: 'Hemoculture Drawn',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'Injection site (e.g., Left AC, Right AC)',
          sortOrder: 1,
          isUnlocked: false,
        },
        {
          id: 'iv_fluid',
          phase: 'sepsis_bundle',
          label: 'IV Fluid Bolus Administered',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'Fluid type & volume (e.g., NSS 1000ml)',
          sortOrder: 2,
          isUnlocked: false,
        },
        {
          id: 'antibiotics',
          phase: 'sepsis_bundle',
          label: 'Antibiotics Administered',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'Drug name & dosage',
          sortOrder: 3,
          isUnlocked: false,
        },
        {
          id: 'lactate',
          phase: 'sepsis_bundle',
          label: 'Lactate Level Ordered',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: false,
          inputValue: null,
          inputLabel: null,
          sortOrder: 4,
          isUnlocked: false,
        },
      ],
    },
    {
      phase: 'assessment_schedule',
      title: 'Phase 4: Reassessment Schedule',
      isUnlocked: false,
      isCompleted: false,
      items: [], // Dynamically populated from AssessmentSchedule
    },
  ];
}

// ---------------------------------------------------------------------------
// Store State Interface
// ---------------------------------------------------------------------------

export interface RTSASState {
  // ---- Patient Data ----
  patients: Patient[];
  selectedPatient: Patient | null;

  // ---- Checklist ----
  checklist: ChecklistPhase[];

  // ---- Timeline ----
  timeline: TimelineEvent[];

  // ---- Countdown Timer ----
  countdownTimer: CountdownTimer;

  // ---- Assessment Schedule ----
  assessmentSchedule: AssessmentSchedule | null;

  // ---- UI State ----
  ui: UIState;

  // ======= ACTIONS =======

  // --- Patient Actions ---
  setPatients: (patients: Patient[]) => void;
  selectPatient: (patientId: string) => void;
  updatePatientVitals: (patientId: string, vitals: VitalSigns) => void;

  // --- Checklist Actions ---
  completeChecklistItem: (
    itemId: string,
    completedBy: string,
    inputValue?: string
  ) => void;
  updateChecklistInput: (itemId: string, inputValue: string) => void;
  resetChecklist: () => void;

  // --- Timeline Actions ---
  addTimelineEvent: (
    actionText: string,
    color: TimelineEventColor,
    actor: string,
    metadata?: Record<string, unknown>
  ) => void;
  clearTimeline: () => void;
  getTimelineText: () => string;

  // --- Countdown Timer Actions ---
  startCountdown: (doctorConfirmTime: string) => void;
  tickCountdown: () => void;
  resetCountdown: () => void;

  // --- Assessment Schedule Actions ---
  generateSchedule: (originTime: string) => void;
  completeAssessment: (
    entryId: string,
    vitals: VitalSigns,
    completedBy: string
  ) => void;
  triggerReminder: (entryId: string) => void;

  // --- UI Actions ---
  setActiveTab: (tab: ActiveTab) => void;
  toggleSidebar: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  updateCurrentTime: () => void;
  openModal: (type: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;
}

// ---------------------------------------------------------------------------
// Store Implementation
// ---------------------------------------------------------------------------

export const useRTSASStore = create<RTSASState>()(
  subscribeWithSelector((set, get) => ({
    // ---- Initial State ----
    patients: [],
    selectedPatient: null,

    checklist: createDefaultChecklist(),

    timeline: [],

    countdownTimer: {
      isActive: false,
      startedAt: null,
      totalDurationSeconds: 3600, // 60 minutes
      remainingSeconds: 3600,
      isExpired: false,
      isWarning: false,
      isCritical: false,
    },

    assessmentSchedule: null,

    ui: {
      selectedPatientId: null,
      activeTab: 'checklist',
      isSidebarCollapsed: false,
      connectionStatus: 'connected',
      currentTime: new Date().toISOString(),
      modal: {
        activeModal: null,
        modalData: null,
      },
    },

    // ===========================================================================
    // PATIENT ACTIONS
    // ===========================================================================

    setPatients: (patients) => set({ patients }),

    selectPatient: (patientId) => {
      const patient = get().patients.find((p) => p.id === patientId) || null;
      set({
        selectedPatient: patient,
        ui: { ...get().ui, selectedPatientId: patientId },
      });
    },

    updatePatientVitals: (patientId, vitals) => {
      const newsResult = calculateNEWS(vitals);

      set((state) => ({
        patients: state.patients.map((p) =>
          p.id === patientId
            ? {
                ...p,
                latestVitals: vitals,
                latestNewsScore: newsResult.totalScore,
                latestNewsResult: newsResult,
                currentRiskLevel: newsResult.riskLevel,
                hasSepsisAlert:
                  newsResult.totalScore >= 5 ||
                  newsResult.hasSingleParameterAlert,
              }
            : p
        ),
        // Also update selectedPatient if it's the active one
        selectedPatient:
          state.selectedPatient?.id === patientId
            ? {
                ...state.selectedPatient,
                latestVitals: vitals,
                latestNewsScore: newsResult.totalScore,
                latestNewsResult: newsResult,
                currentRiskLevel: newsResult.riskLevel,
                hasSepsisAlert:
                  newsResult.totalScore >= 5 ||
                  newsResult.hasSingleParameterAlert,
              }
            : state.selectedPatient,
      }));

      // Auto-dispatch timeline event for vital sign update
      get().addTimelineEvent(
        `Vital signs updated — NEWS score: ${newsResult.totalScore} (${newsResult.riskLevel})`,
        newsResult.totalScore >= 7
          ? 'red'
          : newsResult.totalScore >= 5
            ? 'orange'
            : 'green',
        'System',
        {
          vitals,
          newsResult: {
            totalScore: newsResult.totalScore,
            riskLevel: newsResult.riskLevel,
          },
        }
      );

      // Auto-open alert modal for high NEWS scores
      if (newsResult.totalScore >= 5) {
        get().openModal('alert', {
          newsScore: newsResult.totalScore,
          riskLevel: newsResult.riskLevel,
          patientName:
            get().patients.find((p) => p.id === patientId)?.fullName ?? '',
        });
      }
    },

    // ===========================================================================
    // CHECKLIST ACTIONS
    // ===========================================================================

    completeChecklistItem: (itemId, completedBy, inputValue) => {
      const now = new Date().toISOString();

      set((state) => {
        const newChecklist = state.checklist.map((phase) => ({
          ...phase,
          items: phase.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'completed' as ChecklistItemStatus,
                  completedAt: now,
                  completedBy,
                  inputValue: inputValue ?? item.inputValue,
                }
              : item
          ),
        }));

        // Check phase completion and unlock next phases
        return {
          checklist: updatePhaseUnlocking(newChecklist),
        };
      });

      // Find the completed item for timeline entry
      const completedItem = get()
        .checklist.flatMap((p) => p.items)
        .find((i) => i.id === itemId);

      if (completedItem) {
        let eventText = `✓ ${completedItem.label}`;
        if (inputValue) {
          eventText += ` — ${inputValue}`;
        }

        get().addTimelineEvent(eventText, 'blue', completedBy);
      }

      // Special handling: Doctor Confirmation starts the countdown
      if (itemId === 'doctor_confirm') {
        get().startCountdown(now);
        get().generateSchedule(now);
        get().addTimelineEvent(
          '⏱ 60-minute Sepsis Bundle countdown started',
          'red',
          completedBy
        );
      }
    },

    updateChecklistInput: (itemId, inputValue) => {
      set((state) => ({
        checklist: state.checklist.map((phase) => ({
          ...phase,
          items: phase.items.map((item) =>
            item.id === itemId ? { ...item, inputValue } : item
          ),
        })),
      }));
    },

    resetChecklist: () => {
      set({ checklist: createDefaultChecklist() });
    },

    // ===========================================================================
    // TIMELINE ACTIONS
    // ===========================================================================

    addTimelineEvent: (actionText, color, actor, metadata) => {
      const event: TimelineEvent = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        actionText,
        color,
        actor,
        metadata,
      };

      set((state) => ({
        timeline: [...state.timeline, event],
      }));
    },

    clearTimeline: () => set({ timeline: [] }),

    getTimelineText: () => {
      const { timeline, selectedPatient } = get();
      const header = selectedPatient
        ? `Timeline — ${selectedPatient.fullName} (HN: ${selectedPatient.hn})\n`
        : 'Timeline\n';
      const separator = '='.repeat(60) + '\n';

      const lines = timeline.map((event) => {
        const time = new Date(event.timestamp).toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return `[${time}] ${event.actionText} (by ${event.actor})`;
      });

      return header + separator + lines.join('\n');
    },

    // ===========================================================================
    // COUNTDOWN TIMER ACTIONS
    // ===========================================================================

    startCountdown: (doctorConfirmTime) => {
      set({
        countdownTimer: {
          isActive: true,
          startedAt: doctorConfirmTime,
          totalDurationSeconds: 3600,
          remainingSeconds: 3600,
          isExpired: false,
          isWarning: false,
          isCritical: false,
        },
      });
    },

    tickCountdown: () => {
      set((state) => {
        if (!state.countdownTimer.isActive || state.countdownTimer.isExpired) {
          return state;
        }

        const remaining = Math.max(
          0,
          state.countdownTimer.remainingSeconds - 1
        );

        return {
          countdownTimer: {
            ...state.countdownTimer,
            remainingSeconds: remaining,
            isExpired: remaining === 0,
            isWarning: remaining <= 900 && remaining > 300, // < 15 min
            isCritical: remaining <= 300, // < 5 min
          },
        };
      });
    },

    resetCountdown: () => {
      set({
        countdownTimer: {
          isActive: false,
          startedAt: null,
          totalDurationSeconds: 3600,
          remainingSeconds: 3600,
          isExpired: false,
          isWarning: false,
          isCritical: false,
        },
      });
    },

    // ===========================================================================
    // ASSESSMENT SCHEDULE ACTIONS
    // ===========================================================================

    generateSchedule: (originTime) => {
      const patientId = get().selectedPatient?.id ?? '';
      const entries = generateAssessmentSchedule(originTime);

      set({
        assessmentSchedule: {
          patientId,
          generatedAt: new Date().toISOString(),
          originTime,
          entries,
        },
      });

      get().addTimelineEvent(
        `📋 Assessment schedule generated (${entries.length} entries)`,
        'blue',
        'System'
      );
    },

    completeAssessment: (entryId, vitals, completedBy) => {
      const newsResult = calculateNEWS(vitals);
      const now = new Date().toISOString();

      set((state) => {
        if (!state.assessmentSchedule) return state;

        return {
          assessmentSchedule: {
            ...state.assessmentSchedule,
            entries: state.assessmentSchedule.entries.map((entry) =>
              entry.id === entryId
                ? {
                    ...entry,
                    isCompleted: true,
                    completedAt: now,
                    vitals,
                    newsResult,
                  }
                : entry
            ),
          },
        };
      });

      // Find the entry for timeline
      const entry = get().assessmentSchedule?.entries.find(
        (e) => e.id === entryId
      );

      get().addTimelineEvent(
        `📊 Assessment #${entry?.sequence ?? '?'} completed — NEWS: ${newsResult.totalScore}`,
        newsResult.totalScore >= 5 ? 'red' : 'green',
        completedBy,
        { vitals, newsScore: newsResult.totalScore }
      );

      // Also update the patient's vitals
      const patientId = get().selectedPatient?.id;
      if (patientId) {
        get().updatePatientVitals(patientId, vitals);
      }
    },

    triggerReminder: (entryId) => {
      set((state) => {
        if (!state.assessmentSchedule) return state;

        return {
          assessmentSchedule: {
            ...state.assessmentSchedule,
            entries: state.assessmentSchedule.entries.map((entry) =>
              entry.id === entryId
                ? { ...entry, reminderTriggered: true }
                : entry
            ),
          },
        };
      });

      const entry = get().assessmentSchedule?.entries.find(
        (e) => e.id === entryId
      );

      get().openModal('reminder', {
        entryId,
        sequence: entry?.sequence,
        scheduledTime: entry?.scheduledTime,
      });
    },

    // ===========================================================================
    // UI ACTIONS
    // ===========================================================================

    setActiveTab: (tab) =>
      set((state) => ({
        ui: { ...state.ui, activeTab: tab },
      })),

    toggleSidebar: () =>
      set((state) => ({
        ui: { ...state.ui, isSidebarCollapsed: !state.ui.isSidebarCollapsed },
      })),

    setConnectionStatus: (status) =>
      set((state) => ({
        ui: { ...state.ui, connectionStatus: status },
      })),

    updateCurrentTime: () =>
      set((state) => ({
        ui: { ...state.ui, currentTime: new Date().toISOString() },
      })),

    openModal: (type, data) =>
      set((state) => ({
        ui: {
          ...state.ui,
          modal: { activeModal: type, modalData: data ?? null },
        },
      })),

    closeModal: () =>
      set((state) => ({
        ui: {
          ...state.ui,
          modal: { activeModal: null, modalData: null },
        },
      })),
  }))
);

// ---------------------------------------------------------------------------
// Helper: Phase Unlocking Logic
// ---------------------------------------------------------------------------

/**
 * Determines phase unlock states based on completion of prior phases.
 * Rules:
 *   - Phase 1 is always unlocked.
 *   - Phase 2 unlocks when ALL Phase 1 items are completed.
 *   - Phase 3 unlocks when Phase 2 (doctor confirm) is completed.
 *   - Phase 4 unlocks when Phase 3 is completed.
 */
function updatePhaseUnlocking(phases: ChecklistPhase[]): ChecklistPhase[] {

  return phases.map((phase, index) => {
    // Check if all items in this phase are completed
    const isCompleted =
      phase.items.length > 0 &&
      phase.items.every((item) => item.status === 'completed');

    // Determine if this phase should be unlocked
    let isUnlocked = phase.isUnlocked;
    if (index === 0) {
      isUnlocked = true; // Phase 1 always unlocked
    } else {
      // Unlock if the previous phase is completed
      const prevPhase = phases[index - 1];
      const prevCompleted =
        prevPhase.items.length > 0 &&
        prevPhase.items.every((item) => item.status === 'completed');
      if (prevCompleted) {
        isUnlocked = true;
      }
    }

    return {
      ...phase,
      isCompleted,
      isUnlocked,
      items: phase.items.map((item) => ({
        ...item,
        isUnlocked,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Subscriptions & Side Effects
// ---------------------------------------------------------------------------

/**
 * Subscribe to countdown timer changes to detect expiry.
 * This runs outside of React — it's a store-level subscription.
 */
useRTSASStore.subscribe(
  (state) => state.countdownTimer.isExpired,
  (isExpired) => {
    if (isExpired) {
      const store = useRTSASStore.getState();
      store.addTimelineEvent(
        '⚠️ 60-minute Sepsis Bundle timer EXPIRED',
        'red',
        'System'
      );
    }
  }
);
