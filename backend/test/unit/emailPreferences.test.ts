import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';
import * as mailer from '../../src/utils/mailer.js';

describe('E-Mail-Präferenzen filtern den Versand pro Domäne', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let ownerCookie: string;
  let memberCookie: string;
  let tripId: number;
  let sendActivityEmailSpy: ReturnType<typeof vi.spyOn>;
  const suffix = Date.now();
  const ownerUsername = `em_owner_${suffix}`;
  const memberUsername = `em_member_${suffix}`;

  beforeAll(async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    sendActivityEmailSpy = vi.spyOn(mailer, 'sendActivityEmail').mockResolvedValue({
      success: true,
      actionUrl: 'http://localhost:5173/trip/1',
    });

    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    db.prepare(
      'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)'
    ).run(
      ownerUsername,
      `${ownerUsername}@example.com`,
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );
    db.prepare(
      'INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)'
    ).run(
      memberUsername,
      `${memberUsername}@example.com`,
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );

    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: ownerUsername, password: 'correct-horse' },
    });
    ownerCookie = String(ownerLogin.headers['set-cookie']);
    const memberLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: memberUsername, password: 'correct-horse' },
    });
    memberCookie = String(memberLogin.headers['set-cookie']);

    const createTrip = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: ownerCookie },
      payload: { name: 'E-Mail-Test-Trip', start_date: '2030-01-01', end_date: '2030-01-10' },
    });
    tripId = createTrip.json().id as number;

    const memberId = (
      db.prepare('SELECT id FROM users WHERE username = ?').get(memberUsername) as { id: number }
    ).id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberId },
    });
  });

  afterAll(() => {
    delete process.env.SMTP_HOST;
    sendActivityEmailSpy.mockRestore();
  });

  it('GET /notifications/email-preferences liefert alle bekannten Domänen mit Default false', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications/email-preferences',
      headers: { cookie: memberCookie },
    });
    expect(res.statusCode).toBe(200);
    const prefs = res.json();
    expect(prefs.schedule).toBe(false);
    expect(prefs.packing).toBe(false);
    expect(prefs.version).toBe(false);
  });

  it('sendet standardmäßig keine E-Mail, wenn Domäne nicht aktiviert ist (Opt-in)', async () => {
    sendActivityEmailSpy.mockClear();
    await app.inject({
      method: 'POST',
      url: '/api/schedule',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId, date: '2030-01-02', title: 'Ankunft' },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendActivityEmailSpy).not.toHaveBeenCalled();
  });

  it('sendet eine E-Mail, sobald die Domäne per PUT aktiviert wurde', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/notifications/email-preferences',
      headers: { cookie: memberCookie },
      payload: { schedule: true },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().schedule).toBe(true);

    sendActivityEmailSpy.mockClear();
    await app.inject({
      method: 'POST',
      url: '/api/schedule',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId, date: '2030-01-03', title: 'Wanderung' },
    });

    await vi.waitFor(() => expect(sendActivityEmailSpy).toHaveBeenCalledTimes(1));
    const [call] = sendActivityEmailSpy.mock.calls as [
      { to: string; username: string; tripName: string }[],
    ];
    expect(call[0].to).toBe(`${memberUsername}@example.com`);
    expect(call[0].username).toBe(memberUsername);
    expect(call[0].tripName).toBe('E-Mail-Test-Trip');
  });

  it('lehnt ungültige Domain-Keys mit 400 ab', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/notifications/email-preferences',
      headers: { cookie: memberCookie },
      payload: { invalid_domain: true },
    });
    expect(res.statusCode).toBe(400);
  });
});
