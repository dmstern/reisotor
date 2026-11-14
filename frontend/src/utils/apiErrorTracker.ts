export interface TrackedApiError extends Error {
  status: number;
  method?: string;
  path?: string;
  data?: unknown;
}

let lastRecordedApiError: { error: TrackedApiError; timestamp: number } | null = null;

/** Stores the most recent non-auth API failure for error/feedback enrichment. */
export function recordLastApiError(error: TrackedApiError): void {
  lastRecordedApiError = { error, timestamp: Date.now() };
}

/** Returns the most recently recorded API error, if any. */
export function getLastApiError(): { error: TrackedApiError; timestamp: number } | null {
  return lastRecordedApiError;
}

/** Clears the cached last API error (used when resetting error state/tests). */
export function clearLastApiError(): void {
  lastRecordedApiError = null;
}
