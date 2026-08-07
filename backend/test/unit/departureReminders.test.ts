import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

// checkDepartureReminders() nutzt die SERVER-Zeitzone/-Datum (new Date()) für den Schwellwert-
// Abgleich (siehe dortiger Kommentar) - Test-Daten werden deshalb relativ zu "heute" berechnet statt
// hartcodiert, damit der Test unabhängig vom tatsächlichen Ausführungsdatum funktioniert.
function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('checkDepartureReminders', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let cookie: string;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'reminderuser',
      bcrypt.hashSync('correct-horse', 10),
      '🧪',
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'reminderuser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  afterAll(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('markiert einen Urlaub mit Abreise in exakt 7 Tagen als "7-Tage-Schwellwert verschickt"', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'In-7-Tagen-Trip', start_date: isoDateInDays(7), end_date: isoDateInDays(10) },
    });
    const tripId = create.json().id as number;

    const { checkDepartureReminders } = await import('../../src/departureReminders.js');
    await checkDepartureReminders();

    const sent = db
      .prepare('SELECT threshold_days FROM trip_departure_reminders_sent WHERE trip_id = ?')
      .all(tripId) as { threshold_days: number }[];
    expect(sent).toEqual([{ threshold_days: 7 }]);
  });

  it('verschickt denselben Schwellwert nicht doppelt bei einem erneuten Check', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'In-1-Tag-Trip', start_date: isoDateInDays(1), end_date: isoDateInDays(3) },
    });
    const tripId = create.json().id as number;

    const { checkDepartureReminders } = await import('../../src/departureReminders.js');
    await checkDepartureReminders();
    await checkDepartureReminders();

    const sent = db
      .prepare('SELECT threshold_days FROM trip_departure_reminders_sent WHERE trip_id = ?')
      .all(tripId) as { threshold_days: number }[];
    expect(sent).toEqual([{ threshold_days: 1 }]);
  });

  it('verschickt keine Erinnerung für einen Urlaub, dessen Abreise auf keinen Schwellwert fällt', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'In-4-Tagen-Trip', start_date: isoDateInDays(4), end_date: isoDateInDays(6) },
    });
    const tripId = create.json().id as number;

    const { checkDepartureReminders } = await import('../../src/departureReminders.js');
    await checkDepartureReminders();

    const sent = db.prepare('SELECT threshold_days FROM trip_departure_reminders_sent WHERE trip_id = ?').all(tripId);
    expect(sent).toEqual([]);
  });
});
