// =============================================================================
// Real-Time Sepsis Alert System (RTSAS) — Domain Types
// =============================================================================

// ---------------------------------------------------------------------------
// Enums & Literal Types
// ---------------------------------------------------------------------------

/** AVPU consciousness scale */
export type AVPULevel = 'A' | 'V' | 'P' | 'U';

/** Supplemental oxygen status */
export type OxygenStatus = 'room_air' | 'supplemental';

/** Risk severity derived from aggregate NEWS score */
export type RiskLevel = 'low' | 'low_medium' | 'medium' | 'high';

/** Triage color coding (Thai ER standard) */
export type TriageLevel = 'resuscitation' | 'emergency' | 'urgent' | 'semi_urgent' | 'non_urgent';

/** Connection status indicator */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

/** Checklist item completion state */
export type ChecklistItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

/** Workflow phase identifiers */
export type WorkflowPhase =
  | 'initial_response'
  | 'doctor_confirmation'
  | 'sepsis_bundle'
  | 'assessment_schedule';

/** Timeline event color/severity classification */
export type TimelineEventColor = 'green' | 'blue' | 'orange' | 'red' | 'gray';

/** Assessment schedule interval type */
export type AssessmentIntervalType = 'Q15' | 'Q30';

// ---------------------------------------------------------------------------
// Vital Signs & NEWS Scoring
// ---------------------------------------------------------------------------

/**
 * Raw vital sign measurements captured at a single point in time.
 * All numeric fields are nullable to handle missing/unavailable data.
 */
export interface VitalSigns {
  /** Respiratory rate (breaths per minute) */
  respiratoryRate: number | null;

  /** Peripheral oxygen saturation (%) */
  spO2: number | null;

  /** Whether the patient is on supplemental O₂ */
  oxygenSupplementation: OxygenStatus;

  /** Core body temperature (°C) */
  temperature: number | null;

  /** Systolic blood pressure (mmHg) */
  systolicBP: number | null;

  /** Heart rate (beats per minute) */
  heartRate: number | null;

  /** AVPU consciousness level */
  avpu: AVPULevel;
}

/**
 * Individual parameter NEWS score breakdown.
 * Each entry shows which parameter, its raw value, and the assigned score.
 */
export interface NEWSParameterScore {
  /** Parameter identifier */
  parameter:
    | 'respiratoryRate'
    | 'spO2'
    | 'oxygenSupplementation'
    | 'temperature'
    | 'systolicBP'
    | 'heartRate'
    | 'avpu';

  /** Human-readable label */
  label: string;

  /** Raw value as string for display (e.g., "22 bpm", "95%", "A") */
  displayValue: string;

  /** Individual NEWS score (0–3) */
  score: number;

  /** Whether this parameter is flagged as abnormal (score >= 1) */
  isAbnormal: boolean;

  /** Whether this parameter triggers a single-parameter alert (score = 3) */
  isCritical: boolean;
}

/**
 * Complete NEWS calculation result.
 */
export interface NEWSResult {
  /** Aggregate NEWS score (0–20) */
  totalScore: number;

  /** Per-parameter breakdown */
  breakdown: NEWSParameterScore[];

  /** Derived clinical risk level */
  riskLevel: RiskLevel;

  /** Whether any single parameter scored 3 (triggers medium-risk protocol) */
  hasSingleParameterAlert: boolean;

  /** Number of parameters with missing data */
  missingDataCount: number;

  /** Timestamp of calculation */
  calculatedAt: string;
}

// ---------------------------------------------------------------------------
// Patient
// ---------------------------------------------------------------------------

/**
 * Core patient record. Represents a patient currently under monitoring.
 */
export interface Patient {
  /** Unique identifier (e.g., HN number) */
  id: string;

  /** Hospital Number */
  hn: string;

  /** Visit Number */
  vn: string;

  /** Full patient name */
  fullName: string;

  /** Age in years */
  age: number;

  /** Gender */
  gender: 'male' | 'female' | 'other';

  /** Triage classification on arrival */
  triageLevel: TriageLevel;

  /** ISO 8601 timestamp of ER arrival */
  arrivalTime: string;

  /** Chief complaint / presenting symptoms */
  chiefComplaint: string;

  /** Known allergies */
  allergies: string[];

  /** Current risk level based on latest NEWS score */
  currentRiskLevel: RiskLevel;

  /** Latest calculated NEWS score */
  latestNewsScore: number;

  /** Latest vital signs */
  latestVitals: VitalSigns;

  /** Full NEWS result for latest vitals */
  latestNewsResult: NEWSResult | null;

  /** Whether the patient has an active sepsis alert */
  hasSepsisAlert: boolean;

  /** Attending physician name (if assigned) */
  attendingPhysician: string | null;

  /** Responsible nurse name */
  primaryNurse: string | null;

  /** Bed/location */
  location: string;
}

