// =============================================================================
// RTSAS Global State Store (Zustand)
// =============================================================================
//
// Central state management for the Real-Time Sepsis Alert System.
// Uses Zustand slices pattern to organize state into logical domains.
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
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
  TreatmentStatus,
} from '../types';
import {
  calculateNEWS,
  generateAssessmentSchedule,
  generateId,
} from '../utils/newsCalculator';
import { maskHN } from '../utils/hnMask';
import { playAlertChime } from '../utils/alertSound';
import { MOCK_PATIENTS } from '../data/mockData';
import {
  evaluatePatientTreatmentStatus,
  auditPatientMemory,
  isPatientActivelyTreated,
  type PatientMemoryAudit,
  type ClearMemoryResult,
  type RetainedPatientSummary,
  type InactivePatientSummary,
} from '../utils/patientMemory';

export {
  evaluatePatientTreatmentStatus,
  auditPatientMemory,
  isPatientActivelyTreated,
  type PatientMemoryAudit,
  type ClearMemoryResult,
  type RetainedPatientSummary,
  type InactivePatientSummary,
};

// ---------------------------------------------------------------------------
// Auth Types
// ---------------------------------------------------------------------------

export type UserRole = 'doctor' | 'nurse' | 'it_admin';

export interface AuthUser {
  id?: number;
  username: string;
  firstname: string;
  lastname: string;
  role: UserRole;
  /** Convenience: first + last */
  name: string;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Clinical Treatment Event Filtering
// ---------------------------------------------------------------------------

/**
 * Helper to identify whether a timeline event represents a true clinical treatment/procedure step.
 * Excludes:
 * - Connection / Auth / User sessions (เข้าสู่ระบบ, ออกจากระบบ, เปิดดู HN)
 * - Database & System Alerts (ระบบตรวจพบ NEWS, Vital signs updated)
 * - System background processing (Assessment schedule generated, countdown started, timer EXPIRED)
 */
export function isTreatmentTimelineEvent(event: TimelineEvent): boolean {
  if (!event || !event.actionText) return false;
  const text = event.actionText;

  // 1. Connection / Auth / User Session (ไม่นับเชื่อมต่อ)
  if (
    text.includes('เข้าสู่ระบบ') ||
    text.includes('ออกจากระบบ') ||
    text.includes('เปิดดู HN')
  ) {
    return false;
  }

  // 2. Database & System Alerts (ไม่นับฐานข้อมูลระบบแจ้งเตือน)
  if (
    text.includes('ระบบตรวจพบ NEWS') ||
    text.includes('Vital signs updated') ||
    text.includes('Vital signs updated — NEWS')
  ) {
    return false;
  }

  // 3. System Background Process / Schedule / Timer internals
  if (
    text.includes('Assessment schedule generated') ||
    text.includes('countdown started') ||
    text.includes('timer EXPIRED')
  ) {
    return false;
  }

  // 4. Clinical treatment events:
  // - Checklist items completed (✓ ...)
  // - Checklist items skipped (⏭ ข้าม: ...)
  // - Clinical assessments completed (📊 Assessment #...)
  // - Sepsis ruled out (🟢 แพทย์ไม่ยืนยัน...)
  // - Treatment completed (✅ สิ้นสุดการรักษา...)
  return true;
}

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
  /** Set when doctor rules out sepsis — ends the protocol loop */
  sepsisRuledOut: boolean;
  /** Timestamp when doctor ruled out */
  ruledOutAt: string | null;
  /** Doctor who ruled out */
  ruledOutBy: string | null;
  /** Set when treatment is manually marked as completed */
  treatmentCompleted: boolean;
  treatmentCompletedAt: string | null;
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

  // ---- Rule Out State ----
  sepsisRuledOut: boolean;
  ruledOutAt: string | null;
  ruledOutBy: string | null;

  // ---- Treatment Completed State ----
  treatmentCompleted: boolean;
  treatmentCompletedAt: string | null;

  // ---- UI State ----
  ui: UIState;
  setLoading: (isLoading: boolean) => void;

  // ---- Alert Queue (multiple simultaneous high-risk patients) ----
  pendingAlerts: Array<{ hn: string; newsScore: number; timestamp: string }>;

