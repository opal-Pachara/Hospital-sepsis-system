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
  gcsToAVPU,
} from '../types';
import {
  calculateNEWS,
  generateAssessmentSchedule,
  createNextAssessmentEntry,
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
import {
  mapBackendToPatient,
  type BackendPatient,
} from '../utils/patientMapper';

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

  // 2. Auto treatment events — INCLUDE (visit time, NEWS calc)
  if (text.startsWith('🏥') || text.startsWith('🧮')) {
    return true;
  }

  // 3. Database & System Alerts (ไม่นับฐานข้อมูลระบบแจ้งเตือน)
  if (
    text.includes('ระบบตรวจพบ NEWS') ||
    text.includes('Vital signs updated') ||
    text.includes('Vital signs updated — NEWS')
  ) {
    return false;
  }

  // 4. System Background Process / Schedule / Timer internals
  if (
    text.includes('Assessment schedule generated') ||
    text.includes('countdown started') ||
    text.includes('timer EXPIRED')
  ) {
    return false;
  }

  // 5. Clinical treatment events:
  // - Checklist items completed (✓ ...)
  // - Checklist items skipped (⏭ ข้าม: ...)
  // - Clinical assessments completed (📊 Assessment #... or ประเมินสัญญาณชีพ...)
  // - Sepsis ruled out (🟢 แพทย์ไม่ยืนยัน...)
  // - Treatment completed (✅ สิ้นสุดการรักษา...)
  return true;
}

/**
 * Helper to ensure that Step 1 (Visit time) and Step 2 (ระบบคำนวณ NEWS)
 * are always present in the patient's treatment timeline, regardless of alert triggers
 * or NEWS score (including low risk / normal patients like 3968 with NEWS = 0).
 */
