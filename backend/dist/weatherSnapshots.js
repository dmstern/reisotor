import { db } from './db/index.js';
const DAY_MS = 24 * 60 * 60 * 1000;
// Open-Meteo's past_days-Parameter deckt bis zu 92 Tage rückwirkend ab (ein einzelner Aufruf reicht
// dadurch für jede realistische Lücke, kein separater Archiv-API-Call nötig).
const MAX_PAST_DAYS = 92;
function todayUtcDateStr() {
    return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
function daysBetween(fromStr, toStr) {
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const from = Date.UTC(fy, fm - 1, fd);
    const to = Date.UTC(ty, tm - 1, td);
    return Math.round((to - from) / DAY_MS);
}
function dateRange(startStr, endStr) {
    const dates = [];
    for (let cur = startStr; cur <= endStr; cur = addDays(cur, 1)) {
        dates.push(cur);
    }
    return dates;
}
const upsertSnapshot = db.prepare(`
  INSERT INTO trip_weather_snapshots (trip_id, lat, lng, date, weathercode, temp_max, temp_min, precipitation_probability)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(trip_id, lat, lng, date) DO UPDATE SET
    weathercode = excluded.weathercode,
    temp_max = excluded.temp_max,
    temp_min = excluded.temp_min,
    precipitation_probability = excluded.precipitation_probability
`);
/** Ermittelt für einen einzelnen Urlaub und dessen zugehörige Orte (Reiseziel, Spots, Touren-Stationen),
 *  welche strikt vergangenen (abgeschlossenen) Tage noch keinen Wetter-Snapshot haben, holt sie bei Bedarf
 *  per Open-Meteo und speichert sie dauerhaft in trip_weather_snapshots. Der heutige Tag wird bewusst NIE
 *  gespeichert - Open-Meteo liefert dafür noch keinen finalen Ist-Wert. */
async function snapshotTripWeather(trip, today) {
    const yesterday = addDays(today, -1);
    if (trip.start_date > yesterday)
        return;
    const rangeEnd = trip.end_date < yesterday ? trip.end_date : yesterday;
    const tripDates = dateRange(trip.start_date, rangeEnd);
    // Map von "lat,lng"-Key -> { lat, lng, dates: Set<string> }
    const locationTargets = new Map();
    function addTarget(lat, lng, dates) {
        if (lat == null || lng == null || !dates.length)
            return;
        const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
        let target = locationTargets.get(key);
        if (!target) {
            target = { lat, lng, dates: new Set() };
            locationTargets.set(key, target);
        }
        for (const d of dates) {
            if (d <= yesterday)
                target.dates.add(d);
        }
    }
    // 1. Reiseziel des Trips
    if (trip.lat != null && trip.lng != null && tripDates.length) {
        addTarget(trip.lat, trip.lng, tripDates);
    }
    // 2. Spots mit eignen Koordinaten und verknüpftem Datum
    const spots = db
        .prepare(`SELECT lat, lng, start_date, end_date FROM spots
       WHERE trip_id = ? AND lat IS NOT NULL AND lng IS NOT NULL AND start_date IS NOT NULL AND deleted_at IS NULL`)
        .all(trip.id);
    for (const s of spots) {
        const sEnd = s.end_date || s.start_date;
        const sDates = dateRange(s.start_date, sEnd < yesterday ? sEnd : yesterday);
        addTarget(s.lat, s.lng, sDates);
    }
    // 3. Touren-Stationen mit eigenen Koordinaten
    const excursions = db
        .prepare(`SELECT DISTINCT s.date, sp.lat, sp.lng
       FROM ideas i
       JOIN schedule_items s ON s.idea_id = i.id
       JOIN excursion_spots es ON es.idea_id = i.id
       JOIN spots sp ON sp.id = es.spot_id
       WHERE i.trip_id = ? AND s.date IS NOT NULL AND i.deleted_at IS NULL AND s.deleted_at IS NULL AND sp.deleted_at IS NULL AND sp.lat IS NOT NULL AND sp.lng IS NOT NULL`)
        .all(trip.id);
    for (const e of excursions) {
        if (e.date <= yesterday) {
            addTarget(e.lat, e.lng, [e.date]);
        }
    }
    // Pro Ort fehlende Snapshots ermitteln und von Open-Meteo laden
    for (const target of locationTargets.values()) {
        const wantedDates = [...target.dates].sort();
        if (!wantedDates.length)
            continue;
        const existing = db
            .prepare(`SELECT date FROM trip_weather_snapshots
         WHERE trip_id = ? AND ABS(lat - ?) < 0.001 AND ABS(lng - ?) < 0.001 AND date >= ? AND date <= ?`)
            .all(trip.id, target.lat, target.lng, wantedDates[0], wantedDates[wantedDates.length - 1]);
        const existingSet = new Set(existing.map((r) => r.date));
        const missingDates = wantedDates.filter((d) => !existingSet.has(d));
        if (!missingDates.length)
            continue;
        const pastDays = Math.min(MAX_PAST_DAYS, daysBetween(missingDates[0], today));
        const params = new URLSearchParams({
            latitude: String(target.lat),
            longitude: String(target.lng),
            daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
            timezone: 'auto',
            past_days: String(pastDays),
            forecast_days: '1',
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!res.ok)
            throw new Error(`Open-Meteo request failed (${res.status})`);
        const data = (await res.json());
        const missingSet = new Set(missingDates);
        data.daily.time.forEach((date, i) => {
            if (!missingSet.has(date))
                return;
            upsertSnapshot.run(trip.id, target.lat, target.lng, date, data.daily.weathercode[i], data.daily.temperature_2m_max[i], data.daily.temperature_2m_min[i], data.daily.precipitation_probability_max?.[i] ?? null);
        });
    }
}
/** Holt vergangene Wetter-Ist-Werte für genau einen Trip neu - wird von PUT /trips/:id
 *  aufgerufen, nachdem sich der Ort (lat/lng) geändert hat und deshalb zuvor gespeicherte
 *  trip_weather_snapshots-Zeilen (die noch zum alten Ort gehören) gelöscht wurden. Ohne diesen
 *  Aufruf würden die als "missing" geltenden Tage erst beim nächsten periodischen Lauf (bis zu
 *  CHECK_INTERVAL_MS später) neu geholt. */
export async function refreshTripWeatherSnapshots(tripId) {
    const trip = db
        .prepare('SELECT id, lat, lng, start_date, end_date FROM trips WHERE id = ?')
        .get(tripId);
    if (!trip || trip.lat == null || trip.lng == null)
        return;
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
        .prepare(`SELECT id, lat, lng, start_date, end_date FROM trips
       WHERE lat IS NOT NULL AND lng IS NOT NULL
         AND end_date >= date('now', '-92 days')
         AND start_date <= date('now')`)
        .all();
    for (const trip of trips) {
        try {
            await snapshotTripWeather(trip, today);
        }
        catch (err) {
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
