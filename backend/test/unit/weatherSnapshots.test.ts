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

function mockOpenMeteoResponse(days: { date: string; code: number; max: number; min: number; rain: number }[]) {
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
      '🧪',
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

  async function createTrip(overrides: Partial<{ name: string; start_date: string; end_date: string; lat: number; lng: number }>) {
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
        ]),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();

    const stored = db
      .prepare('SELECT date, weathercode, temp_max, temp_min FROM trip_weather_snapshots WHERE trip_id = ? ORDER BY date')
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
        ]),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();
    await recordWeatherSnapshots();

    const stored = db.prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ?').all(tripId) as { date: string }[];
    expect(stored).toHaveLength(3);
    // Zweiter Lauf hätte für diesen Trip nichts mehr zu holen - kein weiterer Fetch-Aufruf nötig.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('überspringt Trips ohne lat/lng komplett - kein Fetch-Aufruf', async () => {
    await createTrip({ start_date: isoDateInDays(-5), end_date: isoDateInDays(-1), lat: undefined, lng: undefined });

    const fetchMock = vi.fn(() => Promise.resolve(mockOpenMeteoResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('überspringt Trips außerhalb des 92-Tage-Fensters (weit in der Vergangenheit)', async () => {
    const tripId = await createTrip({ start_date: isoDateInDays(-200), end_date: isoDateInDays(-190) });

    const fetchMock = vi.fn(() => Promise.resolve(mockOpenMeteoResponse([])));
    vi.stubGlobal('fetch', fetchMock);

    const { recordWeatherSnapshots } = await import('../../src/weatherSnapshots.js');
    await recordWeatherSnapshots();

    expect(fetchMock).not.toHaveBeenCalled();
    const stored = db.prepare('SELECT date FROM trip_weather_snapshots WHERE trip_id = ?').all(tripId);
    expect(stored).toEqual([]);
  });
});
