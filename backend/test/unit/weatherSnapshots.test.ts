import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

// recordWeatherSnapshots() nutzt "heute" per new Date() für den Tagesvergleich (siehe dortiger
// Kommentar) - Test-Daten werden deshalb relativ zu "heute" berechnet statt hartcodiert.
function isoDateInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mockOpenMeteoResponse(
  days: { date: string; code: number; max: number; min: number; rain: number }[]
) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        daily: {
          time: days.map((d) => d.date),
          weathercode: days.map((d) => d.code),
          temperature_2m_max: days.map((d) => d.max),
          temperature_2m_min: days.map((d) => d.min),
          precipitation_probability_max: days.map((d) => d.rain),
        },
      }),
  };
}

describe('recordWeatherSnapshots', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let cookie: string;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'weatheruser',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'weatheruser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function createTrip(
    overrides: Partial<{
      name: string;
      start_date: string;
      end_date: string;
      lat: number;
      lng: number;
    }>
  ) {
    const create = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Test-Trip',
        start_date: isoDateInDays(-10),
        end_date: isoDateInDays(-1),
        lat: 38.7,
        lng: -9.1,
        ...overrides,
      },
    });
    return create.json().id as number;
  }

  it('speichert nur strikt vergangene, abgeschlossene Tage - der laufende Urlaub bekommt für "heute" keine Zeile', async () => {
    const tripId = await createTrip({ start_date: isoDateInDays(-2), end_date: isoDateInDays(2) });

    const fetchMock = vi.fn(() =>
      Promise.resolve(
        mockOpenMeteoResponse([
          { date: isoDateInDays(-2), code: 1, max: 20, min: 12, rain: 10 },
          { date: isoDateInDays(-1), code: 2, max: 21, min: 13, rain: 20 },
          { date: isoDateInDays(0), code: 3, max: 22, min: 14, rain: 30 },
        ])
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();

    const stored = db
      .prepare(
        'SELECT date, weathercode, temp_max, temp_min FROM trip_weather_snapshots WHERE trip_id = ? ORDER BY date'
      )
      .all(tripId) as { date: string; weathercode: number; temp_max: number; temp_min: number }[];
    expect(stored.map((r) => r.date)).toEqual([isoDateInDays(-2), isoDateInDays(-1)]);
    expect(stored[0]).toMatchObject({ weathercode: 1, temp_max: 20, temp_min: 12 });
  });

  it('speichert bei einem erneuten Lauf keine Duplikate für bereits gespeicherte Tage', async () => {
    const tripId = await createTrip({ start_date: isoDateInDays(-3), end_date: isoDateInDays(-1) });

    const fetchMock = vi.fn(() =>
      Promise.resolve(
        mockOpenMeteoResponse([
          { date: isoDateInDays(-3), code: 0, max: 25, min: 15, rain: 0 },
          { date: isoDateInDays(-2), code: 0, max: 26, min: 16, rain: 0 },
          { date: isoDateInDays(-1), code: 0, max: 27, min: 17, rain: 0 },
        ])
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();
    await recordWeatherSnapshots();

    const stored = db
      .prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ?')
      .all(tripId) as { date: string }[];
    expect(stored).toHaveLength(3);
    // Zweiter Lauf hätte für diesen Trip nichts mehr zu holen - kein weiterer Fetch-Aufruf nötig.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('überspringt Trips ohne lat/lng komplett - kein Fetch-Aufruf', async () => {
    await createTrip({
      start_date: isoDateInDays(-5),
      end_date: isoDateInDays(-1),
      lat: undefined,
      lng: undefined,
    });

    const fetchMock = vi.fn(() => Promise.resolve(mockOpenMeteoResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('überspringt Trips außerhalb des 92-Tage-Fensters (weit in der Vergangenheit)', async () => {
    const tripId = await createTrip({
      start_date: isoDateInDays(-200),
      end_date: isoDateInDays(-190),
    });

    const fetchMock = vi.fn(() => Promise.resolve(mockOpenMeteoResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();

    expect(fetchMock).not.toHaveBeenCalled();
    const stored = db
      .prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ?')
      .all(tripId);
    expect(stored).toEqual([]);
  });

  // Regressionstest für #82: eine falsche/ungenaue Anfangs-Koordinate durfte vergangene
  // Wetter-Snapshots nicht dauerhaft auf falschen Werten einfrieren, sobald der Ort später
  // korrigiert wird.
  describe('Wetter-Snapshots bei Orts-Änderung (Issue #82)', () => {
    it('löscht gespeicherte Wetter-Snapshots und holt sie mit dem neuen Ort erneut, sobald sich lat/lng per PUT ändern', async () => {
      const tripId = await createTrip({
        start_date: isoDateInDays(-5),
        end_date: isoDateInDays(-1),
        lat: 50.0,
        lng: 10.0,
      });

      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            mockOpenMeteoResponse([
              { date: isoDateInDays(-5), code: 3, max: 14, min: 8, rain: 60 },
              { date: isoDateInDays(-4), code: 3, max: 15, min: 9, rain: 60 },
              { date: isoDateInDays(-3), code: 3, max: 14, min: 8, rain: 60 },
              { date: isoDateInDays(-2), code: 3, max: 15, min: 9, rain: 60 },
              { date: isoDateInDays(-1), code: 3, max: 14, min: 8, rain: 60 },
            ])
          )
        )
      );
      const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
      await recordWeatherSnapshots();

      const beforeCorrection = db
        .prepare('SELECT temp_max FROM trip_weather_snapshots WHERE trip_id = ?')
        .all(tripId) as { temp_max: number }[];
      expect(beforeCorrection).toHaveLength(5);
      expect(beforeCorrection.every((r) => r.temp_max < 20)).toBe(true);

      // Ort wird korrigiert (z.B. Neapel statt der ursprünglich ungenauen Koordinate) - die neue
      // Antwort spiegelt die tatsächlichen, deutlich höheren Temperaturen wider.
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            mockOpenMeteoResponse([
              { date: isoDateInDays(-5), code: 0, max: 35, min: 24, rain: 0 },
              { date: isoDateInDays(-4), code: 0, max: 36, min: 25, rain: 0 },
              { date: isoDateInDays(-3), code: 0, max: 34, min: 24, rain: 0 },
              { date: isoDateInDays(-2), code: 0, max: 35, min: 25, rain: 0 },
              { date: isoDateInDays(-1), code: 0, max: 36, min: 26, rain: 0 },
            ])
          )
        )
      );
      const update = await app.inject({
        method: 'PUT',
        url: `/api/trips/${tripId}`,
        headers: { cookie },
        payload: {
          name: 'Test-Trip',
          start_date: isoDateInDays(-5),
          end_date: isoDateInDays(-1),
          lat: 40.85,
          lng: 14.27,
        },
      });
      expect(update.statusCode).toBe(200);

      // Der Refresh nach der Orts-Änderung läuft fire-and-forget im Hintergrund (siehe
      // routes/trips.ts) - hier direkt erneut aufgerufen statt auf einen unbestimmten Zeitpunkt zu
      // warten; da alte Zeilen bereits synchron in der Route gelöscht wurden, holt dieser Aufruf
      // garantiert (erneut) alle Tage mit den korrigierten Werten.
      const { refreshTripWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
      await refreshTripWeatherSnapshots(tripId);

      const afterCorrection = db
        .prepare('SELECT temp_max FROM trip_weather_snapshots WHERE trip_id = ? ORDER BY date')
        .all(tripId) as { temp_max: number }[];
      expect(afterCorrection).toHaveLength(5);
      expect(afterCorrection.every((r) => r.temp_max >= 34)).toBe(true);
    });

    it('lässt gespeicherte Wetter-Snapshots unangetastet, wenn sich der Ort per PUT nicht ändert', async () => {
      const tripId = await createTrip({
        start_date: isoDateInDays(-3),
        end_date: isoDateInDays(-1),
        lat: 40.85,
        lng: 14.27,
      });

      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            mockOpenMeteoResponse([
              { date: isoDateInDays(-3), code: 0, max: 34, min: 24, rain: 0 },
              { date: isoDateInDays(-2), code: 0, max: 35, min: 25, rain: 0 },
              { date: isoDateInDays(-1), code: 0, max: 36, min: 26, rain: 0 },
            ])
          )
        )
      );
      const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
      await recordWeatherSnapshots();

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const update = await app.inject({
        method: 'PUT',
        url: `/api/trips/${tripId}`,
        headers: { cookie },
        payload: {
          name: 'Umbenannt, aber gleicher Ort',
          start_date: isoDateInDays(-3),
          end_date: isoDateInDays(-1),
          lat: 40.85,
          lng: 14.27,
        },
      });
      expect(update.statusCode).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();

      const stored = db
        .prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ?')
        .all(tripId);
      expect(stored).toHaveLength(3);
    });
  });

  describe('GET /api/weather (Open-Meteo-Proxy & Cache, Issue #538)', () => {
    afterEach(async () => {
      const { clearWeatherProxyCache } = await import('../../src/weatherSnapshots.js');
      clearWeatherProxyCache();
    });

    it('erfordert Authentifizierung (401 ohne Session)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/weather?lat=38.72&lng=-9.14',
      });
      expect(res.statusCode).toBe(401);
    });

    it('validiert Koordinaten und Quelle (400 bei ungültigen Parametern)', async () => {
      const missingCoords = await app.inject({
        method: 'GET',
        url: '/api/weather',
        headers: { cookie },
      });
      expect(missingCoords.statusCode).toBe(400);

      const outOfRange = await app.inject({
        method: 'GET',
        url: '/api/weather?lat=999&lng=-9.14',
        headers: { cookie },
      });
      expect(outOfRange.statusCode).toBe(400);

      const invalidSource = await app.inject({
        method: 'GET',
        url: '/api/weather?lat=38.72&lng=-9.14&source=invalid',
        headers: { cookie },
      });
      expect(invalidSource.statusCode).toBe(400);
    });

    it('rundet Koordinaten auf 2 Nachkommastellen und cacht Forecast-Antworten serverseitig', async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve(
          mockOpenMeteoResponse([{ date: '2026-08-14', code: 0, max: 28, min: 19, rain: 5 }])
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      const res1 = await app.inject({
        method: 'GET',
        url: '/api/weather?lat=38.7223&lng=-9.1393&past_days=1&forecast_days=16&models=ecmwf_ifs025',
        headers: { cookie },
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().daily.time).toEqual(['2026-08-14']);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain('https://api.open-meteo.com/v1/forecast?');
      expect(calledUrl).toContain('latitude=38.72');
      expect(calledUrl).toContain('longitude=-9.14');
      expect(calledUrl).not.toContain('38.7223');

      // Zweite Anfrage mit nahegelegenen Koordinaten (gleiche 2-Dezimalstellen-Rundung) kommt aus dem Server-Cache
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/weather?lat=38.7241&lng=-9.136&past_days=1&forecast_days=16&models=ecmwf_ifs025',
        headers: { cookie },
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json()).toEqual(res1.json());
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('leitet source=archive an archive-api.open-meteo.com weiter', async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              hourly: {
                time: ['2024-08-04T12:00'],
                temperature_2m: [26.5],
                weathercode: [1],
                precipitation_probability: [10],
              },
            }),
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const res = await app.inject({
        method: 'GET',
        url: '/api/weather?source=archive&lat=38.7223&lng=-9.1393&hourly=weathercode,temperature_2m,precipitation_probability&start_date=2024-08-04&end_date=2024-08-04',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain('https://archive-api.open-meteo.com/v1/archive?');
      expect(calledUrl).toContain('latitude=38.72');
      expect(calledUrl).toContain('longitude=-9.14');
      expect(res.json().hourly.temperature_2m).toEqual([26.5]);
    });
  });
});
