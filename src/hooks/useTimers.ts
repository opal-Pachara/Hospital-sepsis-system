import { useEffect, useRef } from 'react';
import { useRTSASStore, isHistoricalPatient } from '../store/useRTSASStore';

/**
 * Custom hook that monitors the assessment schedule and triggers
 * reminder modals when scheduled times arrive.
 *
 * Runs a check every 10 seconds:
 * - Operates sequentially: finds the active (first uncompleted & non-canceled) entry.
 * - Stops completely if patient is historical, sepsis is ruled out, or treatment is completed.
 * - If active entry is due (now >= scheduledTime - 30s):
 *   - Triggers pop-up if !reminderTriggered
 *   - If postponed/closed without recording, snoozes and re-alerts every 2 minutes.
 */
export function useAssessmentReminders() {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      const state = useRTSASStore.getState();
      const schedule = state.assessmentSchedule;
      const patient = state.selectedPatient;
      const patientData = patient ? state.patientData[patient.id] : null;

      // Do nothing if no schedule or no patient
      if (!schedule || !patient || !schedule.entries || schedule.entries.length === 0) return;

      // Termination checks: Stop completely if
      // 1. Historical patient
      // 2. Sepsis is Ruled Out
      // 3. Treatment is Completed
      if (
        isHistoricalPatient(patient, state.patientData) ||
        patientData?.sepsisRuledOut ||
        patient?.treatmentStatus?.sepsis_ruled_out ||
        patientData?.treatmentCompleted ||
        patient?.treatmentStatus?.treatment_completed
      ) {
        return;
      }

      // Do not interrupt if user is actively filling the assessment form or auth modal
      if (
        state.ui.modal.activeModal === 'assessment_form' ||
        state.ui.modal.activeModal === 'auth' ||
        state.ui.modal.activeModal === 'sepsis_confirm' ||
        state.ui.modal.activeModal === 'reminder'
      ) {
        return;
      }

      // Find the single active entry in strict sequential order
      const activeEntry = schedule.entries.find((e) => !e.isCompleted && !e.isCanceled);
      if (!activeEntry) return;

      const now = Date.now();
      const scheduledMs = new Date(activeEntry.scheduledTime).getTime();

      // Check if entry is due (within 30 seconds of or past scheduled time)
      const isDue = now >= scheduledMs - 30000;
      if (!isDue) return;

      const SNOOZE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

      if (!activeEntry.reminderTriggered) {
        // Initial trigger for this round
        state.triggerReminder(activeEntry.id);
      } else if (activeEntry.lastReminderAt) {
        // Snooze re-trigger: re-alert every 2 minutes until recorded
        const lastReminderMs = new Date(activeEntry.lastReminderAt).getTime();
        if (now - lastReminderMs >= SNOOZE_INTERVAL_MS) {
          state.triggerReminder(activeEntry.id);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}

/**
 * Custom hook that provides a real-time formatted countdown string
 * and status indicators. Useful for components that need fine-grained
 * timer display without subscribing to the full store.
 */
export function useFormattedCountdown() {
  const timer = useRTSASStore((s) => s.countdownTimer);

  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;

  return {
    display: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    minutes,
    seconds,
    percentElapsed:
      ((timer.totalDurationSeconds - timer.remainingSeconds) / timer.totalDurationSeconds) * 100,
    ...timer,
  };
}

/**
 * Global background countdown timer ticker.
 * Ensures timers for all patients continue to tick regardless of which patient or tab is selected.
 */
export function useGlobalCountdownTicker() {
  const tickCountdown = useRTSASStore((s) => s.tickCountdown);

  useEffect(() => {
    const iv = window.setInterval(() => {
      tickCountdown();
    }, 1000);
    return () => clearInterval(iv);
  }, [tickCountdown]);
}
