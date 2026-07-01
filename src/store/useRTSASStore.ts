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
          id: 'hemoculture_1',
          phase: 'sepsis_bundle',
          label: 'เจาะเลือดเพาะเชื้อ ครั้งที่ 1',
          subLabel: 'ก่อนให้ยาปฏิชีวนะ',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'ตำแหน่งที่เจาะ:',
          sortOrder: 1,
          isUnlocked: false,
        },
        {
          id: 'hemoculture_2',
          phase: 'sepsis_bundle',
          label: 'เจาะเลือดเพาะเชื้อ ครั้งที่ 2',
          subLabel: 'ก่อนให้ยาปฏิชีวนะ',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'ตำแหน่งที่เจาะ:',
          sortOrder: 2,
          isUnlocked: false,
        },
        {
          id: 'iv_fluid',
          phase: 'sepsis_bundle',
          label: 'ให้สารน้ำทางหลอดเลือดดำ',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'ชนิดสารน้ำ / อัตราเร็ว:',
          sortOrder: 3,
          isUnlocked: false,
        },
        {
          id: 'antibiotics_1',
          phase: 'sepsis_bundle',
          label: 'ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 1',
          subLabel: 'ภายใน 60 นาทีหลังแพทย์ยืนยัน',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'ชนิดยา / ขนาด / วิธีให้:',
          sortOrder: 4,
          isUnlocked: false,
        },
        {
          id: 'antibiotics_2',
          phase: 'sepsis_bundle',
          label: 'ยาปฏิชีวนะทางหลอดเลือดดำ ตัวที่ 2 (ถ้ามี)',
          subLabel: 'ทำเมื่อแพทย์สั่ง (ถ้ามี)',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'ชนิดยา / ขนาด / วิธีให้:',
          sortOrder: 5,
          isUnlocked: false,
          isOptional: true,
        },
        {
          id: 'foley_cath',
          phase: 'sepsis_bundle',
          label: 'ใส่สายสวนปัสสาวะ (Retain Foley cath)',
          subLabel: 'ทำเมื่อแพทย์สั่ง (ถ้ามีข้อบ่งชี้)',
          status: 'pending',
          completedAt: null,
          completedBy: null,
          requiresInput: true,
          inputValue: null,
          inputLabel: 'Urine output ที่ได้:',
          sortOrder: 6,
          isUnlocked: false,
          isOptional: true,
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

export interface PatientData {
  checklist: ChecklistPhase[];
  timeline: TimelineEvent[];
  countdownTimer: CountdownTimer;
  assessmentSchedule: AssessmentSchedule | null;
}

export interface RTSASState {
  // ---- Patient Data ----
  patients: Patient[];
  selectedPatient: Patient | null;
  patientData: Record<string, PatientData>;

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
    patientData: {},

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
      const state = get();
      
      // 1. Save current active patient's data before switching
      const newPatientDataMap = { ...state.patientData };
      if (state.selectedPatient) {
        newPatientDataMap[state.selectedPatient.id] = {
          checklist: state.checklist,
          timeline: state.timeline,
          countdownTimer: state.countdownTimer,
          assessmentSchedule: state.assessmentSchedule,
        };
      }

      // 2. Load new patient's data (or initialize if not exists)
      const dataToLoad = newPatientDataMap[patientId] || {
        checklist: createDefaultChecklist(),
        timeline: [],
        countdownTimer: {
          isActive: false, startedAt: null, totalDurationSeconds: 3600,
          remainingSeconds: 3600, isExpired: false, isWarning: false, isCritical: false,
        },
        assessmentSchedule: null,
      };

      // 3. Ensure the newly loaded data is in the map
      newPatientDataMap[patientId] = dataToLoad;

      const patient = state.patients.find((p) => p.id === patientId) || null;
      set({
        selectedPatient: patient,
        patientData: newPatientDataMap,
        checklist: dataToLoad.checklist,
        timeline: dataToLoad.timeline,
        countdownTimer: dataToLoad.countdownTimer,
        assessmentSchedule: dataToLoad.assessmentSchedule,
        ui: { ...state.ui, selectedPatientId: patientId },
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

        const unlockedChecklist = updatePhaseUnlocking(newChecklist);

        return {
          checklist: unlockedChecklist,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              checklist: unlockedChecklist,
            }
          } : state.patientData
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
      set((state) => {
        const newChecklist = state.checklist.map((phase) => ({
          ...phase,
          items: phase.items.map((item) =>
            item.id === itemId ? { ...item, inputValue } : item
          ),
        }));
        
        return {
          checklist: newChecklist,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              checklist: newChecklist,
            }
          } : state.patientData
        };
      });
    },

    resetChecklist: () => {
      set((state) => {
        const newChecklist = createDefaultChecklist();
        return {
          checklist: newChecklist,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              checklist: newChecklist,
            }
          } : state.patientData
        };
      });
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

      set((state) => {
        const newTimeline = [...state.timeline, event];
        return {
          timeline: newTimeline,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              timeline: newTimeline,
            }
          } : state.patientData
        };
      });
    },

    clearTimeline: () => set((state) => ({ 
      timeline: [],
      patientData: state.selectedPatient ? {
        ...state.patientData,
        [state.selectedPatient.id]: {
          ...(state.patientData[state.selectedPatient.id] || {}),
          timeline: [],
        }
      } : state.patientData
    })),

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
      set((state) => {
        const newTimer = {
          isActive: true,
          startedAt: doctorConfirmTime,
          totalDurationSeconds: 3600,
          remainingSeconds: 3600,
          isExpired: false,
          isWarning: false,
          isCritical: false,
        };
        return {
          countdownTimer: newTimer,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              countdownTimer: newTimer,
            }
          } : state.patientData
        };
      });
    },

    tickCountdown: () => {
      set((state) => {
        let updatedPatientData = { ...state.patientData };
        let newActiveTimer = state.countdownTimer;
        let activeTimerUpdated = false;

        // Tick ALL background timers in patientData
        Object.keys(updatedPatientData).forEach(patientId => {
          const timer = updatedPatientData[patientId].countdownTimer;
          if (timer && timer.isActive && !timer.isExpired) {
            const remaining = Math.max(0, timer.remainingSeconds - 1);
            updatedPatientData[patientId] = {
              ...updatedPatientData[patientId],
              countdownTimer: {
                ...timer,
                remainingSeconds: remaining,
                isExpired: remaining === 0,
                isWarning: remaining <= 900 && remaining > 300,
                isCritical: remaining <= 300,
              }
            };
            // Sync with active screen timer if this is the selected patient
            if (state.selectedPatient && state.selectedPatient.id === patientId) {
               newActiveTimer = updatedPatientData[patientId].countdownTimer;
               activeTimerUpdated = true;
            }
          }
        });

        // Also tick the active timer if it wasn't caught by the dictionary loop
        if (!activeTimerUpdated && state.countdownTimer.isActive && !state.countdownTimer.isExpired) {
            const remaining = Math.max(0, state.countdownTimer.remainingSeconds - 1);
            newActiveTimer = {
                ...state.countdownTimer,
                remainingSeconds: remaining,
                isExpired: remaining === 0,
                isWarning: remaining <= 900 && remaining > 300,
                isCritical: remaining <= 300,
            };
            if (state.selectedPatient) {
              updatedPatientData[state.selectedPatient.id] = {
                ...(updatedPatientData[state.selectedPatient.id] || {}),
                countdownTimer: newActiveTimer
              };
            }
        }

        return {
          countdownTimer: newActiveTimer,
          patientData: updatedPatientData
        };
      });
    },

    resetCountdown: () => {
      set((state) => {
        const newTimer = {
          isActive: false,
          startedAt: null,
          totalDurationSeconds: 3600,
          remainingSeconds: 3600,
          isExpired: false,
          isWarning: false,
          isCritical: false,
        };
        return {
          countdownTimer: newTimer,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              countdownTimer: newTimer,
            }
          } : state.patientData
        };
      });
    },

    // ===========================================================================
    // ASSESSMENT SCHEDULE ACTIONS
    // ===========================================================================

    generateSchedule: (originTime) => {
      const patientId = get().selectedPatient?.id ?? '';
      const entries = generateAssessmentSchedule(originTime);

      set((state) => {
        const newSchedule = {
          patientId,
          generatedAt: new Date().toISOString(),
          originTime,
          entries,
        };
        return {
          assessmentSchedule: newSchedule,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              assessmentSchedule: newSchedule,
            }
          } : state.patientData
        };
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

        const newSchedule = {
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
        };

        return {
          assessmentSchedule: newSchedule,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              assessmentSchedule: newSchedule,
            }
          } : state.patientData
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

        const newSchedule = {
          ...state.assessmentSchedule,
          entries: state.assessmentSchedule.entries.map((entry) =>
            entry.id === entryId
              ? { ...entry, reminderTriggered: true }
              : entry
          ),
        };

        return {
          assessmentSchedule: newSchedule,
          patientData: state.selectedPatient ? {
            ...state.patientData,
            [state.selectedPatient.id]: {
              ...(state.patientData[state.selectedPatient.id] || {}),
              assessmentSchedule: newSchedule,
            }
          } : state.patientData
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
