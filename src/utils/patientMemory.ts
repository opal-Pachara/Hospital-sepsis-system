import type { PatientData } from '../store/useRTSASStore';
import type { Patient } from '../types';

export interface PatientTreatmentStatus {
  isActivelyTreated: boolean;
  reasons: string[];
  timerInfo?: {
    isActive: boolean;
    remainingSeconds: number;
    startedAt: string | null;
  };
  assessmentInfo?: {
    totalEntries: number;
    pendingCount: number;
    completedCount: number;
  };
  bundleInfo?: {
    isDoctorConfirmed: boolean;
    completedItemsCount: number;
    totalBundleItems: number;
  };
}

export interface RetainedPatientSummary {
  id: string;
  hn: string;
  name: string;
  reasons: string[];
  remainingTimerSeconds?: number;
  pendingAssessmentsCount?: number;
}

export interface InactivePatientSummary {
  id: string;
  hn: string;
  name: string;
  statusLabel: string;
}

export interface PatientMemoryAudit {
  totalPatientsInMemory: number;
  activeTreatedCount: number;
  inactiveCount: number;
  retainedPatients: RetainedPatientSummary[];
  inactivePatients: InactivePatientSummary[];
}

export interface ClearMemoryResult {
  totalBefore: number;
  clearedCount: number;
  retainedCount: number;
  retainedPatients: RetainedPatientSummary[];
  clearedPatientIds: string[];
}

/**
 * Checks whether a patient's data indicates active clinical treatment,
 * active countdown timer, or active assessment schedule recordings.
 *
 * Requirements:
 * "ผู้ป่วยคนไหนที่กำลังรักษาอยู่ที่เป็นการจับเวลาบันทึกผลนั้นให้ ยังไม่เคลียร์ ออกจาก memory"
 *
 * Rules:
 * 1. Ruled out (sepsisRuledOut) OR Completed (treatmentCompleted) -> INACTIVE (Can clear)
 * 2. Active countdown timer (isActive && !isExpired) OR timer started with remaining seconds -> ACTIVE (Keep)
 * 3. Assessment schedule with pending recordings (not completed & not canceled) -> ACTIVE (Keep)
 * 4. Sepsis bundle protocol initiated (doctor_confirm done or bundle items started) -> ACTIVE (Keep)
 */