export function ensureInitialTimelineEvents(
  patient: Patient | null | undefined,
  existingEvents: TimelineEvent[] = []
): TimelineEvent[] {
  if (!patient) return existingEvents;

  const currentEvents = existingEvents.filter(isTreatmentTimelineEvent);

  const hasVisit = currentEvents.some(
    (e) => (e.actionText || '').startsWith('🏥') || (e.actionText || '').includes('ผู้ป่วยมาถึง ER') || (e.actionText || '').includes('เข้ารับบริการ')
  );
  const hasNews = currentEvents.some(
    (e) => (e.actionText || '').startsWith('🧮') || (e.actionText || '').includes('คำนวณ NEWS')
  );

  if (hasVisit && hasNews) {
    return existingEvents;
  }

  const eventsToAdd: TimelineEvent[] = [];
  const arrivalIso = patient.arrivalTime || new Date().toISOString();
  const arrivalTimeStr = patient.arrivalTime
    ? new Date(patient.arrivalTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  if (!hasVisit) {
    eventsToAdd.push({
      id: `visit_${patient.id || patient.hn}`,
      timestamp: arrivalIso,
      actionText: `🏥 ผู้ป่วยมาถึง ER เวลา ${arrivalTimeStr} น.`,
      color: 'blue',
      actor: 'ระบบ',
    });
  }

  if (!hasNews) {
    const score = patient.latestNewsResult?.totalScore ?? patient.latestNewsScore ?? 0;
    const riskLevel = patient.latestNewsResult?.riskLevel ?? patient.currentRiskLevel ?? 'low';

    let calcIso = patient.latestNewsResult?.calculatedAt;
    if (!calcIso) {
      const arrMs = new Date(arrivalIso).getTime();
      calcIso = !isNaN(arrMs) ? new Date(arrMs + 1000).toISOString() : arrivalIso;
    }

    eventsToAdd.push({
      id: `news_${patient.id || patient.hn}`,
      timestamp: calcIso,
      actionText: `🧮 ระบบคำนวณ NEWS Score = ${score}`,
      color: score >= 5 ? 'red' : score >= 1 ? 'orange' : 'green',
      actor: 'ระบบ RTSAS',
    });
  }

  return [...eventsToAdd, ...existingEvents];
}

/**
 * Helper to determine if a patient record is strictly historical/archived (Read-Only).
 * A patient is historical if:
 * 1. Treatment was completed or ruled out (centralized DB or store state).
 * 2. The arrival date is prior to today.
 *
 * When historical, all actions (checkboxes, doctor confirm, complete treatment, countdown timers)
 * are locked to preserve medical record integrity and audit trail timestamps.
 */
export function isHistoricalPatient(
  patient: Patient | null,
  patientDataMap?: Record<string, PatientData>
): boolean {
  if (!patient) return false;
  const pData = patientDataMap ? patientDataMap[patient.id] : null;

  // 1. Treatment completed or ruled out -> strictly locked to protect timestamp integrity
  if (pData?.treatmentCompleted || pData?.sepsisRuledOut) return true;
  if (patient.treatmentStatus?.treatment_completed || patient.treatmentStatus?.sepsis_ruled_out) return true;

  // 2. Opened explicitly from historical dashboard / archive
  if (pData?.isHistoricalArchive) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Default Checklist Template
// ---------------------------------------------------------------------------

function createDefaultChecklist(): ChecklistPhase[] {
  return [
    {
      phase: 'initial_response',
      title: 'ขั้นตอนที่ 1: การประเมินเบื้องต้น',
      isUnlocked: true,
      isCompleted: false,
      items: [
        {
          id: 'triage',
          phase: 'initial_response',
          label: 'ลงทะเบียนผู้ป่วย / Triage',
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
          id: 'nurse_reassess',
          phase: 'initial_response',
          label: 'พยาบาลประเมินซ้ำ',
          subLabel: 'ตรวจสอบข้อมูลผู้ป่วยก่อนรายงานแพทย์',
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
          label: 'รายงานแพทย์เวร',
          subLabel: 'แจ้งผล NEWS Score และอาการแก่แพทย์',
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
      title: 'ขั้นตอนที่ 2: แพทย์ยืนยัน',
      isUnlocked: false,
      isCompleted: false,
      items: [
        {
          id: 'doctor_confirm',
          phase: 'doctor_confirmation',
          label: 'แพทย์เวรยืนยันติดเชื้อ',
          subLabel: 'แพทย์ประเมินและยืนยันภาวะ Sepsis — เริ่มนับเวลา',
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
      title: 'ขั้นตอนที่ 3: Sepsis Bundle (Hour-1)',
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
      title: 'ขั้นตอนที่ 4: ประเมินสัญญาณชีพซ้ำ',
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
  /** Set when opened as historical archive record from Treated Dashboard */
  isHistoricalArchive?: boolean;
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
  dismissedAlertKeys: Record<string, boolean>;
  markAlertDismissed: (hn: string, key?: string) => void;
  isAlertDismissed: (hn: string, key?: string) => boolean;

  // ---- Auth State (EC Privacy) ----
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  /** Whether full HN is revealed in the detail panel */
  isHNRevealed: boolean;

  // ======= ACTIONS =======

  // --- Patient Actions ---
  setPatients: (patients: Patient[]) => void;
  selectPatient: (patientId: string | null, isHistoricalArchive?: boolean) => void;
  selectPatientAsync: (patientId: string, isHistoricalArchive?: boolean) => Promise<Patient | null>;
  updatePatientVitals: (patientId: string, vitals: VitalSigns) => void;

  // --- Checklist Actions ---
  completeChecklistItem: (
    itemId: string,
    completedBy: string,
    inputValue?: string,
    customConfirmTime?: string
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
    metadata?: Record<string, unknown>,
    customTimestamp?: string,
    targetPatientId?: string
  ) => void;
  clearTimeline: () => void;
  getTimelineText: () => string;

  // --- Countdown Timer Actions ---
  startCountdown: (doctorConfirmTime?: string, targetPatientId?: string) => void;
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
  snoozeReminder: (entryId: string) => void;

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
  clearTreatedPatients: (hns?: string[]) => void;

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
      dismissedAlertKeys: {} as Record<string, boolean>,

      // ---- Auth State (EC Privacy) ----
      isAuthenticated: false,
      currentUser: null,
      isHNRevealed: false,

      // ===========================================================================
      // PATIENT ACTIONS
      // ===========================================================================

      setPatients: (patients) => set((state) => {
        const updatedSelected = state.selectedPatient
          ? patients.find((p) => p.id === state.selectedPatient?.id || p.hn === state.selectedPatient?.hn) || state.selectedPatient
          : null;
        return {
          patients,
          selectedPatient: updatedSelected,
        };
      }),

      selectPatient: (patientId, isHistoricalArchive = false) => {
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

        // If unselecting / clearing active patient
        if (!patientId) {
          set({
            selectedPatient: null,
            patientData: newPatientDataMap,
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
            ui: { ...state.ui, selectedPatientId: null },
          });
          return;
        }

        // 2. Load new patient's data (or initialize if not exists)
        const rawData = newPatientDataMap[patientId];
        const dataToLoad = rawData
          ? {
            ...rawData,
            timeline: (rawData.timeline || []).filter(isTreatmentTimelineEvent),
            isHistoricalArchive: isHistoricalArchive ? true : false,
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
            isHistoricalArchive: isHistoricalArchive ? true : false,
          };

        // 3. Ensure the newly loaded data is in the map
        const patient = state.patients.find((p) => p.id === patientId || p.hn === patientId) || null;
        // Restore treatmentStatus from patient if present
        if (patient?.treatmentStatus) {
          const ts = patient.treatmentStatus;
          if (ts.checklist_json) {
            try {
              const parsed = JSON.parse(ts.checklist_json);
              if (Array.isArray(parsed) && parsed.length > 0) {
                dataToLoad.checklist = parsed;
              }
            } catch (e) {
              console.warn('[RTSAS] Failed to parse checklist_json in selectPatient:', e);
            }
          }
          if ((ts.doctor_confirmed || ts.countdown_started_at) && !ts.sepsis_ruled_out) {
            dataToLoad.checklist = dataToLoad.checklist.map((phase) => ({
              ...phase,
              items: phase.items.map((item) =>
                item.id === 'doctor_confirm'
                  ? {
                    ...item,
                    status: 'completed' as const,
                    completedAt: item.completedAt || ts.countdown_started_at || ts.acknowledged_at || new Date().toISOString(),
                    completedBy: item.completedBy || ts.acknowledged_by || 'แพทย์เวร ER',
                  }
                  : item
              ),
            }));
          }
          if (ts.countdown_started_at && !ts.treatment_completed && !ts.sepsis_ruled_out) {
            const elapsed = Math.floor((Date.now() - new Date(ts.countdown_started_at).getTime()) / 1000);
            const totalDuration = ts.countdown_duration || 3600;
            const remaining = Math.max(0, totalDuration - elapsed);
            dataToLoad.countdownTimer = {
              isActive: true,
              startedAt: ts.countdown_started_at,
              totalDurationSeconds: totalDuration,
              remainingSeconds: remaining,
              isExpired: remaining === 0,
              isWarning: remaining <= 900 && remaining > 300,
              isCritical: remaining <= 300 && remaining > 0,
            };
          }
          if ((ts.doctor_confirmed || ts.countdown_started_at) && !dataToLoad.assessmentSchedule && !ts.sepsis_ruled_out) {
            const originTime = ts.countdown_started_at || ts.acknowledged_at || new Date().toISOString();
            dataToLoad.assessmentSchedule = {
              patientId,
              generatedAt: new Date().toISOString(),
              originTime,
              entries: generateAssessmentSchedule(originTime),
            };
          }
          if (ts.sepsis_ruled_out) {
            dataToLoad.sepsisRuledOut = true;
            dataToLoad.ruledOutAt = ts.updated_at || dataToLoad.ruledOutAt;
            dataToLoad.countdownTimer = {
              ...dataToLoad.countdownTimer,
              isActive: false,
            };
          }
        }

        // Accurately recalculate phase unlocking for loaded checklist
        dataToLoad.checklist = updatePhaseUnlocking(dataToLoad.checklist);

        const isHistorical = isHistoricalPatient(patient, newPatientDataMap);

        if (isHistorical) {
          dataToLoad.countdownTimer = {
            ...dataToLoad.countdownTimer,
            isActive: false,
          };
          if (patient?.treatmentStatus?.treatment_completed) {
            dataToLoad.treatmentCompleted = true;
            dataToLoad.treatmentCompletedAt = patient.treatmentStatus.treatment_completed_at || dataToLoad.treatmentCompletedAt;
          }
          if (patient?.treatmentStatus?.sepsis_ruled_out) {
            dataToLoad.sepsisRuledOut = true;
            dataToLoad.ruledOutAt = patient.treatmentStatus.updated_at || dataToLoad.ruledOutAt;
          }
        }

        dataToLoad.timeline = ensureInitialTimelineEvents(patient, dataToLoad.timeline);
        newPatientDataMap[patientId] = dataToLoad;

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
          ui: { ...state.ui, selectedPatientId: patient ? patient.id : patientId },
        });
      },

      selectPatientAsync: async (patientId: string, isHistoricalArchive: boolean = false): Promise<Patient | null> => {
        const cleanId = patientId.trim();
        const state = get();

        // 1. Check if patient is already in state.patients
        let patient = state.patients.find((p) => p.id === cleanId || p.hn === cleanId);

        // 2. If not found in memory, fetch from backend API (historical record support)
        if (!patient) {
          try {
            const res = await fetch(`/api/patients/${cleanId}`);
            if (!res.ok) {
              throw new Error(`Patient ${cleanId} not found (HTTP ${res.status})`);
            }
            const bp: BackendPatient = await res.json();
            patient = mapBackendToPatient(bp);

            // Add to patients array
            set((s) => ({
              patients: [...s.patients.filter((p) => p.id !== patient!.id && p.hn !== patient!.hn), patient!],
            }));
          } catch (err) {
            console.error(`Failed to load patient ${cleanId}:`, err);
            return null;
          }
        }

        // 3. Fetch or reconstruct timeline & treatment data from server
        try {
          const timelineRes = await fetch(`/api/patients/${patient.hn}/timeline`);
          if (timelineRes.ok) {
            const tlData = await timelineRes.json();
            if (tlData.events && Array.isArray(tlData.events)) {
              const existingData = get().patientData[patient.id] || {
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
                isHistoricalArchive: isHistoricalArchive ? true : false,
              };

              const tStatus = tlData.treatment_status;
              const isCompleted = tStatus?.treatment_completed ?? false;
              const isRuledOut = tStatus?.sepsis_ruled_out ?? false;

              let checklist = existingData.checklist || createDefaultChecklist();
              if (tStatus?.checklist_json) {
                try {
                  checklist = JSON.parse(tStatus.checklist_json);
                } catch {
                  // keep default
                }
              } else if (isCompleted) {
                // If completed without saved checklist_json, mark bundle phases as completed
                checklist = checklist.map((phase) => ({
                  ...phase,
                  isCompleted: true,
                  items: phase.items.map((it) => ({
                    ...it,
                    status: 'completed' as const,
                    completedAt: tStatus?.treatment_completed_at || patient!.arrivalTime,
                    completedBy: tStatus?.treatment_completed_by || 'ทีมแพทย์/พยาบาล ER',
                  })),
                }));
              }

              const updatedData = {
                ...existingData,
                checklist,
                timeline: tlData.events,
                treatmentCompleted: isCompleted,
                treatmentCompletedAt: tStatus?.treatment_completed_at,
                sepsisRuledOut: isRuledOut,
                ruledOutAt: isRuledOut ? (tStatus?.updated_at || patient.arrivalTime) : null,
                isHistoricalArchive: isHistoricalArchive ? true : false,
                countdownTimer: {
                  ...existingData.countdownTimer,
                  isActive: false,
                },
              };

              set((s) => ({
                patientData: {
                  ...s.patientData,
                  [patient!.id]: updatedData,
                },
              }));
            }
          }
        } catch (tlErr) {
          console.warn(`Could not load server timeline for ${patient.hn}:`, tlErr);
        }

        // 4. Select the patient in the store
        get().selectPatient(patient.id, isHistoricalArchive);
        return patient;
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

      completeChecklistItem: (itemId, completedBy, inputValue, customConfirmTime) => {
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          console.warn('[RTSAS] Blocked checklist modification on historical patient');
          return;
        }

        const now = new Date().toISOString();

        set((state) => {
          const newChecklist = state.checklist.map((phase) => ({
            ...phase,
            items: phase.items.map((item) =>
              item.id === itemId
                ? {
                  ...item,
                  status: 'completed' as ChecklistItemStatus,
                  completedAt: customConfirmTime || now,
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
          if (itemId === 'doctor_confirm') {
            if (customConfirmTime) {
              const timeStr = new Date(customConfirmTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              eventText = `✓ แพทย์เวรยืนยันติดเชื้อ (เวลาที่ยืนยันทางคลินิก: ${timeStr} น.)`;
            } else {
              eventText = `✓ แพทย์เวรยืนยันติดเชื้อ`;
            }
          } else if (inputValue) {
            eventText += ` — ${inputValue}`;
          }

          get().addTimelineEvent(eventText, 'blue', itemId === 'doctor_confirm' ? 'แพทย์เวร ER' : completedBy);
        }

        // Special handling: Doctor Confirmation starts the countdown
        if (itemId === 'doctor_confirm') {
          const confirmTime = customConfirmTime || now;
          get().startCountdown(confirmTime);
          get().generateSchedule(confirmTime);
        }

        // Sync checklist state centrally to MySQL backend
        if (typeof window !== 'undefined') {
          const activePt = get().selectedPatient;
          if (activePt && activePt.hn) {
            fetch('/api/treatment-status/checklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hn: activePt.hn, checklist_json: JSON.stringify(get().checklist) }),
            }).catch((err) => console.warn('[RTSAS] Failed to sync checklist to backend:', err));
          }
        }
      },

      skipChecklistItem: (itemId, actor) => {
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          return;
        }

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

        // Sync checklist state centrally to MySQL backend
        if (typeof window !== 'undefined') {
          const activePt = get().selectedPatient;
          if (activePt && activePt.hn) {
            fetch('/api/treatment-status/checklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hn: activePt.hn, checklist_json: JSON.stringify(get().checklist) }),
            }).catch((err) => console.warn('[RTSAS] Failed to sync checklist to backend:', err));
          }
        }
      },

      updateChecklistInput: (itemId, inputValue) => {
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          return;
        }

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
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          console.warn('[RTSAS] Blocked rule out on historical patient');
          return;
        }

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
              checklist: state.checklist || currentData.checklist || createDefaultChecklist(),
              sepsisRuledOut: true,
              ruledOutAt: now,
              ruledOutBy: actor,
              countdownTimer: newTimer,
              assessmentSchedule: newSchedule,
            },
          };

          // Ensure Step 1 (Visit time) and Step 2 (ระบบคำนวณ NEWS) are recorded before Rule Out
          const guaranteedTimeline = ensureInitialTimelineEvents(state.selectedPatient, state.timeline || []);

          // Add timeline event
          const event: TimelineEvent = {
            id: generateId(),
            timestamp: now,
            actionText: `🟢 แพทย์ไม่ยืนยันภาวะติดเชื้อในกระแสเลือด (Rule Out) — จบกระบวนการสำหรับผู้ป่วยรายนี้`,
            color: 'green',
            actor,
          };

          const updatedTimeline = [...guaranteedTimeline, event];
          updatedPatientData[patientId].timeline = updatedTimeline;

          // Update patient treatmentStatus in patients list so sidebar immediately moves patient out of active queue
          const updatedPatients = state.patients.map((p) =>
            (p.id === patientId || p.hn === patientId)
              ? {
                ...p,
                treatmentStatus: {
                  ...(p.treatmentStatus || {}),
                  hn: p.hn,
                  sepsis_ruled_out: true,
                  doctor_confirmed: false,
                  countdown_started_at: null,
                  treatment_completed: false,
                } as TreatmentStatus,
              }
              : p
          );

          const updatedCurrentPatient = updatedPatients.find((p) => p.id === patientId || p.hn === patientId) || state.selectedPatient;

          return {
            patients: updatedPatients,
            selectedPatient: updatedCurrentPatient,
            patientData: updatedPatientData,
            sepsisRuledOut: true,
            ruledOutAt: now,
            ruledOutBy: actor,
            countdownTimer: updatedPatientData[patientId].countdownTimer,
            assessmentSchedule: updatedPatientData[patientId].assessmentSchedule,
            timeline: updatedTimeline,
            ui: {
              ...state.ui,
              activeTab: 'timeline',
            },
          };
        });

        // Sync rule-out to backend MySQL
        if (typeof window !== 'undefined' && curState.selectedPatient) {
          fetch('/api/treatment-status/rule-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hn: curState.selectedPatient.hn }),
          }).catch((err) => console.warn('Failed to sync rule-out to backend:', err));
        }
      },

      // Manually mark patient treatment as completed
      completeTreatment: (actor: string) => {
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          console.warn('[RTSAS] Blocked complete treatment on historical patient');
          return;
        }

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

          // Update patient treatmentStatus in patients list so sidebar immediately moves patient out of active queue
          const updatedPatients = state.patients.map((p) =>
            (p.id === patientId || p.hn === patientId)
              ? {
                ...p,
                treatmentStatus: {
                  ...(p.treatmentStatus || {}),
                  hn: p.hn,
                  treatment_completed: true,
                  treatment_completed_at: now,
                } as TreatmentStatus,
              }
              : p
          );

          // Switch selected patient to next remaining active patient in ER
          const remainingActive = updatedPatients.filter((p) => {
            const d = updatedPatientData[p.id] || (p.hn ? updatedPatientData[p.hn] : undefined);
            return !d?.sepsisRuledOut && !d?.treatmentCompleted && !p.treatmentStatus?.sepsis_ruled_out && !p.treatmentStatus?.treatment_completed;
          });
          const nextSelected = remainingActive[0] || null;

          return {
            patients: updatedPatients,
            selectedPatient: nextSelected,
            patientData: updatedPatientData,
            treatmentCompleted: true,
            treatmentCompletedAt: now,
            countdownTimer: updatedPatientData[patientId].countdownTimer,
            assessmentSchedule: updatedPatientData[patientId].assessmentSchedule,
            timeline: updatedTimeline,
          };
        });

        // Sync completion to backend MySQL
        if (typeof window !== 'undefined' && curState.selectedPatient) {
          const hn = curState.selectedPatient.hn;
          fetch('/api/treatment-status/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hn, completed_by: actor }),
          }).catch((err) => console.warn('Failed to sync complete to backend:', err));
          fetch('/api/treatment-status/checklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hn, checklist_json: JSON.stringify(get().checklist) }),
          }).catch((err) => console.warn('Failed to sync checklist to backend:', err));
        }
      },

      // ===========================================================================
      // TIMELINE ACTIONS
      // ===========================================================================

      addTimelineEvent: (actionText, color, actor, metadata, customTimestamp, targetPatientId) => {
        const event: TimelineEvent = {
          id: generateId(),
          timestamp: customTimestamp || new Date().toISOString(),
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
          const effectivePatientId = targetPatientId || state.selectedPatient?.id;
          const targetPt = effectivePatientId
            ? (state.patients.find((p) => p.id === effectivePatientId || p.hn === effectivePatientId) || state.selectedPatient)
            : state.selectedPatient;

          const existingEvents = (effectivePatientId && state.patientData[effectivePatientId]?.timeline)
            ? (state.patientData[effectivePatientId].timeline || []).filter(isTreatmentTimelineEvent)
            : (state.selectedPatient?.id === effectivePatientId ? (state.timeline || []).filter(isTreatmentTimelineEvent) : []);

          // Prevent duplicate initial events (visit time & NEWS calculation)
          if ((event.actionText || '').startsWith('🏥') && existingEvents.some((e) => (e.actionText || '').startsWith('🏥'))) {
            return state;
          }
          if ((event.actionText || '').startsWith('🧮') && existingEvents.some((e) => (e.actionText || '').startsWith('🧮'))) {
            return state;
          }

          let baseEvents = existingEvents;
          const isInitial = (event.actionText || '').startsWith('🏥') || (event.actionText || '').startsWith('🧮');
          if (!isInitial && targetPt) {
            baseEvents = ensureInitialTimelineEvents(targetPt, existingEvents);
          }
          const newTimeline = [...baseEvents, event];
          const isCurrentlySelected = state.selectedPatient?.id === effectivePatientId || !state.selectedPatient;

          return {
            timeline: isCurrentlySelected ? newTimeline : state.timeline,
            patientData: effectivePatientId ? {
              ...state.patientData,
              [effectivePatientId]: {
                ...(state.patientData[effectivePatientId] || {}),
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
        const { timeline, selectedPatient, isAuthenticated, patientData } = get();
        const data = selectedPatient ? patientData[selectedPatient.id] : null;
        const rawTimeline = (data?.timeline && data.timeline.length > 0) ? data.timeline : (timeline || []);
        const guaranteedTimeline = ensureInitialTimelineEvents(selectedPatient, rawTimeline);
        const treatmentEvents = guaranteedTimeline.filter(isTreatmentTimelineEvent);
        // Sort chronologically
        treatmentEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

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
          let cleanAction = (event.actionText || '')
            .replace(/\s*—\s*โดย\s+.*$/gi, '')
            .replace(/\s*\(โดย\s+[^)]+\)/gi, '')
            .replace(/\s*\[ผู้ปฏิบัติ:\s*[^\]]*\]/gi, '')
            .trim();
          if (cleanAction.includes('แพทย์ยืนยันภาวะติดเชื้อในกระแสเลือด') || cleanAction.includes('แพทย์เวรยืนยัน')) {
            const match = cleanAction.match(/^(.*?\([^)]*น\.\))/);
            if (match) {
              cleanAction = match[1];
            } else {
              cleanAction = '✓ แพทย์เวรยืนยันติดเชื้อ';
            }
          }
          const isSkipped = cleanAction.startsWith('⏭ ข้าม');
          const stepLabel = isSkipped ? `ขั้นตอนที่ ${index + 1} (ข้าม)` : `ขั้นตอนที่ ${index + 1}`;
          return `[${time}] ${stepLabel}: ${cleanAction} [ผู้ปฏิบัติ: ]`;
        });

        const footer = '\n' + separator + `รวมดำเนินการทั้งหมด: ${treatmentEvents.length} ขั้นตอน`;
        return header + separator + lines.join('\n') + footer;
      },

      // ===========================================================================
      // COUNTDOWN TIMER ACTIONS
      // ===========================================================================

      startCountdown: (doctorConfirmTime, targetPatientId) => {
        const curState = get();
        const targetId = targetPatientId || curState.selectedPatient?.id;
        const targetPatient = targetId ? curState.patients.find(p => p.id === targetId || p.hn === targetId) : curState.selectedPatient;
        if (targetPatient && isHistoricalPatient(targetPatient, curState.patientData)) {
          return;
        }

        const nowMs = Date.now();
        let remaining = 3600;
        let isExpired = false;
        let isWarning = false;
        let isCritical = false;

        const effectiveStartTime = doctorConfirmTime || new Date().toISOString();
        const startTimeMs = new Date(effectiveStartTime).getTime();
        if (!isNaN(startTimeMs)) {
          const elapsed = Math.floor((nowMs - startTimeMs) / 1000);
          remaining = Math.max(0, 3600 - elapsed);
          isExpired = remaining === 0;
          isCritical = remaining <= 300 && remaining > 0;
          isWarning = remaining <= 900 && remaining > 300;
        }

        set((state) => {
          const newTimer = {
            isActive: true,
            startedAt: effectiveStartTime,
            totalDurationSeconds: 3600,
            remainingSeconds: remaining,
            isExpired: isExpired,
            isWarning: isWarning,
            isCritical: isCritical,
          };
          const updatedPatientData = { ...state.patientData };
          const pId = targetId || state.selectedPatient?.id;
          const pHn = targetPatient?.hn || state.selectedPatient?.hn;

          // Complete doctor_confirm item only, leaving Phase 1 items untouched for nurse
          const curData = (pId && updatedPatientData[pId]) || (pHn && updatedPatientData[pHn]);
          const curChecklist = curData?.checklist || createDefaultChecklist();
          const updatedChecklist = curChecklist.map((phase) => ({
            ...phase,
            items: phase.items.map((item) =>
              item.id === 'doctor_confirm'
                ? {
                  ...item,
                  status: 'completed' as const,
                  completedAt: item.completedAt || effectiveStartTime,
                  completedBy: item.completedBy || 'แพทย์เวร ER',
                }
                : item
            ),
          }));
          const finalChecklist = updatePhaseUnlocking(updatedChecklist);

          // Ensure initial timeline events (Step 1: Visit time & Step 2: ระบบคำนวณ NEWS)
          const targetPt = targetPatient || state.selectedPatient;
          let activeTimeline = state.timeline;
          if (targetPt) {
            // Strictly isolate timeline: do not fall back to activeTimeline of another patient
            const existingTl = (pId && updatedPatientData[pId]?.timeline) || [];
            const guaranteedTl = ensureInitialTimelineEvents(targetPt, existingTl);
            if (pId) {
              updatedPatientData[pId] = {
                ...(updatedPatientData[pId] || {}),
                countdownTimer: newTimer,
                checklist: finalChecklist,
                timeline: guaranteedTl,
              };
            }
            if (pHn && pHn !== pId) {
              updatedPatientData[pHn] = {
                ...(updatedPatientData[pHn] || {}),
                countdownTimer: newTimer,
                checklist: finalChecklist,
                timeline: guaranteedTl,
              };
            }
            if (state.selectedPatient?.id === pId || !state.selectedPatient) {
              activeTimeline = guaranteedTl;
            }
          } else {
            if (pId) {
              updatedPatientData[pId] = {
                ...(updatedPatientData[pId] || {}),
                countdownTimer: newTimer,
                checklist: finalChecklist,
              };
            }
            if (pHn && pHn !== pId) {
              updatedPatientData[pHn] = {
                ...(updatedPatientData[pHn] || {}),
                countdownTimer: newTimer,
                checklist: finalChecklist,
              };
            }
          }

          const updatedPatients = state.patients.map((p) =>
            (p.id === pId || p.hn === pHn || p.id === pHn)
              ? {
                ...p,
                treatmentStatus: {
                  ...(p.treatmentStatus || {}),
                  hn: p.hn,
                  countdown_started_at: p.treatmentStatus?.countdown_started_at || effectiveStartTime,
                  countdown_duration: 3600,
                } as TreatmentStatus,
              }
              : p
          );

          return {
            countdownTimer: (state.selectedPatient?.id === pId || !state.selectedPatient) ? newTimer : state.countdownTimer,
            patientData: updatedPatientData,
            patients: updatedPatients,
            timeline: activeTimeline,
          };
        });
      },

      tickCountdown: () => {
        set((state) => {
          const updatedPatientData = { ...state.patientData };
          let newActiveTimer = state.countdownTimer;
          let activeTimerUpdated = false;
          const nowMs = Date.now();

          // Tick ALL background timers in patientData
          Object.keys(updatedPatientData).forEach(patientId => {
            const timer = updatedPatientData[patientId].countdownTimer;
            const patientObj = state.patients.find((p) => p.id === patientId || p.hn === patientId) || null;
            if (isHistoricalPatient(patientObj, updatedPatientData)) {
              if (timer?.isActive) {
                updatedPatientData[patientId] = {
                  ...updatedPatientData[patientId],
                  countdownTimer: { ...timer, isActive: false },
                };
              }
              return;
            }

            if (timer && timer.isActive && !timer.isExpired) {
              let remaining = Math.max(0, timer.remainingSeconds - 1);
              if (timer.startedAt) {
                const elapsed = Math.floor((nowMs - new Date(timer.startedAt).getTime()) / 1000);
                remaining = Math.max(0, timer.totalDurationSeconds - elapsed);
              }
              const isExpired = remaining === 0;
              updatedPatientData[patientId] = {
                ...updatedPatientData[patientId],
                countdownTimer: {
                  ...timer,
                  remainingSeconds: remaining,
                  isExpired,
                  isWarning: remaining <= 900 && remaining > 300,
                  isCritical: remaining <= 300 && remaining > 0,
                }
              };
              // Sync with active screen timer if this is the selected patient
              if (state.selectedPatient && state.selectedPatient.id === patientId) {
                newActiveTimer = updatedPatientData[patientId].countdownTimer;
                activeTimerUpdated = true;
              }
            }
          });

          // Check if currently selected patient is historical
          if (state.selectedPatient && isHistoricalPatient(state.selectedPatient, updatedPatientData)) {
            newActiveTimer = { ...newActiveTimer, isActive: false };
            activeTimerUpdated = true;
          }

          // Also tick the active timer if it wasn't caught by the dictionary loop
          if (!activeTimerUpdated && state.countdownTimer.isActive && !state.countdownTimer.isExpired) {
            let remaining = Math.max(0, state.countdownTimer.remainingSeconds - 1);
            if (state.countdownTimer.startedAt) {
              const elapsed = Math.floor((nowMs - new Date(state.countdownTimer.startedAt).getTime()) / 1000);
              remaining = Math.max(0, state.countdownTimer.totalDurationSeconds - elapsed);
            }
            const isExpired = remaining === 0;
            newActiveTimer = {
              ...state.countdownTimer,
              remainingSeconds: remaining,
              isExpired,
              isWarning: remaining <= 900 && remaining > 300,
              isCritical: remaining <= 300 && remaining > 0,
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
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          return;
        }

        const newsResult = calculateNEWS(vitals);
        const now = new Date().toISOString();

        set((state) => {
          if (!state.assessmentSchedule) return state;

          const currentEntry = state.assessmentSchedule.entries.find((e) => e.id === entryId);
          const currentSeq = currentEntry?.sequence ?? 1;
          const nextSeq = currentSeq + 1;

          // 1. Mark current entry completed
          let updatedEntries = state.assessmentSchedule.entries.map((entry) =>
            entry.id === entryId
              ? {
                ...entry,
                isCompleted: true,
                completedAt: now,
                vitals,
                newsResult,
              }
              : entry
          );

          // 2. Schedule next round chained from completedAt (15m for rounds 2-4, 30m for rounds 5+)
          const intervalMinutes = nextSeq <= 4 ? 15 : 30;
          const nextScheduledTime = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();

          const nextEntryExists = updatedEntries.some((e) => e.sequence === nextSeq);
          if (nextEntryExists) {
            updatedEntries = updatedEntries.map((entry) =>
              entry.sequence === nextSeq
                ? {
                  ...entry,
                  scheduledTime: nextScheduledTime,
                  reminderTriggered: false,
                  lastReminderAt: null,
                }
                : entry
            );
          } else {
            // Next entry doesn't exist yet! Create it dynamically!
            const nextEntry = createNextAssessmentEntry(nextSeq, now);
            updatedEntries.push(nextEntry);
          }

          const newSchedule = {
            ...state.assessmentSchedule,
            entries: updatedEntries,
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

        const seq = entry?.sequence ?? '?';
        const sbpStr = vitals.systolicBP != null ? vitals.systolicBP : '—';
        const dbpStr = vitals.diastolicBP != null ? vitals.diastolicBP : '—';
        const hrStr = vitals.heartRate != null ? vitals.heartRate : '—';
        const rrStr = vitals.respiratoryRate != null ? vitals.respiratoryRate : '—';
        const spo2Str = vitals.spO2 != null ? vitals.spO2 : '—';
        const tempStr = vitals.temperature != null ? vitals.temperature : '—';
        const gcsVal = vitals.gcs != null ? vitals.gcs : '—';
        const avpuVal = vitals.avpu || (typeof vitals.gcs === 'number' ? gcsToAVPU(vitals.gcs) : 'A');

        const score = newsResult.totalScore;
        let eventColor: TimelineEventColor = 'green';

        const actionText = `🩺 ประเมินสัญญาณชีพ (ครั้งที่ ${seq}) — BP ${sbpStr}/${dbpStr} mmHg, HR ${hrStr} bpm, RR ${rrStr}/min, SpO2 ${spo2Str}%, Temp ${tempStr}°C, GCS ${gcsVal} (${avpuVal}) (NEWS: ${score} คะแนน)`;

        get().addTimelineEvent(
          actionText,
          eventColor,
          completedBy,
          { vitals, newsScore: score }
        );

        // Also update the patient's vitals
        const patientId = get().selectedPatient?.id;
        if (patientId) {
          get().updatePatientVitals(patientId, vitals);
        }
      },

      triggerReminder: (entryId) => {
        const curState = get();
        if (curState.selectedPatient && isHistoricalPatient(curState.selectedPatient, curState.patientData)) {
          return;
        }

        const now = new Date().toISOString();

        set((state) => {
          if (!state.assessmentSchedule) return state;

          const newSchedule = {
            ...state.assessmentSchedule,
            entries: state.assessmentSchedule.entries.map((entry) =>
              entry.id === entryId
                ? { ...entry, reminderTriggered: true, lastReminderAt: now }
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

      snoozeReminder: (entryId) => {
        const now = new Date().toISOString();
        set((state) => {
          if (!state.assessmentSchedule) return state;

          const newSchedule = {
            ...state.assessmentSchedule,
            entries: state.assessmentSchedule.entries.map((entry) =>
              entry.id === entryId
                ? { ...entry, lastReminderAt: now }
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

        const isDoctorConfirmed = Boolean(
          pt?.treatmentStatus?.doctor_confirmed ||
          ptData?.checklist?.some((phase) =>
            phase.items?.some((item) => item.id === 'doctor_confirm' && item.status === 'completed')
          )
        );

        const isTimerActive = Boolean(ptData?.countdownTimer?.isActive || pt?.treatmentStatus?.countdown_started_at);
        const isDismissed = Boolean(state.dismissedAlertKeys?.[hn] || state.dismissedAlertKeys?.[patientId]);
        const isCentrallyAcknowledged = Boolean(pt?.treatmentStatus?.acknowledged);

        // If already acknowledged, dismissed, timer running, completed, or ruled out: DO NOT ALERT!
        if (
          isDismissed ||
          isCentrallyAcknowledged ||
          isTimerActive ||
          ptData?.treatmentCompleted ||
          ptData?.sepsisRuledOut ||
          isDoctorConfirmed
        ) {
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

      markAlertDismissed: (hn, key) =>
        set((state) => {
          const updated = {
            ...state.dismissedAlertKeys,
            [hn]: true,
          };
          if (key) updated[key] = true;
          return { dismissedAlertKeys: updated };
        }),

      isAlertDismissed: (hn, key) => {
        const state = get();
        return Boolean(state.dismissedAlertKeys?.[hn] || (key && state.dismissedAlertKeys?.[key]));
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

          const isCurrentlySelected = state.selectedPatient?.id === patientId;

          // Update checklist doctor_confirm if acknowledged or doctor_confirmed
          let updatedChecklist = isCurrentlySelected ? state.checklist : (existingData.checklist || createDefaultChecklist());
          if ((status as any).checklist_json) {
            try {
              const parsed = JSON.parse((status as any).checklist_json);
              if (Array.isArray(parsed) && parsed.length > 0) {
                updatedChecklist = parsed;
              }
            } catch (e) {
              console.warn('[RTSAS] Failed to parse checklist_json in syncServerTreatmentStatus:', e);
            }
          }
          if ((status.doctor_confirmed || status.countdown_started_at) && !status.sepsis_ruled_out) {
            updatedChecklist = updatedChecklist.map((phase) => ({
              ...phase,
              items: phase.items.map((item) =>
                item.id === 'doctor_confirm'
                  ? {
                    ...item,
                    status: 'completed' as const,
                    completedAt: item.completedAt || status.acknowledged_at || new Date().toISOString(),
                    completedBy: item.completedBy || status.acknowledged_by || 'แพทย์เวร ER',
                  }
                  : item
              ),
            }));
          }

          // ALWAYS ensure phase unlock states are accurately calculated
          updatedChecklist = updatePhaseUnlocking(updatedChecklist);

          // Calculate countdown timer from server startedAt
          let updatedTimer = existingData.countdownTimer;
          if (status.countdown_started_at && !status.treatment_completed && !status.sepsis_ruled_out) {
            const startedAt = status.countdown_started_at;
            const totalDuration = status.countdown_duration || 3600;
            const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
            const remaining = Math.max(0, totalDuration - elapsed);
            const isExpired = elapsed >= totalDuration;

            updatedTimer = {
              isActive: true,
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

          // Auto-generate or restore assessment schedule when confirmed
          let updatedSchedule = existingData.assessmentSchedule;
          const confirmTime = status.countdown_started_at || (status.doctor_confirmed ? (status.acknowledged_at || new Date().toISOString()) : null);
          if (confirmTime && !updatedSchedule && !status.sepsis_ruled_out) {
            updatedSchedule = {
              patientId,
              generatedAt: new Date().toISOString(),
              originTime: confirmTime,
              entries: generateAssessmentSchedule(confirmTime),
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
            assessmentSchedule: updatedSchedule,
            treatmentCompleted: status.treatment_completed ?? existingData.treatmentCompleted,
            treatmentCompletedAt: status.treatment_completed_at ?? existingData.treatmentCompletedAt,
            sepsisRuledOut: status.sepsis_ruled_out !== undefined ? Boolean(status.sepsis_ruled_out) : existingData.sepsisRuledOut,
          };

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
            dismissedAlertKeys: isFinishedOrAcknowledged
              ? { ...state.dismissedAlertKeys, [hn]: true }
              : state.dismissedAlertKeys,
            ...(isCurrentlySelected
              ? {
                checklist: updatedChecklist,
                countdownTimer: updatedTimer,
                assessmentSchedule: updatedSchedule,
                treatmentCompleted: updatedPatientData.treatmentCompleted,
                sepsisRuledOut: updatedPatientData.sepsisRuledOut,
              }
              : {}),
          };

        });
      },

      clearTreatedPatients: (hns?: string[]) => {
        set((state) => {
          const hnSet = hns && hns.length > 0 ? new Set(hns) : null;
          const updatedPatientData = { ...state.patientData };

          Object.keys(updatedPatientData).forEach((pid) => {
            const p = updatedPatientData[pid];
            const ptObj = state.patients.find((pt) => pt.id === pid || pt.hn === pid);
            const hn = ptObj?.hn || pid;
            const matches = !hnSet || hnSet.has(pid) || hnSet.has(hn);

            if (matches && p?.treatmentCompleted) {
              updatedPatientData[pid] = {
                ...p,
                treatmentCompleted: false,
                treatmentCompletedAt: null,
              };
            }
          });

          const updatedPatients = state.patients.map((p) => {
            const matches = !hnSet || hnSet.has(p.hn) || hnSet.has(p.id);
            if (matches && p.treatmentStatus?.treatment_completed) {
              return {
                ...p,
                treatmentStatus: {
                  ...p.treatmentStatus,
                  treatment_completed: false,
                  treatment_completed_at: null,
                  treatment_completed_by: null,
                },
              };
            }
            return p;
          });

          const isSelectedTarget = state.selectedPatient &&
            (!hnSet || hnSet.has(state.selectedPatient.hn) || hnSet.has(state.selectedPatient.id));

          return {
            patientData: updatedPatientData,
            patients: updatedPatients,
            ...(isSelectedTarget && state.treatmentCompleted
              ? { treatmentCompleted: false, treatmentCompletedAt: null }
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
        selectedPatient: state.selectedPatient,
        patientData: state.patientData,
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
        dismissedAlertKeys: state.dismissedAlertKeys,
        ui: {
          selectedPatientId: state.ui.selectedPatientId,
          activeTab: state.ui.activeTab,
          isSidebarCollapsed: state.ui.isSidebarCollapsed,
          connectionStatus: state.ui.connectionStatus,
          currentTime: new Date().toISOString(),
          modal: {
            activeModal: null,
            modalData: null,
          },
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
  // If doctor confirmation is already completed or skipped,
  // Phase 2 is considered completed & unlocked, which in turn unlocks Phase 3
  const isDoctorConfirmed = phases.some((p) =>
    p.items?.some((i) => i.id === 'doctor_confirm' && (i.status === 'completed' || i.status === 'skipped'))
  );

  return phases.map((phase, index) => {
    // Check if all items in this phase are completed
    const isCompleted =
      phase.items.length > 0 &&
      phase.items.every((item) => item.status === 'completed' || item.status === 'skipped');

    // Determine if this phase should be unlocked
    let isUnlocked = phase.isUnlocked;
    if (index === 0) {
      isUnlocked = true; // Phase 1 always unlocked
    } else if (index === 1) {
      // Phase 2 (doctor_confirm): unlocked if Phase 1 completed OR if doctor_confirm is already completed
      const prevPhase = phases[0];
      const prevCompleted =
        prevPhase.items.length > 0 &&
        prevPhase.items.every((item) => item.status === 'completed' || item.status === 'skipped');
      if (prevCompleted || isDoctorConfirmed) {
        isUnlocked = true;
      }
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
