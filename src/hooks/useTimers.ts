import { useEffect, useRef } from 'react';
import { useRTSASStore } from '../store/useRTSASStore';

/**
 * Custom hook that monitors the assessment schedule and triggers
 * reminder modals when scheduled times arrive.
 *
 * Runs a check every 10 seconds comparing current time against
 * each uncompleted, un-triggered entry's scheduled time.
 */
export function useAssessmentReminders() {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      const state = useRTSASStore.getState();
      const schedule = state.assessmentSchedule;

      if (!schedule || !state.countdownTimer.isActive) return;

      const now = Date.now();

      for (const entry of schedule.entries) {
        if (entry.isCompleted || entry.reminderTriggered) continue;

        const scheduledMs = new Date(entry.scheduledTime).getTime();

        // Trigger reminder if we're within 30 seconds of (or past) the scheduled time
        if (now >= scheduledMs - 30000) {
          state.triggerReminder(entry.id);
          break; // Only trigger one reminder at a time
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
