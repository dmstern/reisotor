import type { LocationTrack } from '../api/types';

const GERMAN_WEEKDAYS = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const;

/**
 * Erzeugt einen ansprechenden, abwechslungsreichen Fallback-Titel basierend auf Wochentag
 * und Tageszeit (z. B. "Sonntagsspaziergang", "Morgendliche Tour am Montag").
 */
export function formatFallbackTrackTitle(startedAt: string): string {
  const d = new Date(startedAt);
  if (isNaN(d.getTime())) {
    return 'Aufzeichnung';
  }

  const dayIndex = d.getDay();
  const dayName = GERMAN_WEEKDAYS[dayIndex];
  const hour = d.getHours();

  const isMorning = hour >= 5 && hour < 11;
  const isMidday = hour >= 11 && hour < 14;
  const isAfternoon = hour >= 14 && hour < 18;
  const isEvening = hour >= 18 && hour < 22;

  // Sonntag
  if (dayIndex === 0) {
    if (isMorning) return 'Sonntagsspaziergang';
    if (isMidday) return 'Sonntagsrunde';
    if (isAfternoon) return 'Sonntagstour';
    if (isEvening) return 'Sonntagabend-Runde';
    return 'Nächtliche Sonntagsrunde';
  }

  // Samstag
  if (dayIndex === 6) {
    if (isMorning) return 'Morgendliche Samstagsrunde';
    if (isMidday) return 'Samstagsrunde';
    if (isAfternoon) return 'Wochenend-Ausflug';
    if (isEvening) return 'Samstagabend-Runde';
    return 'Samstagsrunde';
  }

  // Wochentage (Montag bis Freitag)
  if (isMorning) return `Morgendliche Tour am ${dayName}`;
  if (isMidday) return `Mittagsrunde am ${dayName}`;
  if (isAfternoon) return `Nachmittagstour am ${dayName}`;
  if (isEvening) return `Feierabendrunde am ${dayName}`;
  return `Nachttour am ${dayName}`;
}

/**
 * Liefert den Anzeigenamen einer Aufzeichnung:
 * 1. Den vergebenen/gespeicherten Titel, falls vorhanden.
 * 2. Andernfalls einen dynamischen, wohlklingenden Fallback-Titel.
 */
export function getTrackTitle(track: LocationTrack): string {
  if (track.title && track.title.trim()) {
    return track.title.trim();
  }
  return formatFallbackTrackTitle(track.started_at);
}
