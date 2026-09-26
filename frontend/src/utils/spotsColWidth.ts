export const SPOTS_COL_WIDTH_KEY = 'reisotor-spots-col-width';
export const MIN_SPOTS_COL_WIDTH = 280;
export const DEFAULT_SPOTS_COL_WIDTH = 380;
export const MAX_SPOTS_COL_WIDTH = 1400;

export interface CalcSpotsColWidthOptions {
  preferredWidth?: number | null;
  availableWidth?: number;
  isDesktop: boolean;
}

/**
 * Lädt die gespeicherte Breite der Spots-Spalte aus dem Speicher.
 * Gibt null zurück, wenn kein gültiger Wert vorhanden ist (z. B. wenn durch frühere Bugs
 * Werte unterhalb von MIN_SPOTS_COL_WIDTH gespeichert wurden).
 */
export function loadStoredSpotsColWidth(storage?: Storage): number | null {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return null;
  const stored = Number(store.getItem(SPOTS_COL_WIDTH_KEY));
  if (Number.isFinite(stored) && stored >= MIN_SPOTS_COL_WIDTH && stored <= MAX_SPOTS_COL_WIDTH) {
    return stored;
  }
  return null;
}

/**
 * Persistiert die Breite der Spots-Spalte nur dann, wenn sie eine gültige Mindestbreite aufweist.
 */
export function saveStoredSpotsColWidth(width: number, storage?: Storage): void {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  if (Number.isFinite(width) && width >= MIN_SPOTS_COL_WIDTH && width <= MAX_SPOTS_COL_WIDTH) {
    store.setItem(SPOTS_COL_WIDTH_KEY, String(Math.round(width)));
  }
}

/**
 * Berechnet eine sichere und gültige Breite für die Spots-Spalte.
 * - Auf Mobile wird die Desktop-Präferenz nicht beschnitten oder durch Screen-Maße verfälscht.
 * - Auf Desktop wird die Spalte anhand des verfügbaren Platzes begrenzt, fällt aber NIEMALS
 *   unter MIN_SPOTS_COL_WIDTH.
 */
export function calcValidSpotsColWidth(options: CalcSpotsColWidthOptions): number {
  const candidate = options.preferredWidth;
  const base =
    candidate != null &&
    Number.isFinite(candidate) &&
    candidate >= MIN_SPOTS_COL_WIDTH &&
    candidate <= MAX_SPOTS_COL_WIDTH
      ? candidate
      : DEFAULT_SPOTS_COL_WIDTH;

  if (!options.isDesktop) {
    // Auf Mobile: Unverändert die gewünschte Desktop-Breite beibehalten
    return base;
  }

  const available =
    options.availableWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  // Hält mindestens 380px für die Karte + 16px Rand frei
  const maxAllowed = Math.max(
    MIN_SPOTS_COL_WIDTH,
    Math.min(MAX_SPOTS_COL_WIDTH, available - 380 - 16)
  );
  return Math.min(Math.max(base, MIN_SPOTS_COL_WIDTH), maxAllowed);
}