// ---------------------------------------------------------------------------
// Checklist & Workflow
// ---------------------------------------------------------------------------

/**
 * A single step within a checklist phase.
 */
export interface ChecklistItem {
  /** Unique item ID */
  id: string;

  /** Phase this item belongs to */
  phase: WorkflowPhase;

  /** Display label */
  label: string;

  /** Current status */
  status: ChecklistItemStatus;

  /** ISO 8601 timestamp when completed */
  completedAt: string | null;

  /** Person who completed this item */
  completedBy: string | null;

  /** Whether this item requires text input (e.g., drug name, injection site) */
  requiresInput: boolean;

  /** Text input value if applicable */
  inputValue: string | null;

  /** Input placeholder/label text */
  inputLabel: string | null;

  /** Order within the phase */
  sortOrder: number;

  /** Whether this item is currently actionable (unlocked) */
  isUnlocked: boolean;
}

/**
 * Represents a phase of the workflow containing multiple checklist items.
 */
export interface ChecklistPhase {
  /** Phase identifier */
  phase: WorkflowPhase;

  /** Display title */
  title: string;

  /** Items within this phase */
  items: ChecklistItem[];

  /** Whether the phase is unlocked for interaction */
  isUnlocked: boolean;

  /** Whether all items in this phase are completed */
  isCompleted: boolean;
}

// ---------------------------------------------------------------------------
// Assessment Schedule
// ---------------------------------------------------------------------------

/**
 * A scheduled vital signs assessment entry.
 */
export interface AssessmentScheduleEntry {
  /** Unique ID for this scheduled entry */
  id: string;

  /** Sequence number (1-based) */
  sequence: number;

  /** Interval type */
  intervalType: AssessmentIntervalType;

  /** ISO 8601 scheduled time */
  scheduledTime: string;

  /** Whether the assessment has been completed */
  isCompleted: boolean;

  /** ISO 8601 actual completion time */
  completedAt: string | null;

  /** Vital signs recorded during this assessment */
  vitals: VitalSigns | null;

  /** NEWS result for this assessment */
  newsResult: NEWSResult | null;

  /** Whether a reminder has been triggered */
  reminderTriggered: boolean;
}

/**
 * Full assessment schedule for a patient.
 */
export interface AssessmentSchedule {
  /** Patient ID reference */
  patientId: string;

  /** ISO 8601 timestamp when the schedule was generated */
  generatedAt: string;

  /** Origin time (doctor confirmation time) from which schedule is derived */
  originTime: string;

  /** All scheduled entries */
  entries: AssessmentScheduleEntry[];
}

// ---------------------------------------------------------------------------
// Timeline / Event Log
// ---------------------------------------------------------------------------

/**
 * A single event in the patient's timeline log.
 * Follows an event-sourcing pattern — every state change dispatches one.
 */
export interface TimelineEvent {
  /** Unique event ID */
  id: string;

  /** ISO 8601 timestamp of the event */
  timestamp: string;

  /** Human-readable action description */
  actionText: string;

  /** Color-coded severity/category */
  color: TimelineEventColor;

  /** The user or system that performed the action */
  actor: string;

  /** Optional detailed payload (e.g., vital sign values, drug info) */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Countdown Timer
// ---------------------------------------------------------------------------

/**
 * State of the 60-minute sepsis bundle countdown timer.
 */
export interface CountdownTimer {
  /** Whether the timer is currently active */
  isActive: boolean;

  /** ISO 8601 timestamp when the timer started (doctor confirmation time) */
  startedAt: string | null;

  /** Total duration in seconds (3600 = 60 min) */
  totalDurationSeconds: number;

  /** Remaining seconds */
  remainingSeconds: number;

  /** Whether the timer has expired */
  isExpired: boolean;

  /** Whether the timer is in the warning zone (< 15 min remaining) */
  isWarning: boolean;

  /** Whether the timer is in the critical zone (< 5 min remaining) */
  isCritical: boolean;
}

// ---------------------------------------------------------------------------
// Modal State
// ---------------------------------------------------------------------------

export type ModalType = 'alert' | 'reminder' | 'assessment_form' | null;

export interface ModalState {
  /** Currently open modal type */
  activeModal: ModalType;

  /** Data payload for the active modal */
  modalData: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Application-level UI State
// ---------------------------------------------------------------------------

export type ActiveTab = 'checklist' | 'timeline';

export interface UIState {
  /** Currently selected patient ID */
  selectedPatientId: string | null;

  /** Active tab in the workflow panel */
  activeTab: ActiveTab;

  /** Sidebar collapsed state */
  isSidebarCollapsed: boolean;

  /** Connection status */
  connectionStatus: ConnectionStatus;

  /** Current system time (ISO 8601, updated every second) */
  currentTime: string;

  /** Modal state */
  modal: ModalState;
}
