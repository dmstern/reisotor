interface RateLimitEntry {
  timestamps: number[];
  windowMs: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Alle 6 Stunden veraltete Einträge bereinigen, um Memory Leaks zu vermeiden
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  for (const [key, entry] of rateLimitMap.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < entry.windowMs);
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
  lastCleanup = now;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Prüft und aktualisiert das In-Memory-Rate-Limit für einen Schlüssel (IP, Cookie etc.).
 * Standard: Maximal 5 Meldungen pro Schlüssel innerhalb eines 24-Stunden-Fensters.
 */
export function checkFeedbackRateLimit(
  key: string,
  maxRequests = 5,
  windowMs = 24 * 60 * 60 * 1000
): RateLimitResult {
  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupExpired(now);
  }

  let entry = rateLimitMap.get(key);
  if (!entry) {
    entry = { timestamps: [], windowMs };
    rateLimitMap.set(key, entry);
  } else {
    entry.windowMs = Math.max(entry.windowMs, windowMs);
  }

  // Abgelaufene Zeitstempel für diesen Eintrag entfernen
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestTimestamp = entry.timestamps[0];
    const retryAfterMs = oldestTimestamp + windowMs - now;
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

/**
 * Nur für Tests: Setzt den internen Rate-Limit-Speicher zurück.
 */
export function resetFeedbackRateLimits(): void {
  rateLimitMap.clear();
  lastCleanup = Date.now();
}
