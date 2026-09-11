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
});
