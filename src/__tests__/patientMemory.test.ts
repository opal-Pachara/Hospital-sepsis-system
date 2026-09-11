import { describe, it, expect } from 'vitest';
import {
  evaluatePatientTreatmentStatus,
  isPatientActivelyTreated,
  auditPatientMemory,
} from '../utils/patientMemory';
import type { PatientData } from '../store/useRTSASStore';
import type { Patient } from '../types';

function createMockPatientData(overrides: Partial<PatientData> = {}): PatientData {
  return {
    checklist: [
      {
        phase: 'initial_response',
        title: 'Phase 1: Initial Response',
        isUnlocked: true,
        isCompleted: true,
        items: [
          {
            id: 'triage',
            phase: 'initial_response',
            label: 'Triage Assessment',
            status: 'completed',
            completedAt: '2026-09-10T10:00:00Z',
            completedBy: 'Nurse A',
            requiresInput: false,
            inputValue: null,
            inputLabel: null,
            sortOrder: 1,
            isUnlocked: true,
          },
        ],
      },
      {
        phase: 'doctor_confirmation',
        title: 'Phase 2: Doctor Confirmation',
        isUnlocked: true,
        isCompleted: false,
        items: [
          {
            id: 'doctor_confirm',
            phase: 'doctor_confirmation',
            label: 'Doctor Sepsis Confirmation',
            status: 'pending',
            completedAt: null,
            completedBy: null,
            requiresInput: false,
            inputValue: null,
            inputLabel: null,
            sortOrder: 1,
            isUnlocked: true,
          },
        ],
      },
      {
        phase: 'sepsis_bundle',
        title: 'Phase 3: Sepsis Bundle',
        isUnlocked: false,
        isCompleted: false,
        items: [
          {
            id: 'hemoculture_1',
            phase: 'sepsis_bundle',
            label: 'Hemoculture 1',
            status: 'pending',
            completedAt: null,
            completedBy: null,
            requiresInput: true,
            inputValue: null,
            inputLabel: 'Site',
            sortOrder: 1,
            isUnlocked: false,
          },
        ],
      },
    ],
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
    ...overrides,
  };
}

function createMockPatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'HN001',
    hn: 'HN001',
    vn: 'VN001',
    fullName: 'Test Patient',
    age: 65,
    gender: 'male',
    triageLevel: 'emergency',
    arrivalTime: '2026-09-10T10:00:00Z',
    chiefComplaint: 'Fever',
    allergies: [],
    currentRiskLevel: 'high',
    latestNewsScore: 6,
    latestVitals: {
      respiratoryRate: 20,
      spO2: 98,
      oxygenSupplementation: 'room_air',
      temperature: 37.0,
      systolicBP: 120,
      heartRate: 80,
      gcs: 15,
      avpu: 'A',
    },
    latestNewsResult: null,
    hasSepsisAlert: true,
    attendingPhysician: null,
    primaryNurse: null,
    location: 'ER Bed 1',
    ...overrides,
  };
}