  // ---- Auth State (EC Privacy) ----
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  /** Whether full HN is revealed in the detail panel */
  isHNRevealed: boolean;

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
  skipChecklistItem: (itemId: string, actor: string) => void;
  resetChecklist: () => void;
  /** Doctor rules out sepsis — ends the protocol loop */
  ruleOutSepsis: (actor: string) => void;
  // --- Treatment Actions ---
  completeTreatment: (actor: string) => void;

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
  // Alert queue for multiple simultaneous high-risk patients
  queueAlert: (hn: string, newsScore: number) => void;
  dismissNextAlert: () => void;
  syncServerTreatmentStatus: (status: TreatmentStatus) => void;

  // --- Auth Actions ---
  /** Called by LoginPage after successful POST /auth/login */
  setAuthUser: (user: AuthUser, token: string) => void;
  logoutUser: () => void;
  revealHN: () => void;
  hideHN: () => void;

  // --- Patient Memory Cleanup Actions ---
  /** Audits current patient memory to inspect active treated patients vs inactive ones */
  getPatientMemoryAudit: () => PatientMemoryAudit;
  /** Clears patient data for inactive/finished patients while strictly preserving actively treated ones */
  clearInactivePatientsMemory: () => ClearMemoryResult;
}

// ---------------------------------------------------------------------------
// Store Implementation
// ---------------------------------------------------------------------------

