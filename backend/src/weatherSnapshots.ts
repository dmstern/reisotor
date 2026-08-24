import { db } from './db/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Open-Meteo's past_days-Parameter deckt bis zu 92 Tage rückwirkend ab (ein einzelner Aufruf reicht
// dadurch für jede realistische Lücke, kein separater Archiv-API-Call nötig).
const MAX_PAST_DAYS = 92;

interface TripRow {
  id: number;
  lat: number;
  lng: number;
  start_date: string;
  end_date: string;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max?: number[];
  };
}

function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / DAY_MS);
}

function dateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  for (let cur = startStr; cur <= endStr; cur = addDays(cur, 1)) {
    dates.push(cur);
  }
  return dates;
}

function round3(v: number | null | undefined): number | null {
  return v == null ? null : Math.round(v * 1000) / 1000;
}

const upsertSnapshot = db.prepare(`
  INSERT INTO trip_weather_snapshots (trip_id, date, weathercode, temp_max, temp_min, precipitation_probability, lat, lng)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(trip_id, date, lat, lng) DO UPDATE SET
    weathercode = excluded.weathercode,
    temp_max = excluded.temp_max,
    temp_min = excluded.temp_min,
    precipitation_probability = excluded.precipitation_probability
`);

async function fetchAndStoreLocationWeather(
  tripId: number,
  lat: number,
  lng: number,
  missingDates: string[],
  today: string,
) {
  if (!missingDates.length) return;
  const pastDays = Math.min(MAX_PAST_DAYS, daysBetween(missingDates[0], today));
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    past_days: String(pastDays),
    forecast_days: '1',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status})`);
  const data = (await res.json()) as OpenMeteoResponse;

  const missingSet = new Set(missingDates);
  const roundedLat = round3(lat);
  const roundedLng = round3(lng);
  data.daily.time.forEach((date, i) => {
    if (!missingSet.has(date)) return;
    upsertSnapshot.run(
      tripId,
      date,
      data.daily.weathercode[i],
      data.daily.temperature_2m_max[i],
      data.daily.temperature_2m_min[i],
      data.daily.precipitation_probability_max?.[i] ?? null,
      roundedLat,
      roundedLng,
    );
  });
}

/** Ermittelt für einen einzelnen Urlaub, welche strikt vergangenen (abgeschlossenen) Urlaubstage
 *  sowie vergangene Termine von Spots/Touren noch keinen Wetter-Snapshot haben, holt sie per
 *  Open-Meteo und speichert sie dauerhaft in trip_weather_snapshots. */
async function snapshotTripWeather(trip: TripRow, today: string) {
  const yesterday = addDays(today, -1);

  // 1. Haupt-Reiseziel des Trips
  if (trip.start_date <= yesterday && trip.lat != null && trip.lng != null) {
    const rangeEnd = trip.end_date < yesterday ? trip.end_date : yesterday;
    const wantedDates = dateRange(trip.start_date, rangeEnd);
    if (wantedDates.length) {
      const existing = db
        .prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ? AND (lat IS NULL OR (ROUND(lat,3) = ROUND(?,3) AND ROUND(lng,3) = ROUND(?,3))) AND date >= ? AND date <= ?')
        .all(trip.id, trip.lat, trip.lng, trip.start_date, rangeEnd) as { date: string }[];
      const existingDates = new Set(existing.map((r) => r.date));
      const missingDates = wantedDates.filter((d) => !existingDates.has(d));
      if (missingDates.length) {
        await fetchAndStoreLocationWeather(trip.id, trip.lat, trip.lng, missingDates, today);
      }
    }
  }

  // 2. Spots & Touren mit vergangenen Terminen und abweichenden/eigenen Koordinaten (Issue #153)
  const scheduledLocations = db
    .prepare(
      `SELECT DISTINCT schedule_items.date, spots.lat, spots.lng
       FROM schedule_items
       JOIN spots ON schedule_items.spot_id = spots.id
       WHERE schedule_items.trip_id = ? AND schedule_items.date < ?
         AND spots.lat IS NOT NULL AND spots.lng IS NOT NULL
         AND schedule_items.deleted_at IS NULL AND spots.deleted_at IS NULL
       UNION
       SELECT DISTINCT schedule_items.date, spots.lat, spots.lng
       FROM schedule_items
       JOIN excursion_spots ON schedule_items.idea_id = excursion_spots.idea_id
       JOIN spots ON excursion_spots.spot_id = spots.id
       WHERE schedule_items.trip_id = ? AND schedule_items.date < ?
         AND spots.lat IS NOT NULL AND spots.lng IS NOT NULL
         AND schedule_items.deleted_at IS NULL AND spots.deleted_at IS NULL`,
    )
    .all(trip.id, today, trip.id, today) as { date: string; lat: number; lng: number }[];

  const locationGroups = new Map<string, { lat: number; lng: number; dates: string[] }>();
  for (const item of scheduledLocations) {
    const key = `${item.lat.toFixed(3)},${item.lng.toFixed(3)}`;
    if (!locationGroups.has(key)) {
      locationGroups.set(key, { lat: item.lat, lng: item.lng, dates: [] });
    }
    locationGroups.get(key)!.dates.push(item.date);
  }

  for (const loc of locationGroups.values()) {
    const existing = db
      .prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ? AND ROUND(lat,3) = ROUND(?,3) AND ROUND(lng,3) = ROUND(?,3)')
      .all(trip.id, loc.lat, loc.lng) as { date: string }[];
    const existingDates = new Set(existing.map((r) => r.date));
    const missingDates = loc.dates.filter((d) => !existingDates.has(d)).sort();
    if (missingDates.length) {
      await fetchAndStoreLocationWeather(trip.id, loc.lat, loc.lng, missingDates, today);
    }
  }
}

/** Holt vergangene Wetter-Ist-Werte für genau einen Trip neu - wird von PUT /trips/:id
 *  aufgerufen, nachdem sich der Ort (lat/lng) geändert hat und deshalb zuvor gespeicherte
 *  trip_weather_snapshots-Zeilen (die noch zum alten Ort gehören) gelöscht wurden. Ohne diesen
 *  Aufruf würden die als "missing" geltenden Tage erst beim nächsten periodischen Lauf (bis zu
 *  CHECK_INTERVAL_MS später) neu geholt. */
export async function refreshTripWeatherSnapshots(tripId: number) {
  const trip = db.prepare('SELECT id, lat, lng, start_date, end_date FROM trips WHERE id = ?').get(tripId) as
    | TripRow
    | undefined;
  if (!trip || trip.lat == null || trip.lng == null) return;
  await snapshotTripWeather(trip, todayUtcDateStr());
}

/** Läuft periodisch (startWeatherSnapshotScheduler) über alle Urlaube mit gesetzten Koordinaten,
 *  deren Zeitraum sich mit den letzten ~92 Tagen überschneidet, und sichert fehlende vergangene
 *  Wetter-Ist-Werte dauerhaft in trip_weather_snapshots - macht das Wetter eines Urlaubs auch Monate
 *  nach dessen Ende noch anzeigbar (Dashboard-Rückblick, Tagebuch), obwohl Open-Meteo selbst nur ein
 *  kurzes rückwirkendes Fenster anbietet. Ein Fehlschlag bei einem Trip (z. B. Open-Meteo down)
 *  darf die anderen nicht blockieren, deshalb pro Trip einzeln abgefangen. */
export async function recordWeatherSnapshots() {
  const today = todayUtcDateStr();
  const trips = db
    .prepare(
      `SELECT id, lat, lng, start_date, end_date FROM trips
       WHERE lat IS NOT NULL AND lng IS NOT NULL
         AND end_date >= date('now', '-92 days')
         AND start_date <= date('now')`,
    )
    .all() as TripRow[];

  for (const trip of trips) {
    try {
      await snapshotTripWeather(trip, today);
    } catch (err) {
      console.error(`weatherSnapshots: failed for trip ${trip.id}`, err);
    }
  }
}

// Gleiche Kadenz wie departureReminders.ts - Tages-granulare Daten brauchen kein häufigeres Prüfen.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function startWeatherSnapshotScheduler() {
  recordWeatherSnapshots().catch((err) => console.error('weatherSnapshots: initial run failed', err));
  setInterval(() => {
    recordWeatherSnapshots().catch((err) => console.error('weatherSnapshots: periodic run failed', err));
  }, CHECK_INTERVAL_MS);
}
