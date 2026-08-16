import type { Excursion, ScheduleItem, Spot, TravelItem } from '../api/types';
import { SCHEDULE_CATEGORY_META } from './scheduleCategory';
import { excursionStationKeys, resolveStation, resolveStations, travelEndpointKey, type ExcursionStation } from './excursionStations';
import { travelTypeIcon, travelTypeIconDef } from './travelTypeIcon';

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
  spots: Spot[],
): ExcursionStation[] {
  const timed: { time: string | null; station: ExcursionStation }[] = [];

  for (const item of scheduleItems) {
    if (item.date > date || date > (item.end_date ?? item.date)) continue;
    // Mit einem Spot verknüpfte Termine zeigen dessen echtes Kategorie-Icon/-Farbe statt des
    // generischen Termin-Pins (übernimmt außerdem automatisch dessen Koordinaten, unabhängig
    // davon, ob der Termin selbst welche gespeichert hat).
    if (item.spot_id != null) {
      const station = resolveStation(`spot-${item.spot_id}`, spots, travelItems);
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
        tabler: meta.tabler,
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
    const from = resolveStation(travelEndpointKey(t, 'from'), spots, travelItems);
    if (from && from.key !== previousTravelKey) {
      timed.push({ time: t.departure_time, station: from });
      previousTravelKey = from.key;
    }
    const to = resolveStation(travelEndpointKey(t, 'to'), spots, travelItems);
    if (to) {
      timed.push({
        time: t.arrival_time ?? t.departure_time,
        station: { ...to, connector: { icon: travelTypeIcon(t.type, '📍'), tabler: travelTypeIconDef(t.type), label: t.title } },
      });
      previousTravelKey = to.key;
    }
  }

  // Unterkunft-Spots (Kategorie "Unterkunft", siehe Migrationskommentar in db/index.ts) sind an
  // jedem Tag ihres Aufenthaltszeitraums (start_date..end_date) automatisch eine Station, ohne dass
  // sie einem Ausflug zugeordnet sein müssen.
  for (const s of spots.filter(
    (s) => s.category === 'Unterkunft' && s.start_date && s.end_date && s.start_date <= date && date <= s.end_date,
  )) {
    const station = resolveStation(`spot-${s.id}`, spots, travelItems);
    if (station) timed.push({ time: null, station });
  }

  for (const e of excursions.filter((e) => e.date === date)) {
    for (const station of resolveStations(excursionStationKeys(e.spot_ids), spots, travelItems)) {
      timed.push({ time: null, station });
    }
  }

  return timed.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')).map((s) => s.station);
}
