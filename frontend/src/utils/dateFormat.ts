import { useCalendarSettingsStore } from '../stores/calendarSettings';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Lokaler Kalendertag (am Gerät) als 'YYYY-MM-DD' - bewusst NICHT `date.toISOString().slice(0,
 *  10)`: das rechnet zuerst auf UTC um, was den Kalendertag in jeder Zeitzone östlich von UTC
 *  (z. B. Europa) einen Teil des Tages lang fälschlich auf den VORTAG verschiebt (z. B. 00:30 Uhr
 *  MESZ/UTC+2 ist bereits 22:30 UTC des Vortags). Betraf u. a. den Wochenanfang im Kalender-
 *  Monatsraster und den "Bis zur Abreise"-Countdown im Dashboard. */
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Zentrale Zahlen-Datumsformatierung, ersetzt die zuvor über die App verstreuten, lokal je Datei
 *  duplizierten `toLocaleDateString('de-DE', ...)`-Aufrufe. Respektiert die in SettingsView.vue
 *  einstellbare `calendarSettings.dateFormat` (deutsch/ISO/US) statt fest `'de-DE'` zu verwenden. */
export function formatDate(
  dateStr: string,
  { includeYear = true }: { includeYear?: boolean } = {}
): string {
  const calendarSettings = useCalendarSettingsStore();
  const d = new Date(dateStr);
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();
  switch (calendarSettings.dateFormat) {
    case 'iso':
      return includeYear ? `${year}-${month}-${day}` : `${month}-${day}`;
    case 'us':
      return includeYear ? `${month}/${day}/${year}` : `${month}/${day}`;
    default:
      return includeYear ? `${day}.${month}.${year}` : `${day}.${month}`;
  }
}

/** Datum + feste Uhrzeit (Uhrzeit-Format ist nicht Teil der Datumsformat-Einstellung). */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${formatDate(dateStr)} ${hours}:${minutes}`;
}

const weekdayShortFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

/** Kurzer Wochentagsname + Tag/Monat (ohne Jahr), z. B. "So., 15.03". Der Wochentagsname bleibt
 *  bewusst immer deutsch (die App-UI-Sprache ist durchgängig Deutsch) – nur die Zahlenformatierung
 *  respektiert calendarSettings.dateFormat. Nicht für lange Datumsüberschriften mit ausgeschriebenem
 *  Monatsnamen gedacht (z. B. ScheduleView.vue's Tages-Detail-Überschrift "Montag, 15. März") – das
 *  bleibt bewusst eine reine Prosa-Formatierung, unabhängig von der Zahlenformat-Einstellung. */
export function formatWeekdayDate(dateStr: string): string {
  return `${weekdayShortFormatter.format(new Date(dateStr))}, ${formatDate(dateStr, { includeYear: false })}`;
}

/** Montag/Sonntag-Start der Woche, in der `date` liegt – respektiert calendarSettings.weekStart.
 *  Montag-Fall: dieselbe (getDay()+6)%7-Formel wie zuvor hart codiert in ScheduleView.vue. */
export function startOfWeek(date: Date): Date {
  const calendarSettings = useCalendarSettingsStore();
  const result = new Date(date);
  const offset =
    calendarSettings.weekStart === 'sunday' ? result.getDay() : (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

/** Letzter Tag derselben Woche (6 Tage nach startOfWeek) – für das Monatsraster (ScheduleView.vue's
 *  monthWeeks), das führende/nachfolgende Tage aus Nachbarmonaten bis zum vollen Wochenanfang/-ende
 *  auffüllt, unabhängig vom eingestellten Wochenanfang. */
export function endOfWeek(date: Date): Date {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return result;
}

/**
 * Datumsbereich für das Urlaubsbanner (#212).
 * Regel:
 * - Vor/während des Urlaubs im selben Kalenderjahr: Jahr weglassen (z. B. "12.08. – 20.08.")
 * - Im Kalenderjahr vor dem Urlaub (z. B. heute 2025, Urlaub 2026): Jahr anzeigen (z. B. "12.08.2026 – 20.08.2026")
 * - Zeitraum nach dem Urlaub (auch schon ab dem Folgetag): Jahr anzeigen (z. B. "12.08.2026 – 20.08.2026")
 * - Jahresübergreifender Urlaub: Jahr anzeigen (z. B. "28.12.2026 – 05.01.2027")
 */
export function formatTripDateRange(
  startDateStr?: string | null,
  endDateStr?: string | null,
  now: Date = new Date()
): string {
  if (!startDateStr && !endDateStr) {
    return 'Datum noch offen';
  }
  if (startDateStr && !endDateStr) {
    return formatDate(startDateStr);
  }
  if (!startDateStr && endDateStr) {
    return formatDate(endDateStr);
  }
  const today = toLocalDateString(now);
  const currentYear = now.getFullYear();
  const startYear = parseInt(startDateStr!.slice(0, 4), 10);
  const endYear = parseInt(endDateStr!.slice(0, 4), 10);

  const isPastTrip = today > endDateStr!;
  const isFutureYearTrip = currentYear < startYear;
  const isCrossYearTrip = startYear !== endYear;

  const includeYear = isPastTrip || isFutureYearTrip || isCrossYearTrip;

  return `${formatDate(startDateStr!, { includeYear })} – ${formatDate(endDateStr!, { includeYear })}`;
}
