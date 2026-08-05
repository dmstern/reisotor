import type { Accommodation, Excursion, ScheduleItem, Spot, TravelItem, TravelPlace } from '../api/types';
import { SCHEDULE_CATEGORY_META } from './scheduleCategory';
import { resolveStation, resolveStations, travelEndpointKey, type ExcursionStation } from './excursionStations';
import { travelTypeIcon } from './travelTypeIcon';

/** Alle Orte eines Kalendertages – über alle Quellen hinweg (Termine, Reise-Etappen, Unterkunft,
 *  Ausflüge), nicht nur Ausflug-Stationen wie bisher (siehe TripMap.vue's frühere
 *  focusedDateExcursions/focusedDateStations). Sortiert wie ScheduleView.vue's eigene Tagesliste
 *  (entriesForDate: `(a.time ?? '').localeCompare(b.time ?? '')`, untertitierte Einträge zuerst),
 *  damit "🗺️ Tag auf Karte anzeigen" dieselbe Reihenfolge zeigt wie der Kalender selbst. */
export function buildDayStations(
  date: string,
  scheduleItems: ScheduleItem[],
  excursions: Excursion[],
  travelItems: TravelItem[],
  accommodations: Accommodation[],
  spots: Spot[],
  travelPlaces: TravelPlace[] = [],
): ExcursionStation[] {
  const timed: { time: string | null; station: ExcursionStation }[] = [];

  for (const item of scheduleItems) {
    if (item.date > date || date > (item.end_date ?? item.date)) continue;
    // Mit einem Spot verknüpfte Termine zeigen dessen echtes Kategorie-Icon/-Farbe statt des
    // generischen Termin-Pins (übernimmt außerdem automatisch dessen Koordinaten, unabhängig
    // davon, ob der Termin selbst welche gespeichert hat).
    if (item.spot_id != null) {
      const station = resolveStation(`spot-${item.spot_id}`, spots, accommodations, travelItems);
      if (station) {
        timed.push({ time: item.time, station });
        continue;
      }
    }
    if (item.lat == null || item.lng == null) continue;
    const meta = SCHEDULE_CATEGORY_META[item.category];
    timed.push({
      time: item.time,
      station: {
        key: `schedule-${item.id}`,
        kind: 'schedule',
        id: item.id,
        title: item.title,
        icon: meta.icon,
        color: meta.color,
        category: meta.label,
        imageUrl: null,
        lat: item.lat,
        lng: item.lng,
        mapsLink: item.maps_link,
      },
    });
  }

  // Verkettet aufeinanderfolgende Etappen DIESES Tages über ihren tatsächlichen ORT statt über die
  // Etappe selbst (travelEndpointKey() bevorzugt den verknüpften Reise-Ort, siehe dortiger
  // Kommentar): bei "Hinflug: A -> B" gefolgt von "Weiterreise: B -> C" taucht B dadurch nur EINMAL
  // als Box auf (aufeinanderfolgendes Duplikat unterdrückt), statt als zwei benachbarte, identische
  // Boxen. Der Reise-Titel wandert von der Box auf die Verbindungslinie ZWISCHEN zwei Boxen
  // (ExcursionStation.connector, siehe TripMap.vue's Rendering) - die Box selbst zeigt jetzt den
  // Ort. Vorher explizit nach Abflugzeit sortiert (nicht die Erstellungsreihenfolge aus der API,
  // ORDER BY date, id), da die aufeinanderfolgende-Duplikat-Erkennung von der tatsächlichen
  // Reihenfolge der Etappen abhängt.
  const todaysTravel = travelItems
    .filter((t) => t.date === date)
    .sort((a, b) => (a.departure_time ?? '').localeCompare(b.departure_time ?? ''));
  let previousTravelKey: string | null = null;
  for (const t of todaysTravel) {
    const from = resolveStation(travelEndpointKey(t, 'from'), spots, accommodations, travelItems, travelPlaces);
    if (from && from.key !== previousTravelKey) {
      timed.push({ time: t.departure_time, station: from });
      previousTravelKey = from.key;
    }
    const to = resolveStation(travelEndpointKey(t, 'to'), spots, accommodations, travelItems, travelPlaces);
    if (to) {
      timed.push({
        time: t.arrival_time ?? t.departure_time,
        station: { ...to, connector: { icon: travelTypeIcon(t.type, '📍'), label: t.title } },
      });
      previousTravelKey = to.key;
    }
  }

  for (const a of accommodations.filter((a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date)) {
    const station = resolveStation(`accommodation-${a.id}`, spots, accommodations, travelItems);
    if (station) timed.push({ time: null, station });
  }

  for (const e of excursions.filter((e) => e.date === date)) {
    for (const station of resolveStations(e.station_keys, spots, accommodations, travelItems, travelPlaces)) {
      timed.push({ time: null, station });
    }
  }

  return timed.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).map((s) => s.station);
}
