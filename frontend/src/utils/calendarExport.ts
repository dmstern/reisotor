import type { CalendarEntry } from '../api/types';

// Gemeinsame minimale Termin-Form für alle drei Export-Wege (ics-Download, Google-/Outlook-Link) –
// entkoppelt von CalendarEntry, damit dieses Modul nicht von der Kalender-Sicht abhängt.
export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD, inklusive (nur bei mehrtägigen/ganztägigen Terminen relevant); Default: date. */
  endDate?: string | null;
  /** HH:MM – gesetzt: Termin mit Uhrzeit (Default-Dauer 1h), sonst ganztägig über date..endDate. */
  time?: string | null;
}

export function calendarEventFromEntry(entry: CalendarEntry): CalendarEventInput {
  return {
    title: entry.title,
    description: entry.note,
    location: entry.location,
    date: entry.date,
    endDate: entry.endDate,
    time: entry.time,
  };
}

const DEFAULT_DURATION_MINUTES = 60;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateStamp(dateIso: string): string {
  return dateIso.replace(/-/g, '');
}

// "Floating" lokale Zeit ohne Zeitzonen-Suffix (kein "Z", kein TZID): die App speichert grundsätzlich
// keine Zeitzonen – Datum/Uhrzeit sind reine Strings. Ein Termin am Urlaubsort soll im jeweiligen
// Kalender einfach zur eingegebenen Uhrzeit erscheinen, unabhängig von der Geräte-Zeitzone.
function dateTimeStamp(dateIso: string, time: string): string {
  const [h, m] = time.split(':');
  return `${dateStamp(dateIso)}T${h.padStart(2, '0')}${m.padStart(2, '0')}00`;
}

function endDateTime(date: string, time: string): Date {
  const start = new Date(`${date}T${time}:00`);
  return new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60000);
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsContent(event: CalendarEventInput): string {
  const uid = `${dateStamp(event.date)}-${Math.random().toString(36).slice(2)}@reisotor`;
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
    now.getUTCHours(),
  )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  let dtstart: string;
  let dtend: string;
  if (event.time) {
    dtstart = `DTSTART:${dateTimeStamp(event.date, event.time)}`;
    const end = endDateTime(event.date, event.time);
    dtend = `DTEND:${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(
      end.getMinutes(),
    )}${pad(end.getSeconds())}`;
  } else {
    dtstart = `DTSTART;VALUE=DATE:${dateStamp(event.date)}`;
    // Exklusives Ende (Tag NACH dem letzten Tag) laut ics-Konvention für ganztägige Termine.
    dtend = `DTEND;VALUE=DATE:${dateStamp(addDays(event.endDate ?? event.date, 1))}`;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Reisotor//DE',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

// Löst sofort einen Datei-Download aus (Apple Kalender/iOS und Android erkennen .ics beim Öffnen
// und bieten an, den Termin in die native Kalender-App zu übernehmen) – Blob-URL statt data:-URI,
// da data:-URIs mit dem download-Attribut in manchen Browsern unzuverlässig sind. Die URL wird
// direkt nach dem Klick wieder freigegeben, kein Bedarf, sie länger vorzuhalten.
export function triggerIcsDownload(event: CalendarEventInput) {
  const blob = new Blob([icsContent(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'termin.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function googleCalendarHref(event: CalendarEventInput): string {
  let dates: string;
  if (event.time) {
    const start = dateTimeStamp(event.date, event.time);
    const end = endDateTime(event.date, event.time);
    const endStamp = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(
      end.getMinutes(),
    )}00`;
    dates = `${start}/${endStamp}`;
  } else {
    dates = `${dateStamp(event.date)}/${dateStamp(addDays(event.endDate ?? event.date, 1))}`;
  }
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarHref(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
  });
  if (event.time) {
    const end = endDateTime(event.date, event.time);
    params.set('startdt', `${event.date}T${event.time}:00`);
    params.set(
      'enddt',
      `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(
        end.getMinutes(),
      )}:00`,
    );
  } else {
    params.set('startdt', event.date);
    params.set('enddt', addDays(event.endDate ?? event.date, 1));
    params.set('allday', 'true');
  }
  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
