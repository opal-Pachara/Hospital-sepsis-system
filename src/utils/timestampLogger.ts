// src/utils/timestampLogger.ts
/**
 * Centralized utility for recording timestamped events to the backend log service.
 * It sends a POST request to a new admin endpoint that proxies to `record_log`.
 */
export interface LogDetails {
  [key: string]: any;
}

export async function logEvent(
  level: 'Note' | 'Warning' | 'ERROR',
  component: string,
  message: string,
  details?: LogDetails
): Promise<void> {
  try {
    await fetch('/api/admin/log-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ level, component, message, details }),
    });
  } catch (e) {
    // Silently ignore logging failures to avoid breaking UI flow.
    console.error('Failed to record log event:', e);
  }
}
