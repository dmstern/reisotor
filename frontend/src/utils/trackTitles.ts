import type { LocationTrack } from '../api/types';

const MORNING_START_HOUR = 5;
const MIDDAY_START_HOUR = 11;
const AFTERNOON_START_HOUR = 14;
const EVENING_START_HOUR = 18;
const NIGHT_START_HOUR = 22;
const SATURDAY_WEEKDAY_INDEX = 6;

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
  const startDate = new Date(startedAt);

  if (isNaN(startDate.getTime())) {
    return 'Aufzeichnung';
  }

  const dayIndex = startDate.getDay();
  const dayName = GERMAN_WEEKDAYS[dayIndex];
  const hour = startDate.getHours();

  const isMorning = hour >= MORNING_START_HOUR && hour < MIDDAY_START_HOUR;
  const isMidday = hour >= MIDDAY_START_HOUR && hour < AFTERNOON_START_HOUR;
  const isAfternoon = hour >= AFTERNOON_START_HOUR && hour < EVENING_START_HOUR;
  const isEvening = hour >= EVENING_START_HOUR && hour < NIGHT_START_HOUR;

  // Sonntag
  if (dayIndex === 0) {
    if (isMorning) {
      return 'Sonntagsspaziergang';
    }

    if (isMidday) {
      return 'Sonntagsrunde';
    }

    if (isAfternoon) {
      return 'Sonntagstour';
    }

    if (isEvening) {
      return 'Sonntagabend-Runde';
    }

    return 'Nächtliche Sonntagsrunde';
  }

  // Samstag
  if (dayIndex === SATURDAY_WEEKDAY_INDEX) {
    if (isMorning) {
      return 'Morgendliche Samstagsrunde';
    }

    if (isMidday) {
      return 'Samstagsrunde';
    }

    if (isAfternoon) {
      return 'Wochenend-Ausflug';
    }

    if (isEvening) {
      return 'Samstagabend-Runde';
    }

    return 'Samstagsrunde';
  }

  // Wochentage (Montag bis Freitag)
  if (isMorning) {
    return `Morgendliche Tour am ${dayName}`;
  }

  if (isMidday) {
    return `Mittagsrunde am ${dayName}`;
  }

  if (isAfternoon) {
    return `Nachmittagstour am ${dayName}`;
  }

  if (isEvening) {
    return `Feierabendrunde am ${dayName}`;
  }

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
