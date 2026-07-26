import type { Period } from '../api/types';

/** Gemeinsame Beschriftung für den Zeitraum eines Einkaufs-/ToDo-Eintrags, geteilt zwischen
 *  Einkaufsliste und ToDo-Liste (Batch 9), damit "vor"/"während" überall gleich benannt ist. */
export const PERIOD_META: Record<Period, string> = {
  before: 'Vor dem Urlaub',
  during: 'Während des Urlaubs',
};

/** Leitet den Zeitraum aus einem Fälligkeitsdatum und den Urlaubs-Eckdaten ab, statt ihn manuell
 *  abzufragen (ToDo-Einträge haben im Gegensatz zu Einkaufslisten-Einträgen ein Datum, aus dem
 *  sich "vor"/"während" eindeutig herleiten lässt). Liegt das Datum nach Reiseende oder ist gar
 *  keins gesetzt, gibt es keinen passenden Zeitraum (null, wie "kein Zeitraum" bisher). */
export function computePeriod(
  dueDate: string | null | undefined,
  trip: { start_date: string; end_date: string } | null | undefined,
): Period | null {
  if (!dueDate || !trip) return null;
  if (dueDate < trip.start_date) return 'before';
  if (dueDate <= trip.end_date) return 'during';
  return null;
}