export function evaluatePatientTreatmentStatus(data?: PatientData | null): PatientTreatmentStatus {
  if (!data) {
    return { isActivelyTreated: false, reasons: [] };
  }

  // 1. Explicitly finished or ruled out -> NOT active
  if (data.sepsisRuledOut) {
    return { isActivelyTreated: false, reasons: ['แพทย์ไม่ยืนยัน Sepsis (Ruled Out)'] };
  }
  if (data.treatmentCompleted) {
    return { isActivelyTreated: false, reasons: ['สิ้นสุดการรักษาแล้ว (Treatment Completed)'] };
  }

  const reasons: string[] = [];
  let isActivelyTreated = false;

  // 2. Countdown Timer (การจับเวลา Sepsis Bundle)
  const timer = data.countdownTimer;
  let timerInfo: PatientTreatmentStatus['timerInfo'] = undefined;
  if (timer) {
    timerInfo = {
      isActive: Boolean(timer.isActive),
      remainingSeconds: timer.remainingSeconds,
      startedAt: timer.startedAt,
    };

    if (timer.isActive && !timer.isExpired) {
      isActivelyTreated = true;
      const mins = Math.max(0, Math.floor(timer.remainingSeconds / 60));
      const secs = Math.max(0, timer.remainingSeconds % 60);
      reasons.push(`กำลังจับเวลา Sepsis Bundle (${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')})`);
    } else if (timer.startedAt && timer.remainingSeconds > 0 && !timer.isExpired) {
      isActivelyTreated = true;
      const mins = Math.max(0, Math.floor(timer.remainingSeconds / 60));
      reasons.push(`เวลานับถอยหลังคงเหลือ ${mins} นาที`);
    }
  }

  // 3. Assessment Schedule (การบันทึกผลสัญญาณชีพซ้ำตามรอบเวลา)
  const schedule = data.assessmentSchedule;
  let assessmentInfo: PatientTreatmentStatus['assessmentInfo'] = undefined;
  if (schedule && schedule.entries && schedule.entries.length > 0) {
    const total = schedule.entries.length;
    const completed = schedule.entries.filter((e) => e.isCompleted).length;
    const pending = schedule.entries.filter((e) => !e.isCompleted && !e.isCanceled).length;

    assessmentInfo = {
      totalEntries: total,
      pendingCount: pending,
      completedCount: completed,
    };

    if (pending > 0) {
      isActivelyTreated = true;
      reasons.push(`ตารางประเมินสัญญาณชีพซ้ำ (รอตรวจบันทึกผลอีก ${pending}/${total} ครั้ง)`);
    }
  }

  // 4. Clinical Bundle Progression (หัตถการ Sepsis Bundle ที่กำลังทำ)
  let bundleInfo: PatientTreatmentStatus['bundleInfo'] = undefined;
  if (data.checklist && data.checklist.length > 0) {
    const isDoctorConfirmed = data.checklist.some((phase) =>
      phase.items.some((item) => item.id === 'doctor_confirm' && item.status === 'completed')
    );

    const bundlePhase = data.checklist.find((phase) => phase.phase === 'sepsis_bundle');
    const bundleItems = bundlePhase?.items || [];
    const completedBundleItems = bundleItems.filter(
      (item) => item.status === 'completed' || item.status === 'skipped'
    ).length;

    bundleInfo = {
      isDoctorConfirmed,
      completedItemsCount: completedBundleItems,
      totalBundleItems: bundleItems.length,
    };

    if (isDoctorConfirmed && (!bundlePhase || !bundlePhase.isCompleted)) {
      isActivelyTreated = true;
      reasons.push(`อยู่ระหว่างทำหัตถการ Sepsis Bundle (${completedBundleItems}/${bundleItems.length} รายการ)`);
    }
  }

  return {
    isActivelyTreated,
    reasons,
    timerInfo,
    assessmentInfo,
    bundleInfo,
  };
}

/**
 * Boolean shortcut to check if patient is actively undergoing treatment/timers/assessments.
 */
export function isPatientActivelyTreated(data?: PatientData | null): boolean {
  return evaluatePatientTreatmentStatus(data).isActivelyTreated;
}

/**
 * Audit memory for all patients to inspect what will be kept vs cleared.
 */
export function auditPatientMemory(
  patientDataMap: Record<string, PatientData>,
  patientsList: Patient[]
): PatientMemoryAudit {
  const retainedPatients: RetainedPatientSummary[] = [];
  const inactivePatients: InactivePatientSummary[] = [];

  for (const [id, data] of Object.entries(patientDataMap)) {
    const patientObj = patientsList.find((p) => p.id === id || p.hn === id);
    const hn = patientObj?.hn || id;
    const name = patientObj?.fullName || 'ไม่ระบุชื่อ';
    const status = evaluatePatientTreatmentStatus(data);

    if (status.isActivelyTreated) {
      retainedPatients.push({
        id,
        hn,
        name,
        reasons: status.reasons,
        remainingTimerSeconds: status.timerInfo?.remainingSeconds,
        pendingAssessmentsCount: status.assessmentInfo?.pendingCount,
      });
    } else {
      let statusLabel = 'ไม่ได้เริ่มการรักษา';
      if (data.treatmentCompleted) statusLabel = 'สิ้นสุดการรักษาแล้ว';
      else if (data.sepsisRuledOut) statusLabel = 'แพทย์ไม่ยืนยัน Sepsis';
      else if (data.countdownTimer?.isExpired) statusLabel = 'หมดเวลานับถอยหลัง';

      inactivePatients.push({
        id,
        hn,
        name,
        statusLabel,
      });
    }
  }

  return {
    totalPatientsInMemory: Object.keys(patientDataMap).length,
    activeTreatedCount: retainedPatients.length,
    inactiveCount: inactivePatients.length,
    retainedPatients,
    inactivePatients,
  };
}
