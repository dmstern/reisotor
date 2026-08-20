import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Eigene Testdatei statt in registrationMode.test.ts, weil REGISTRATION_MODE als Modul-Konstante
// (registrationConfig.ts) nur einmal pro Testdatei-Import gelesen wird (siehe buildTestApp.ts).
describe('registration mode: off', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.REGISTRATION_MODE = 'off';
    const built = await buildTestApp();
    app = built.app;
  });

  it('GET /auth/config reports the disabled mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/config' });
    expect(res.json()).toEqual({ registrationMode: 'off' });
  });

  it('rejects self-registration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'nope', email: 'nope@example.com', password: 'correct-horse' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'Registrierung ist aktuell deaktiviert' });
  });
});
