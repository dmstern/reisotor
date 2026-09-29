/**
 * Hilfsfunktionen zur Formatierung von Routen-Distanzen und Fahrtzeiten.
 */

export function formatDistance(meters?: number | null): string {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m`;
  const km = (meters / 1000).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km} km`;
}

export function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} Min.`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
}

export function formatDiffDuration(diffSeconds: number): string {
  if (diffSeconds < 60) return '< 1 Min.';
  return formatDuration(diffSeconds);
}
