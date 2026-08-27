const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type DepartureCountdown =
  { phase: 'days'; days: number } | { phase: 'hours'; hours: number } | { phase: 'departed' };

// Reine Kalendertage-Differenz zweier lokaler Daten (Uhrzeit-Anteil ignoriert) - über Date.UTC()
// der jeweiligen Y/M/D-Komponenten statt direkter ms-Differenz zweier Date-Objekte, da Letzteres an
// einem DST-Wechsel (23h-/25h-Tag) sonst einen Tag daneben liegen könnte.
function daysBetweenLocalDates(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DAY_MS);
}

/** "Bis zur Abreise"-Countdown für DashboardView.vue's Hero-Card. Zählt bis zum ENDE des
 *  Abreisetags (nicht dessen Beginn) - der Abreisetag selbst gilt über seine gesamte Dauer noch als
 *  "bevorstehend", erst danach als "losgefahren". `now` als Parameter (statt intern `new Date()`)
 *  macht die Funktion für Unit-Tests deterministisch testbar; im Component wird die aktuelle
 *  Gerätezeit übergeben (bewusst NICHT Server-/UTC-Zeit - `new Date(startDateStr)` würde das Datum
 *  sonst als UTC-Mitternacht parsen, was den Countdown in jeder Zeitzone östlich von UTC um bis zu
 *  einen Tag verfälscht - der ursprüngliche, per Nutzer-Feedback gemeldete Bug: "1 Tag bis zur
 *  Abreise" noch am Abreisetag selbst). Unter 48h wird auf Stunden umgeschaltet, sonst wird
 *  abgerundet (Math.floor/round statt ceil) - im Zweifel lieber die verbleibende Zeit knapper als
 *  großzügiger anzeigen. */
export function computeDepartureCountdown(startDateStr: string, now: Date): DepartureCountdown {
  const [year, month, day] = startDateStr.split('-').map(Number);
  const startOfDeparture = new Date(year, month - 1, day);
  const endOfDeparture = new Date(year, month - 1, day + 1);

  if (now >= endOfDeparture) return { phase: 'departed' };

  const msUntilEnd = endOfDeparture.getTime() - now.getTime();
  if (msUntilEnd < 48 * HOUR_MS) {
    return { phase: 'hours', hours: Math.max(1, Math.floor(msUntilEnd / HOUR_MS)) };
  }
  return { phase: 'days', days: daysBetweenLocalDates(now, startOfDeparture) };
}

export type VacationPhase =
  | { phase: 'arrived' }
  | { phase: 'ongoing'; daysLeft: number }
  | { phase: 'lastDay' }
  | { phase: 'over' };

/** Lebenszyklus-Phase des Urlaubs NACH dem Abreisetag - für DashboardView.vue's Hero-Card, sobald
 *  computeDepartureCountdown() 'departed' liefert (dessen Stunden-/Tage-Countdown deckt den
 *  Abreisetag selbst bereits sinnvoll ab, bleibt dafür weiterhin exklusiv zuständig). Eigene
 *  Funktion statt eines gemeinsamen Fünf-Phasen-Enums, da beide unterschiedliche Granularität
 *  brauchen (Stunden vs. Kalendertage) und unabhängig voneinander testbar bleiben sollen.
 *  Datumsvergleich auf Kalendertag-Ebene wie daysBetweenLocalDates() oben, damit dieselbe
 *  DST-/Zeitzonen-Sicherheit gilt. Gibt null zurück, solange `now` noch am/vor dem Abreisetag liegt
 *  (dafür bleibt computeDepartureCountdown zuständig) - so bleibt die Funktion auch isoliert
 *  testbar, ohne sich auf die Aufrufreihenfolge in DashboardView.vue verlassen zu müssen. */
export function computeVacationPhase(
  trip: { start_date?: string | null; end_date?: string | null },
  now: Date
): VacationPhase | null {
  if (!trip.start_date || !trip.end_date) return null;
  const [sy, sm, sd] = trip.start_date.split('-').map(Number);
  const [ey, em, ed] = trip.end_date.split('-').map(Number);
  const dayAfterDeparture = new Date(sy, sm - 1, sd + 1);
  const endOfTrip = new Date(ey, em - 1, ed);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (today < dayAfterDeparture) return null;

  const daysUntilEnd = daysBetweenLocalDates(today, endOfTrip);
  if (daysUntilEnd < 0) return { phase: 'over' };
  // Prüfung VOR 'arrived': bei sehr kurzen Reisen (z. B. 2 Tage) ist der Tag nach der Abreise
  // gleichzeitig der letzte Urlaubstag - die "Ende"-Einordnung ist dann die nützlichere Information.
  if (daysUntilEnd === 0) return { phase: 'lastDay' };
  if (daysBetweenLocalDates(today, dayAfterDeparture) === 0) return { phase: 'arrived' };
  return { phase: 'ongoing', daysLeft: daysUntilEnd };
}
