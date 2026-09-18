import { describe, it, expect, beforeEach } from 'vitest';
import { useRTSASStore } from '../store/useRTSASStore';
import { createNextAssessmentEntry } from '../utils/newsCalculator';
import type { VitalSigns } from '../types';

describe('Sequential Assessment Schedule Chaining & Reminders', () => {
  const dummyVitals: VitalSigns = {
    respiratoryRate: 18,
    oxygenSaturation: 98,
    supplementalOxygen: false,
    temperature: 37.0,
    systolicBP: 120,
    heartRate: 75,
    consciousness: 'ALERT',
  };

  beforeEach(() => {
    // Reset store state
    useRTSASStore.setState({
      patients: [
        {
          id: 'PATIENT_TEST_SEQ',
          hn: 'HN_TEST_SEQ',
          name: 'นายทดสอบ ลำดับ',
          age: 45,
          gender: 'male',
          bedNumber: 'ER-01',
          triageLevel: 2,
          admissionTime: '2026-09-17T10:00:00.000Z',
          vitalSigns: dummyVitals,
          newsScore: 6,
          riskLevel: 'medium',
          status: 'in_treatment',
          diagnosis: 'Sepsis',
        },
      ],
      selectedPatient: {
        id: 'PATIENT_TEST_SEQ',
        hn: 'HN_TEST_SEQ',
        name: 'นายทดสอบ ลำดับ',
        age: 45,
        gender: 'male',
        bedNumber: 'ER-01',
        triageLevel: 2,
        admissionTime: '2026-09-17T10:00:00.000Z',
        vitalSigns: dummyVitals,
        newsScore: 6,
        riskLevel: 'medium',
        status: 'in_treatment',
        diagnosis: 'Sepsis',
      },
      patientData: {},
      assessmentSchedule: null,
      ui: {
        activeTab: 'timeline',
        sidebarOpen: true,
        isLoading: false,
        connectionStatus: 'connected',
        currentTime: new Date().toISOString(),
        modal: { activeModal: null, modalData: null },
      },
    });
  });

  it('createNextAssessmentEntry creates Q15 for sequence <= 4 and Q30 for sequence >= 5', () => {
    const origin = '2026-09-17T10:00:00.000Z';
    const entry3 = createNextAssessmentEntry(3, origin);
    expect(entry3.sequence).toBe(3);
    expect(entry3.intervalType).toBe('Q15');
    // 15 minutes later
    expect(new Date(entry3.scheduledTime).getTime()).toBe(
      new Date(origin).getTime() + 15 * 60 * 1000
    );

    const entry5 = createNextAssessmentEntry(5, origin);
    expect(entry5.sequence).toBe(5);
    expect(entry5.intervalType).toBe('Q30');
    // 30 minutes later
    expect(new Date(entry5.scheduledTime).getTime()).toBe(
      new Date(origin).getTime() + 30 * 60 * 1000
    );
  });

  it('completeAssessment chains Round 2 to exactly 15 minutes after Round 1 is recorded', () => {
    const store = useRTSASStore.getState();
    const originTime = '2026-09-17T10:00:00.000Z';
    store.generateSchedule(originTime);

    const scheduleBefore = useRTSASStore.getState().assessmentSchedule!;
    expect(scheduleBefore.entries).toHaveLength(8);

    const round1 = scheduleBefore.entries[0];
    const beforeNow = Date.now();

    // Nurse completes Round 1
    useRTSASStore.getState().completeAssessment(round1.id, dummyVitals, 'พยาบาลสมศรี');

    const scheduleAfter = useRTSASStore.getState().assessmentSchedule!;
    const completedRound1 = scheduleAfter.entries[0];
    const round2 = scheduleAfter.entries[1];

    expect(completedRound1.isCompleted).toBe(true);
    expect(completedRound1.completedAt).not.toBeNull();

    // Round 2 scheduledTime is now dynamically set to completedAt + 15 minutes
    const round2Time = new Date(round2.scheduledTime).getTime();
    const expectedTime = beforeNow + 15 * 60 * 1000;
    // Within 2 seconds of tolerance
    expect(Math.abs(round2Time - expectedTime)).toBeLessThan(2000);
    expect(round2.reminderTriggered).toBe(false);
  });

  it('completeAssessment chains Round 5 to exactly 30 minutes after Round 4 is recorded', () => {
    const store = useRTSASStore.getState();
    store.generateSchedule('2026-09-17T10:00:00.000Z');

    // Complete rounds 1 to 4
    for (let i = 0; i < 4; i++) {
      const entries = useRTSASStore.getState().assessmentSchedule!.entries;
      useRTSASStore.getState().completeAssessment(entries[i].id, dummyVitals, 'พยาบาล');
    }

    const scheduleAfter4 = useRTSASStore.getState().assessmentSchedule!;
    const round5 = scheduleAfter4.entries[4];
    expect(round5.sequence).toBe(5);
    expect(round5.intervalType).toBe('Q30');

    const round4CompletedAt = new Date(scheduleAfter4.entries[3].completedAt!).getTime();
    const round5ScheduledTime = new Date(round5.scheduledTime).getTime();

    // Round 5 should be scheduled 30 minutes after Round 4 completedAt
    expect(round5ScheduledTime - round4CompletedAt).toBe(30 * 60 * 1000);
  });

  it('dynamically creates Round 9 and beyond when subsequent Q30 rounds are completed', () => {
    const store = useRTSASStore.getState();
    store.generateSchedule('2026-09-17T10:00:00.000Z');

    // Complete initial 8 rounds
    for (let i = 0; i < 8; i++) {
      const entries = useRTSASStore.getState().assessmentSchedule!.entries;
      useRTSASStore.getState().completeAssessment(entries[i].id, dummyVitals, 'พยาบาล');
    }

    const scheduleAfter8 = useRTSASStore.getState().assessmentSchedule!;
    // Round 9 must now exist!
    expect(scheduleAfter8.entries.length).toBeGreaterThanOrEqual(9);

    const round9 = scheduleAfter8.entries.find((e) => e.sequence === 9);
    expect(round9).toBeDefined();
    expect(round9?.intervalType).toBe('Q30');

    const round8CompletedAt = new Date(scheduleAfter8.entries[7].completedAt!).getTime();
    const round9ScheduledTime = new Date(round9!.scheduledTime).getTime();
    expect(round9ScheduledTime - round8CompletedAt).toBe(30 * 60 * 1000);
  });

  it('triggerReminder and snoozeReminder correctly track lastReminderAt and open modal', () => {
    const store = useRTSASStore.getState();
    store.generateSchedule('2026-09-17T10:00:00.000Z');

    const round1Id = useRTSASStore.getState().assessmentSchedule!.entries[0].id;
    useRTSASStore.getState().triggerReminder(round1Id);

    const stateAfterTrigger = useRTSASStore.getState();
    expect(stateAfterTrigger.ui.modal.activeModal).toBe('reminder');
    expect(stateAfterTrigger.ui.modal.modalData).toEqual({
      entryId: round1Id,
      sequence: 1,
      scheduledTime: expect.any(String),
    });

    const entryAfterTrigger = stateAfterTrigger.assessmentSchedule!.entries[0];
    expect(entryAfterTrigger.reminderTriggered).toBe(true);
    expect(entryAfterTrigger.lastReminderAt).not.toBeNull();

    // Snooze
    useRTSASStore.getState().snoozeReminder(round1Id);
    const entryAfterSnooze = useRTSASStore.getState().assessmentSchedule!.entries[0];
    expect(entryAfterSnooze.lastReminderAt).not.toBeNull();
  });
});
