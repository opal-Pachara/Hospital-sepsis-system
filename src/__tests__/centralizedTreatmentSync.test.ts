import { describe, it, expect, beforeEach } from 'vitest';
import { useRTSASStore } from '../store/useRTSASStore';
import type { TreatmentStatus } from '../types';

describe('Centralized Treatment & Alert Synchronization', () => {
  beforeEach(() => {
    // Reset store state
    useRTSASStore.setState({
      pendingAlerts: [],
      patientData: {},
      ui: {
        ...useRTSASStore.getState().ui,
        modal: { activeModal: null, modalData: null },
      },
    });
  });

  it('syncServerTreatmentStatus marks doctor_confirm completed and syncs countdown timer', () => {
    const fakeStartedAt = new Date(Date.now() - 60000).toISOString(); // 1 min ago
    const status: TreatmentStatus = {
      hn: 'HN-SYNC-001',
      acknowledged: true,
      acknowledged_at: fakeStartedAt,
      acknowledged_by: 'Nurse Test',
      doctor_confirmed: true,
      countdown_started_at: fakeStartedAt,
      countdown_duration: 3600,
      treatment_completed: false,
      sepsis_ruled_out: false,
    };

    useRTSASStore.getState().syncServerTreatmentStatus(status);

    const data = useRTSASStore.getState().patientData['HN-SYNC-001'];
    expect(data).toBeDefined();

    const doctorConfirmItem = data.checklist
      ?.flatMap((p) => p.items)
      .find((i) => i.id === 'doctor_confirm');
    expect(doctorConfirmItem?.status).toBe('completed');
    expect(doctorConfirmItem?.completedBy).toBe('Nurse Test');

    expect(data.countdownTimer.isActive).toBe(true);
    expect(data.countdownTimer.startedAt).toBe(fakeStartedAt);
    expect(data.countdownTimer.remainingSeconds).toBeLessThanOrEqual(3545);
  });

  it('queueAlert skips alert popup if patient is already acknowledged centrally', () => {
    const status: TreatmentStatus = {
      hn: 'HN-SYNC-002',
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: 'Nurse Remote Browser',
      doctor_confirmed: true,
      countdown_started_at: new Date().toISOString(),
      countdown_duration: 3600,
      treatment_completed: false,
      sepsis_ruled_out: false,
    };

    // Simulate Server sync
    useRTSASStore.getState().syncServerTreatmentStatus(status);

    // Now attempt to queue alert for this patient
    useRTSASStore.getState().queueAlert('HN-SYNC-002', 7);

    // Verification: should NOT add to pendingAlerts and modal must NOT open
    expect(useRTSASStore.getState().pendingAlerts).toHaveLength(0);
    expect(useRTSASStore.getState().ui.modal.activeModal).toBeNull();
  });

  it('queueAlert skips alert popup if patient treatment is completed centrally', () => {
    const status: TreatmentStatus = {
      hn: 'HN-SYNC-003',
      acknowledged: true,
      doctor_confirmed: true,
      countdown_duration: 3600,
      treatment_completed: true,
      treatment_completed_at: new Date().toISOString(),
      treatment_completed_by: 'Doctor Lead',
      sepsis_ruled_out: false,
    };

    useRTSASStore.getState().syncServerTreatmentStatus(status);
    useRTSASStore.getState().queueAlert('HN-SYNC-003', 8);

    expect(useRTSASStore.getState().pendingAlerts).toHaveLength(0);
    expect(useRTSASStore.getState().ui.modal.activeModal).toBeNull();
  });

  it('queueAlert opens modal for newly arriving unacknowledged high-risk patient', () => {
    useRTSASStore.getState().queueAlert('HN-NEW-UNACK', 6);

    expect(useRTSASStore.getState().pendingAlerts).toHaveLength(1);
    expect(useRTSASStore.getState().ui.modal.activeModal).toBe('alert');
    expect(useRTSASStore.getState().ui.modal.modalData?.hn).toBe('HN-NEW-UNACK');
  });

  it('queueAlert skips alert popup if alert was marked as dismissed', () => {
    useRTSASStore.getState().markAlertDismissed('HN-DISMISSED-001');
    expect(useRTSASStore.getState().isAlertDismissed('HN-DISMISSED-001')).toBe(true);

    useRTSASStore.getState().queueAlert('HN-DISMISSED-001', 9);

    expect(useRTSASStore.getState().pendingAlerts).toHaveLength(0);
    expect(useRTSASStore.getState().ui.modal.activeModal).toBeNull();
  });

  it('syncServerTreatmentStatus marks alert as dismissed when patient is acknowledged', () => {
    const status: TreatmentStatus = {
      hn: 'HN-SYNC-ACK-001',
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: 'Nurse Auto',
      doctor_confirmed: true,
      countdown_started_at: new Date().toISOString(),
      countdown_duration: 3600,
      treatment_completed: false,
      sepsis_ruled_out: false,
    };

    useRTSASStore.getState().syncServerTreatmentStatus(status);

    expect(useRTSASStore.getState().dismissedAlertKeys['HN-SYNC-ACK-001']).toBe(true);
    expect(useRTSASStore.getState().isAlertDismissed('HN-SYNC-ACK-001')).toBe(true);
  });

  it('clearTreatedPatients resets treatmentCompleted for treated patients while preserving active patients', () => {
    // Setup 1 completed patient and 1 active patient
    useRTSASStore.setState({
      patientData: {
        'HN-COMPLETED': {
          treatmentCompleted: true,
          treatmentCompletedAt: '2026-09-12T14:00:00Z',
          countdownTimer: { isActive: false, remainingSeconds: 0, totalDurationSeconds: 3600, startedAt: null, isExpired: false, isWarning: false, isCritical: false },
          checklist: [],
          timeline: [],
          assessmentSchedule: null,
          sepsisRuledOut: false,
          ruledOutAt: null,
          ruledOutBy: null,
        },
        'HN-ACTIVE': {
          treatmentCompleted: false,
          treatmentCompletedAt: null,
          countdownTimer: { isActive: true, remainingSeconds: 2400, totalDurationSeconds: 3600, startedAt: '2026-09-12T14:00:00Z', isExpired: false, isWarning: false, isCritical: false },
          checklist: [],
          timeline: [],
          assessmentSchedule: null,
          sepsisRuledOut: false,
          ruledOutAt: null,
          ruledOutBy: null,
        },
      },
    });

    useRTSASStore.getState().clearTreatedPatients(['HN-COMPLETED']);

    const afterData = useRTSASStore.getState().patientData;
    expect(afterData['HN-COMPLETED'].treatmentCompleted).toBe(false);
    expect(afterData['HN-COMPLETED'].treatmentCompletedAt).toBeNull();
    // Active patient remains completely untouched
    expect(afterData['HN-ACTIVE'].treatmentCompleted).toBe(false);
    expect(afterData['HN-ACTIVE'].countdownTimer?.isActive).toBe(true);
  });

  it('syncServerTreatmentStatus keeps countdownTimer active on expiry and populates assessmentSchedule', () => {
    // Confirmation was 75 minutes ago (overdue)
    const overSixtyMinsAgo = new Date(Date.now() - 75 * 60 * 1000).toISOString();
    const status: TreatmentStatus = {
      hn: 'HN-OVERDUE-01',
      acknowledged: true,
      acknowledged_at: overSixtyMinsAgo,
      acknowledged_by: 'นพ.สมหมาย',
      doctor_confirmed: true,
      countdown_started_at: overSixtyMinsAgo,
      countdown_duration: 3600,
      treatment_completed: false,
      sepsis_ruled_out: false,
    };

    useRTSASStore.getState().syncServerTreatmentStatus(status);

    const data = useRTSASStore.getState().patientData['HN-OVERDUE-01'];
    expect(data).toBeDefined();
    // Timer must stay active with isExpired=true so UI renders overdue alert
    expect(data.countdownTimer.isActive).toBe(true);
    expect(data.countdownTimer.isExpired).toBe(true);
    expect(data.countdownTimer.remainingSeconds).toBe(0);

    // Assessment schedule must be generated with 8 entries
    expect(data.assessmentSchedule).toBeDefined();
    expect(data.assessmentSchedule?.entries).toHaveLength(8);
    expect(data.assessmentSchedule?.originTime).toBe(overSixtyMinsAgo);
  });
});


