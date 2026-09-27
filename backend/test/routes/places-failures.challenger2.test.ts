import http from 'http';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';
import { clearPlacesCache } from '../../src/utils/places.js';

describe('Challenger 2 Adversarial Stress: Upstream Failures & Timeouts', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;

    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('c2_user', bcrypt.hashSync('testpass123', 10), '🛡️');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'c2_user', password: 'testpass123' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearPlacesCache();
  });

  it('1. Upstream 500 Internal Server Error: Fastify does NOT crash and returns 200 with []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: () => Promise.resolve('Fatal error in Photon upstream'),
        })
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=Berlin',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('2. Upstream 404 Not Found: Fastify does NOT crash and returns 200 with []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=Nowhere',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('3. Upstream 429 Too Many Requests: Fastify does NOT crash and returns 200 with []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'Retry-After': '60' }),
        })
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=HighFrequencyQuery',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('4. Upstream socket hang up / ECONNRESET: Fastify does NOT crash and returns 200 with []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        const socketErr = new TypeError('fetch failed: socket hang up');
        (socketErr as unknown as { cause: { code: string } }).cause = { code: 'ECONNRESET' };
        return Promise.reject(socketErr);
      })
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=DroppedConnection',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('5. 5000ms AbortSignal Timeout simulated: Fastify does NOT crash and returns 200 with []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=SimulatedTimeout',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('6. AbortSignal verification: searchPlaces passes an AbortSignal to fetch', async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        capturedSignal = init?.signal as AbortSignal;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
        });
      })
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=SignalCheck',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal instanceof AbortSignal).toBe(true);
  });

  it('7. Malformed upstream body (HTML Cloudflare page): Fastify returns 200 with []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
        })
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=CloudflareError',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('8. Upstream failures are NEVER cached: subsequent request queries upstream and succeeds', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: { type: 'Point', coordinates: [13.4, 52.5] },
                  properties: { name: 'Recovered Tor' },
                },
              ],
            }),
        });
      })
    );

    // Call 1: Upstream 500 -> Returns []
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=HealCheck',
      headers: { cookie },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual([]);

    // Call 2: Must call fetch again, NOT return stale cached []
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=HealCheck',
      headers: { cookie },
    });
    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();
    expect(body2).toHaveLength(1);
    expect(body2[0].name).toBe('Recovered Tor');
    expect(callCount).toBe(2);
  });

  it('9. Real native fetch with hanging HTTP server triggers AbortSignal.timeout(5000) cleanly', async () => {
    // Spin up an actual real HTTP server on localhost that deliberately never responds
    const hangServer = http.createServer((_req, _res) => {
      // Intentionally do not write or end response
    });

    await new Promise<void>((resolve) => {
      hangServer.listen(0, '127.0.0.1', () => resolve());
    });

    const port = (hangServer.address() as { port: number }).port;
    const originalEnv = process.env.PHOTON_API_URL;
    process.env.PHOTON_API_URL = `http://127.0.0.1:${port}/api/`;

    try {
      // Use real un-mocked native fetch
      const startTime = Date.now();
      const res = await app.inject({
        method: 'GET',
        url: '/api/places/search?q=RealHangTest',
        headers: { cookie },
      });
      const durationMs = Date.now() - startTime;

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
      // Should have taken ~5000ms due to AbortSignal.timeout(5000)
      expect(durationMs).toBeGreaterThanOrEqual(4800);
    } finally {
      process.env.PHOTON_API_URL = originalEnv;
      await new Promise<void>((resolve) => hangServer.close(() => resolve()));
    }
  }, 12000);
});