describe('evaluatePatientTreatmentStatus & isPatientActivelyTreated', () => {
  it('identifies patient with active countdown timer as actively treated', () => {
    const data = createMockPatientData({
      countdownTimer: {
        isActive: true,
        startedAt: '2026-09-10T10:00:00Z',
        totalDurationSeconds: 3600,
        remainingSeconds: 2450,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
    });

    const status = evaluatePatientTreatmentStatus(data);
    expect(status.isActivelyTreated).toBe(true);
    expect(isPatientActivelyTreated(data)).toBe(true);
    expect(status.reasons.some((r) => r.includes('กำลังจับเวลา Sepsis Bundle'))).toBe(true);
  });

  it('identifies patient with active assessment schedule as actively treated', () => {
    const data = createMockPatientData({
      assessmentSchedule: {
        patientId: 'HN001',
        generatedAt: '2026-09-10T10:00:00Z',
        originTime: '2026-09-10T10:00:00Z',
        entries: [
          {
            id: 'entry-1',
            sequence: 1,
            intervalType: 'Q15',
            scheduledTime: '2026-09-10T10:15:00Z',
            isCompleted: true,
            completedAt: '2026-09-10T10:15:00Z',
            vitals: null,
            newsResult: null,
            reminderTriggered: true,
          },
          {
            id: 'entry-2',
            sequence: 2,
            intervalType: 'Q30',
            scheduledTime: '2026-09-10T10:30:00Z',
            isCompleted: false,
            completedAt: null,
            vitals: null,
            newsResult: null,
            reminderTriggered: false,
          },
        ],
      },
    });

    const status = evaluatePatientTreatmentStatus(data);
    expect(status.isActivelyTreated).toBe(true);
    expect(isPatientActivelyTreated(data)).toBe(true);
    expect(status.reasons.some((r) => r.includes('ตารางประเมินสัญญาณชีพซ้ำ'))).toBe(true);
  });

  it('identifies patient with in-progress Sepsis Bundle as actively treated', () => {
    const data = createMockPatientData({
      checklist: [
        {
          phase: 'doctor_confirmation',
          title: 'Doctor Confirmation',
          isUnlocked: true,
          isCompleted: true,
          items: [
            {
              id: 'doctor_confirm',
              phase: 'doctor_confirmation',
              label: 'Doctor Confirm',
              status: 'completed',
              completedAt: '2026-09-10T10:00:00Z',
              completedBy: 'Dr. Somchai',
              requiresInput: false,
              inputValue: null,
              inputLabel: null,
              sortOrder: 1,
              isUnlocked: true,
            },
          ],
        },
        {
          phase: 'sepsis_bundle',
          title: 'Sepsis Bundle',
          isUnlocked: true,
          isCompleted: false,
          items: [
            {
              id: 'hemoculture_1',
              phase: 'sepsis_bundle',
              label: 'Hemoculture 1',
              status: 'completed',
              completedAt: '2026-09-10T10:10:00Z',
              completedBy: 'Nurse B',
              requiresInput: true,
              inputValue: 'Right arm',
              inputLabel: 'Site',
              sortOrder: 1,
              isUnlocked: true,
            },
            {
              id: 'antibiotics_1',
              phase: 'sepsis_bundle',
              label: 'IV Antibiotics',
              status: 'pending',
              completedAt: null,
              completedBy: null,
              requiresInput: true,
              inputValue: null,
              inputLabel: 'Drug',
              sortOrder: 2,
              isUnlocked: true,
            },
          ],
        },
      ],
    });

    const status = evaluatePatientTreatmentStatus(data);
    expect(status.isActivelyTreated).toBe(true);
    expect(isPatientActivelyTreated(data)).toBe(true);
    expect(status.reasons.some((r) => r.includes('อยู่ระหว่างทำหัตถการ Sepsis Bundle'))).toBe(true);
  });

  it('excludes patient whose treatment is marked completed', () => {
    const data = createMockPatientData({
      treatmentCompleted: true,
      treatmentCompletedAt: '2026-09-10T11:00:00Z',
      countdownTimer: {
        isActive: true,
        startedAt: '2026-09-10T10:00:00Z',
        totalDurationSeconds: 3600,
        remainingSeconds: 1200,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
    });

    const status = evaluatePatientTreatmentStatus(data);
    expect(status.isActivelyTreated).toBe(false);
    expect(isPatientActivelyTreated(data)).toBe(false);
    expect(status.reasons.some((r) => r.includes('สิ้นสุดการรักษาแล้ว'))).toBe(true);
  });

  it('excludes patient whose sepsis is ruled out by doctor', () => {
    const data = createMockPatientData({
      sepsisRuledOut: true,
      ruledOutAt: '2026-09-10T10:30:00Z',
      ruledOutBy: 'Dr. Somchai',
      countdownTimer: {
        isActive: true,
        startedAt: '2026-09-10T10:00:00Z',
        totalDurationSeconds: 3600,
        remainingSeconds: 2000,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
    });

    const status = evaluatePatientTreatmentStatus(data);
    expect(status.isActivelyTreated).toBe(false);
    expect(isPatientActivelyTreated(data)).toBe(false);
    expect(status.reasons.some((r) => r.includes('แพทย์ไม่ยืนยัน Sepsis'))).toBe(true);
  });

  it('excludes idle patient with no timer, no schedule, and no bundle started', () => {
    const data = createMockPatientData();
    const status = evaluatePatientTreatmentStatus(data);
    expect(status.isActivelyTreated).toBe(false);
    expect(isPatientActivelyTreated(data)).toBe(false);
  });

  it('handles null/undefined data safely', () => {
    expect(isPatientActivelyTreated(null)).toBe(false);
    expect(isPatientActivelyTreated(undefined)).toBe(false);
  });
});

describe('auditPatientMemory', () => {
  it('correctly categorizes active vs inactive patients for memory clearing audit', () => {
    const activePatientData = createMockPatientData({
      countdownTimer: {
        isActive: true,
        startedAt: '2026-09-10T10:00:00Z',
        totalDurationSeconds: 3600,
        remainingSeconds: 1800,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
    });

    const finishedPatientData = createMockPatientData({
      treatmentCompleted: true,
      treatmentCompletedAt: '2026-09-10T11:00:00Z',
    });

    const idlePatientData = createMockPatientData();

    const patientMap: Record<string, PatientData> = {
      'HN001': activePatientData,
      'HN002': finishedPatientData,
      'HN003': idlePatientData,
    };

    const mockPatients: Patient[] = [
      createMockPatient({
        id: 'HN001',
        hn: 'HN001',
        fullName: 'Active Patient',
        currentRiskLevel: 'high',
        latestNewsScore: 6,
      }),
      createMockPatient({
        id: 'HN002',
        hn: 'HN002',
        fullName: 'Finished Patient',
        currentRiskLevel: 'low',
        latestNewsScore: 2,
        hasSepsisAlert: false,
      }),
    ];

    const audit = auditPatientMemory(patientMap, mockPatients);
    expect(audit.totalPatientsInMemory).toBe(3);
    expect(audit.activeTreatedCount).toBe(1);
    expect(audit.inactiveCount).toBe(2);

    expect(audit.retainedPatients[0].id).toBe('HN001');
    expect(audit.retainedPatients[0].name).toBe('Active Patient');
    expect(audit.retainedPatients[0].reasons.length).toBeGreaterThan(0);

    const inactiveIds = audit.inactivePatients.map((p) => p.id);
    expect(inactiveIds).toContain('HN002');
    expect(inactiveIds).toContain('HN003');
  });
});
