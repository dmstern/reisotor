import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('Sentinel Nightly Audit - Spots Preview Verification', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  it('rejects unauthenticated requests to /spots/preview with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/spots/preview?maps_link=https://maps.google.com',
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows authenticated requests to /spots/preview without requiring trip_id', async () => {
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        username: 'spotpreviewuser',
        email: 'preview@example.com',
        password: 'Password123!',
      },
    });
    const setCookie = regRes.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const res = await app.inject({
      method: 'GET',
      url: '/api/spots/preview',
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
  });
});
