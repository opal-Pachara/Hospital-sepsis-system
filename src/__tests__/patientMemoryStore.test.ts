import { describe, it, expect, beforeEach } from 'vitest';
import { useRTSASStore } from '../store/useRTSASStore';
import type { PatientData } from '../store/useRTSASStore';

describe('useRTSASStore - clearInactivePatientsMemory', () => {
  beforeEach(() => {
    // Reset store state
    useRTSASStore.setState({
      patientData: {},
      selectedPatient: null,
      timeline: [],
      assessmentSchedule: null,
      sepsisRuledOut: false,
      treatmentCompleted: false,
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
  });

  it('keeps patients with active timer and clears completed or idle patients', () => {
    const activePatientData: PatientData = {
      checklist: [],
      timeline: [],
      countdownTimer: {
        isActive: true,
        startedAt: new Date().toISOString(),
        totalDurationSeconds: 3600,
        remainingSeconds: 2100,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
      assessmentSchedule: {
        patientId: 'HN_ACTIVE',
        generatedAt: new Date().toISOString(),
        originTime: new Date().toISOString(),
        entries: [
          {
            id: 'e1',
            sequence: 1,
            intervalType: 'Q15',
            scheduledTime: new Date().toISOString(),
            isCompleted: false,
            completedAt: null,
            vitals: null,
            newsResult: null,
            reminderTriggered: false,
          },
        ],
      },
      sepsisRuledOut: false,
      ruledOutAt: null,
      ruledOutBy: null,
      treatmentCompleted: false,
      treatmentCompletedAt: null,
    };

    const finishedPatientData: PatientData = {
      checklist: [],
      timeline: [],
      countdownTimer: {
        isActive: false,
        startedAt: null,
        totalDurationSeconds: 3600,
        remainingSeconds: 0,
        isExpired: true,
        isWarning: false,
        isCritical: false,
      },
      assessmentSchedule: null,
      sepsisRuledOut: false,
      ruledOutAt: null,
      ruledOutBy: null,
      treatmentCompleted: true,
      treatmentCompletedAt: new Date().toISOString(),
    };

    const ruledOutPatientData: PatientData = {
      checklist: [],
      timeline: [],
      countdownTimer: {
        isActive: false,
        startedAt: null,
        totalDurationSeconds: 3600,
        remainingSeconds: 0,
        isExpired: false,
        isWarning: false,
        isCritical: false,
      },
      assessmentSchedule: null,
      sepsisRuledOut: true,
      ruledOutAt: new Date().toISOString(),
      ruledOutBy: 'Dr. Test',
      treatmentCompleted: false,
      treatmentCompletedAt: null,
    };

    const idlePatientData: PatientData = {
      checklist: [],
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

    useRTSASStore.setState({
      patientData: {
        'HN_ACTIVE': activePatientData,
        'HN_FINISHED': finishedPatientData,
        'HN_RULED_OUT': ruledOutPatientData,
        'HN_IDLE': idlePatientData,
      },
    });

    const result = useRTSASStore.getState().clearInactivePatientsMemory();

    expect(result.totalBefore).toBe(4);
    expect(result.retainedCount).toBe(1);
    expect(result.clearedCount).toBe(3);
    expect(result.retainedPatients[0].id).toBe('HN_ACTIVE');
    expect(result.clearedPatientIds).toContain('HN_FINISHED');
    expect(result.clearedPatientIds).toContain('HN_RULED_OUT');
    expect(result.clearedPatientIds).toContain('HN_IDLE');

    const updatedData = useRTSASStore.getState().patientData;
    expect(updatedData['HN_ACTIVE']).toBeDefined();
    expect(updatedData['HN_FINISHED']).toBeUndefined();
    expect(updatedData['HN_RULED_OUT']).toBeUndefined();
    expect(updatedData['HN_IDLE']).toBeUndefined();
  });
});