export const useRTSASStore = create<RTSASState>()(
  persist(
    subscribeWithSelector((set, get) => ({
      // ---- Initial State ----
      patients: MOCK_PATIENTS,
      selectedPatient: MOCK_PATIENTS.length > 0 ? MOCK_PATIENTS[0] : null,
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
      sepsisRuledOut: false,
      ruledOutAt: null,
      ruledOutBy: null,
      treatmentCompleted: false,
      treatmentCompletedAt: null,

      ui: {
        selectedPatientId: null,
        isLoading: true,
        activeTab: 'checklist',
        isSidebarCollapsed: false,
        connectionStatus: 'connected',
        currentTime: new Date().toISOString(),
        modal: {
          activeModal: null,
          modalData: null,
        },
      },
      pendingAlerts: [] as Array<{ hn: string; newsScore: number; timestamp: string }>,

      // ---- Auth State (EC Privacy) ----
      isAuthenticated: false,
      currentUser: null,
      isHNRevealed: false,

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
            ...(state.patientData[state.selectedPatient.id] || {}),
            checklist: state.checklist,
            timeline: state.timeline,
            countdownTimer: state.countdownTimer,
            assessmentSchedule: state.assessmentSchedule,
            sepsisRuledOut: state.sepsisRuledOut,
            ruledOutAt: state.ruledOutAt,
            ruledOutBy: state.ruledOutBy,
            treatmentCompleted: state.treatmentCompleted,
            treatmentCompletedAt: state.treatmentCompletedAt,
          };
        }

        // 2. Load new patient's data (or initialize if not exists)
        const rawData = newPatientDataMap[patientId];
        const dataToLoad = rawData
          ? {
            ...rawData,
            timeline: (rawData.timeline || []).filter(isTreatmentTimelineEvent),
          }
          : {
            checklist: createDefaultChecklist(),
            timeline: [],
            countdownTimer: {
              isActive: false, startedAt: null, totalDurationSeconds: 3600,
              remainingSeconds: 3600, isExpired: false, isWarning: false, isCritical: false,
            },
            assessmentSchedule: null,
            sepsisRuledOut: false,
            ruledOutAt: null,
            ruledOutBy: null,
            treatmentCompleted: false,
            treatmentCompletedAt: null,
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
          sepsisRuledOut: dataToLoad.sepsisRuledOut,
          ruledOutAt: dataToLoad.ruledOutAt,
          ruledOutBy: dataToLoad.ruledOutBy,
          treatmentCompleted: dataToLoad.treatmentCompleted,
          treatmentCompletedAt: dataToLoad.treatmentCompletedAt,
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
        }
      },

      skipChecklistItem: (itemId, actor) => {
        const now = new Date().toISOString();

        set((state) => {
          const newChecklist = state.checklist.map((phase) => ({
            ...phase,
            items: phase.items.map((item) =>
              item.id === itemId
                ? {
                  ...item,
                  status: 'skipped' as ChecklistItemStatus,
                  completedAt: now,
                  completedBy: actor,
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

        const skippedItem = get()
          .checklist.flatMap((p) => p.items)
          .find((i) => i.id === itemId);

        if (skippedItem) {
          get().addTimelineEvent(
            `⏭ ข้าม: ${skippedItem.label}`,
            'blue',
            actor
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

      // Doctor rules out sepsis — ends protocol loop for this patient
      ruleOutSepsis: (actor: string) => {
        set((state) => {
          if (!state.selectedPatient) return {};
          const patientId = state.selectedPatient.id;
          const now = new Date().toISOString();

          // Update patientData with rule-out flag, stop timer, cancel schedule
          const currentData = state.patientData[patientId] || {};

          let newTimer = currentData.countdownTimer;
          if (newTimer?.isActive) {
            newTimer = { ...newTimer, isActive: false };
          }

          let newSchedule = currentData.assessmentSchedule;
          if (newSchedule) {
            newSchedule = {
              ...newSchedule,
              entries: newSchedule.entries.map(entry =>
                !entry.isCompleted ? { ...entry, isCanceled: true } : entry
              ),
            };
          }

          const updatedPatientData: Record<string, PatientData> = {
            ...state.patientData,
            [patientId]: {
              ...currentData,
              sepsisRuledOut: true,
              ruledOutAt: now,
              ruledOutBy: actor,
              countdownTimer: newTimer,
              assessmentSchedule: newSchedule,
            },
          };

          // Add timeline event
          const event: TimelineEvent = {
            id: generateId(),
            timestamp: now,
            actionText: `🟢 แพทย์ไม่ยืนยันภาวะติดเชื้อในกระแสเลือด — จบกระบวนการสำหรับผู้ป่วยรายนี้`,
            color: 'green',
            actor,
          };

          const updatedTimeline = [...(state.timeline || []), event];

          return {
            patientData: updatedPatientData,
            sepsisRuledOut: true,
            ruledOutAt: now,
            ruledOutBy: actor,
            countdownTimer: updatedPatientData[patientId].countdownTimer,
            assessmentSchedule: updatedPatientData[patientId].assessmentSchedule,
            timeline: updatedTimeline,
          };
        });
      },

      // Manually mark patient treatment as completed
      completeTreatment: (actor: string) => {
        set((state) => {
          if (!state.selectedPatient) return {};
          const patientId = state.selectedPatient.id;
          const now = new Date().toISOString();

          // Update patientData with treatmentCompleted flag, stop timer, cancel schedule
          const currentData = state.patientData[patientId] || {};

          let newTimer = currentData.countdownTimer;
          if (newTimer?.isActive) {
            newTimer = { ...newTimer, isActive: false };
          }

          let newSchedule = currentData.assessmentSchedule;
          if (newSchedule) {
            newSchedule = {
              ...newSchedule,
              entries: newSchedule.entries.map(entry =>
                !entry.isCompleted ? { ...entry, isCanceled: true } : entry
              ),
            };
          }

          const updatedPatientData: Record<string, PatientData> = {
            ...state.patientData,
            [patientId]: {
              ...currentData,
              treatmentCompleted: true,
              treatmentCompletedAt: now,
              countdownTimer: newTimer,
              assessmentSchedule: newSchedule,
            },
          };

          // Add timeline event
          const event: TimelineEvent = {
            id: generateId(),
            timestamp: now,
            actionText: `✅ สิ้นสุดการรักษา — ผู้ป่วยได้รับการรักษาครบถ้วนแล้ว`,
            color: 'green',
            actor,
          };

          const updatedTimeline = [...(state.timeline || []), event];

          return {
            patientData: updatedPatientData,
            treatmentCompleted: true,
            treatmentCompletedAt: now,
            countdownTimer: updatedPatientData[patientId].countdownTimer,
            assessmentSchedule: updatedPatientData[patientId].assessmentSchedule,
            timeline: updatedTimeline,
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

        // Safeguard: Only keep clinical treatment procedure steps in patient timeline
        if (!isTreatmentTimelineEvent(event)) {
          return;
        }

        set((state) => {
          const newTimeline = [...(state.timeline || []).filter(isTreatmentTimelineEvent), event];
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
        const { timeline, selectedPatient, isAuthenticated } = get();
        const treatmentEvents = (timeline || []).filter(isTreatmentTimelineEvent);
        // EC Privacy: Use masked HN in copied text unless authenticated
        const displayHN = selectedPatient
          ? (isAuthenticated ? selectedPatient.hn : maskHN(selectedPatient.hn))
          : '';
        const patientName = selectedPatient?.fullName ? ` (${selectedPatient.fullName})` : '';
        const header = `บันทึกขั้นตอนการรักษา (Clinical Treatment Steps) — HN: ${displayHN}${patientName}\n`;
        const separator = '='.repeat(60) + '\n';

        if (treatmentEvents.length === 0) {
          return header + separator + 'ยังไม่มีขั้นตอนการรักษาที่บันทึก\n' + separator;
        }

        const lines = treatmentEvents.map((event, index) => {
          const time = new Date(event.timestamp).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          const actor = event.actor ? ` [ผู้ปฏิบัติ: ${event.actor}]` : '';
          return `[${time}] ขั้นตอนที่ ${index + 1}: ${event.actionText}${actor}`;
        });

        const footer = '\n' + separator + `รวมดำเนินการทั้งหมด: ${treatmentEvents.length} ขั้นตอน`;
        return header + separator + lines.join('\n') + footer;
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
          const updatedPatientData = { ...state.patientData };
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

      setLoading: (isLoading) =>
        set((state) => ({ ui: { ...state.ui, isLoading } })),

      setActiveTab: (tab) =>
        set((state) => ({ ui: { ...state.ui, activeTab: tab } })),

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

      closeModal: () => {
        const state = get();
        const next = state.pendingAlerts[0];

        if (next) {
          // Auto-show the next queued alert immediately after closing current
          set((s) => ({
            pendingAlerts: s.pendingAlerts.slice(1),
            ui: {
              ...s.ui,
              modal: {
                activeModal: 'alert',
                modalData: { newsScore: next.newsScore, patientName: next.hn },
              },
            },
          }));
        } else {
          set((s) => ({
            ui: { ...s.ui, modal: { activeModal: null, modalData: null } },
          }));
        }
      },

      // Queue an alert for a high-risk patient
      queueAlert: (hn, newsScore) => {
        // 1. Check if patient is already acknowledged or completed centrally
        const state = get();
        const pt = state.patients.find((p) => p.hn === hn || p.id === hn);
        const patientId = pt ? pt.id : hn;
        const ptData = state.patientData[patientId];

        const isDoctorConfirmed = ptData?.checklist?.some((phase) =>
          phase.items?.some((item) => item.id === 'doctor_confirm' && item.status === 'completed')
        );

        // If already acknowledged, completed, or ruled out: DO NOT ALERT!
        if (ptData?.treatmentCompleted || ptData?.sepsisRuledOut || isDoctorConfirmed) {
          return;
        }

        // Play audio chime for emergency alert
        playAlertChime();

        set((s) => {
          // Prevent duplicate in queue
          const isAlreadyPending = s.pendingAlerts.some((a) => a.hn === hn);
          const updatedPending = isAlreadyPending
            ? s.pendingAlerts
            : [
              ...s.pendingAlerts,
              { hn, newsScore, timestamp: new Date().toISOString() },
            ];

          // If no modal is currently blocking the screen, pop up the alert modal immediately!
          if (s.ui.modal.activeModal === null) {
            const matchedPatient = s.patients.find((p) => p.hn === hn || p.id === hn);
            return {
              pendingAlerts: updatedPending,
              ui: {
                ...s.ui,
                modal: {
                  activeModal: 'alert',
                  modalData: {
                    hn,
                    newsScore,
                    patientName: matchedPatient?.fullName || hn,
                  },
                },
              },
            };
          }

          return {
            pendingAlerts: updatedPending,
          };
        });
      },

      dismissNextAlert: () => {
        set((s) => ({ pendingAlerts: s.pendingAlerts.slice(1) }));
      },

      // Synchronize centralized treatment & alert status from backend MySQL
      syncServerTreatmentStatus: (status: TreatmentStatus) => {
        const hn = status.hn;
        const patient = get().patients.find((p) => p.hn === hn || p.id === hn);
        const patientId = patient ? patient.id : hn;

        set((state) => {
          const existingData = state.patientData[patientId] || {
            checklist: createDefaultChecklist(),
            timeline: [],
            countdownTimer: {
              isActive: false,
              startedAt: null,
              totalDurationSeconds: 3600,
              remainingSeconds: 3600,
              isExpired: false,
              isWarning: false,
              isCritical: false,
            },
            assessmentSchedule: null,
            sepsisRuledOut: false,
            ruledOutAt: null,
            ruledOutBy: null,
            treatmentCompleted: false,
            treatmentCompletedAt: null,
          };

          // Update checklist doctor_confirm if acknowledged or doctor_confirmed
          let updatedChecklist = existingData.checklist || createDefaultChecklist();
          if (status.acknowledged || status.doctor_confirmed) {
            updatedChecklist = updatedChecklist.map((phase) => ({
              ...phase,
              items: phase.items.map((item) =>
                item.id === 'doctor_confirm'
                  ? {
                      ...item,
                      status: 'completed' as const,
                      completedAt: item.completedAt || status.acknowledged_at || new Date().toISOString(),
                      completedBy: item.completedBy || status.acknowledged_by || 'Nurse/System',
                    }
                  : item
              ),
            }));
          }

          // Calculate countdown timer from server startedAt
          let updatedTimer = existingData.countdownTimer;
          if (status.countdown_started_at && !status.treatment_completed && !status.sepsis_ruled_out) {
            const startedAt = status.countdown_started_at;
            const totalDuration = status.countdown_duration || 3600;
            const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
            const remaining = Math.max(0, totalDuration - elapsed);
            const isExpired = elapsed >= totalDuration;

            updatedTimer = {
              isActive: !isExpired,
              startedAt,
              totalDurationSeconds: totalDuration,
              remainingSeconds: remaining,
              isExpired,
              isWarning: remaining <= 900 && remaining > 300,
              isCritical: remaining <= 300 && remaining > 0,
            };
          } else if (status.treatment_completed || status.sepsis_ruled_out) {
            updatedTimer = {
              ...existingData.countdownTimer,
              isActive: false,
            };
          }

          const isFinishedOrAcknowledged = status.acknowledged || status.treatment_completed || status.sepsis_ruled_out;

          // Remove from pending alerts if acknowledged or finished
          const updatedPendingAlerts = isFinishedOrAcknowledged
            ? state.pendingAlerts.filter((a) => a.hn !== hn)
            : state.pendingAlerts;

          // Dismiss alert modal if currently showing for this patient
          let updatedModal = state.ui.modal;
          if (
            isFinishedOrAcknowledged &&
            state.ui.modal.activeModal === 'alert' &&
            (state.ui.modal.modalData?.hn === hn || state.ui.modal.modalData?.patientName === hn)
          ) {
            updatedModal = { activeModal: null, modalData: null };
          }

          const updatedPatientData = {
            ...existingData,
            checklist: updatedChecklist,
            countdownTimer: updatedTimer,
            treatmentCompleted: status.treatment_completed ?? existingData.treatmentCompleted,
            treatmentCompletedAt: status.treatment_completed_at ?? existingData.treatmentCompletedAt,
            sepsisRuledOut: status.sepsis_ruled_out ?? existingData.sepsisRuledOut,
          };

          const isCurrentlySelected = state.selectedPatient?.id === patientId;

          return {
            patientData: {
              ...state.patientData,
              [patientId]: updatedPatientData,
            },
            pendingAlerts: updatedPendingAlerts,
            ui: {
              ...state.ui,
              modal: updatedModal,
            },
            ...(isCurrentlySelected
              ? {
                  checklist: updatedChecklist,
                  countdownTimer: updatedTimer,
                  treatmentCompleted: updatedPatientData.treatmentCompleted,
                  sepsisRuledOut: updatedPatientData.sepsisRuledOut,
                }
              : {}),
          };
        });
      },

      // ===========================================================================
      // AUTH ACTIONS
      // ===========================================================================

      setAuthUser: (user: AuthUser, token: string) => {
        localStorage.setItem('rtsas_token', token);
        set({ isAuthenticated: true, currentUser: user });
      },

      logoutUser: () => {
        // Clear JWT from localStorage
        localStorage.removeItem('rtsas_token');
        set({
          isAuthenticated: false,
          currentUser: null,
          isHNRevealed: false,
        });
      },

      revealHN: () => {
        const { isAuthenticated, currentUser } = get();
        if (!isAuthenticated || !currentUser) return;
        set({ isHNRevealed: true });
      },

      hideHN: () => set({ isHNRevealed: false }),

      getPatientMemoryAudit: () => {
        const state = get();
        // Ensure currently selected patient's active state is merged into data map
        const currentMap = { ...state.patientData };
        if (state.selectedPatient) {
          currentMap[state.selectedPatient.id] = {
            ...(currentMap[state.selectedPatient.id] || {}),
            checklist: state.checklist,
            timeline: state.timeline,
            countdownTimer: state.countdownTimer,
            assessmentSchedule: state.assessmentSchedule,
            sepsisRuledOut: state.sepsisRuledOut,
            ruledOutAt: state.ruledOutAt,
            ruledOutBy: state.ruledOutBy,
            treatmentCompleted: state.treatmentCompleted,
            treatmentCompletedAt: state.treatmentCompletedAt,
          };
        }
        return auditPatientMemory(currentMap, state.patients);
      },

      clearInactivePatientsMemory: () => {
        const state = get();
        // 1. Ensure currently selected patient's active working state is merged
        const currentMap = { ...state.patientData };
        if (state.selectedPatient) {
          currentMap[state.selectedPatient.id] = {
            ...(currentMap[state.selectedPatient.id] || {}),
            checklist: state.checklist,
            timeline: state.timeline,
            countdownTimer: state.countdownTimer,
            assessmentSchedule: state.assessmentSchedule,
            sepsisRuledOut: state.sepsisRuledOut,
            ruledOutAt: state.ruledOutAt,
            ruledOutBy: state.ruledOutBy,
            treatmentCompleted: state.treatmentCompleted,
            treatmentCompletedAt: state.treatmentCompletedAt,
          };
        }

        const retainedDataMap: Record<string, PatientData> = {};
        const retainedPatients: RetainedPatientSummary[] = [];
        const clearedPatientIds: string[] = [];

        for (const [id, data] of Object.entries(currentMap)) {
          const patientObj = state.patients.find((p) => p.id === id || p.hn === id);
          const hn = patientObj?.hn || id;
          const name = patientObj?.fullName || 'ไม่ระบุชื่อ';
          const status = evaluatePatientTreatmentStatus(data);

          // Active treatment / timer / assessments guard
          if (status.isActivelyTreated) {
            retainedDataMap[id] = data;
            retainedPatients.push({
              id,
              hn,
              name,
              reasons: status.reasons,
              remainingTimerSeconds: status.timerInfo?.remainingSeconds,
              pendingAssessmentsCount: status.assessmentInfo?.pendingCount,
            });
          } else {
            clearedPatientIds.push(id);
          }
        }

        // Check if selected patient was cleared
        const isSelectedPatientCleared =
          state.selectedPatient && clearedPatientIds.includes(state.selectedPatient.id);

        set({
          patientData: retainedDataMap,
          ...(isSelectedPatientCleared
            ? {
              checklist: createDefaultChecklist(),
              timeline: [],
              countdownTimer: {
                isActive: false,
                startedAt: null,
                totalDurationSeconds: 3600,
                remainingSeconds: 3600,
                isExpired: false,
                isWarning: false,
                isCritical: false,
              },
              assessmentSchedule: null,
              sepsisRuledOut: false,
              ruledOutAt: null,
              ruledOutBy: null,
              treatmentCompleted: false,
              treatmentCompletedAt: null,
            }
            : {}),
        });

        return {
          totalBefore: Object.keys(currentMap).length,
          clearedCount: clearedPatientIds.length,
          retainedCount: retainedPatients.length,
          retainedPatients,
          clearedPatientIds,
        };
      },
    })),
    {
      name: 'rtsas-storage',
      partialize: (state) => ({
        // Only persist essential state, avoid UI state that might cause issues on reload
        patients: state.patients,
        patientData: state.patientData,
        selectedPatient: state.selectedPatient,
        checklist: state.checklist,
        timeline: state.timeline,
        countdownTimer: state.countdownTimer,
        assessmentSchedule: state.assessmentSchedule,
        sepsisRuledOut: state.sepsisRuledOut,
        ruledOutAt: state.ruledOutAt,
        ruledOutBy: state.ruledOutBy,
        treatmentCompleted: state.treatmentCompleted,
        treatmentCompletedAt: state.treatmentCompletedAt,
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        isHNRevealed: state.isHNRevealed,
        ui: {
          ...state.ui,
          currentTime: new Date().toISOString(), // Reset current time so it doesn't freeze
        }
      })
    }
  )
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
      phase.items.every((item) => item.status === 'completed' || item.status === 'skipped');

    // Determine if this phase should be unlocked
    let isUnlocked = phase.isUnlocked;
    if (index === 0) {
      isUnlocked = true; // Phase 1 always unlocked
    } else {
      // Unlock if the previous phase is completed
      const prevPhase = phases[index - 1];
      const prevCompleted =
        prevPhase.items.length > 0 &&
        prevPhase.items.every((item) => item.status === 'completed' || item.status === 'skipped');
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
// Countdown timer expiry subscription — runs outside of React.
// Internal timer state is managed in store; treatment timeline remains clean.
useRTSASStore.subscribe(
  (state) => state.countdownTimer.isExpired,
  () => {
    // No-op for patient treatment timeline
  }
);
