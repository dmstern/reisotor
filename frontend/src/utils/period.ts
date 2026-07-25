import type { Period } from '../api/types';

/** Gemeinsame Beschriftung für den Zeitraum eines Einkaufs-/ToDo-Eintrags, geteilt zwischen
 *  Einkaufsliste und ToDo-Liste (Batch 9), damit "vor"/"während" überall gleich benannt ist. */
export const PERIOD_META: Record<Period, string> = {
  before: 'Vor dem Urlaub',
  during: 'Während des Urlaubs',
};
