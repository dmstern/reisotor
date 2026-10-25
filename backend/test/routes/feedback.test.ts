import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für POST /feedback (routes/feedback.ts): Validierung, dass ein Screenshot als
// Bild-Link in den Issue-Body eingebettet wird, und dass das Label-Set je nach Meldungstyp stimmt -
// bewusst OHNE Trip-Kontext (anders als attachments.test.ts), da Feedback absichtlich nicht
// trip-gebunden ist (siehe requireAuth statt requireTripMember in feedback.ts). fetch ist gemockt
// (gleiches Muster wie githubIssue.test.ts), GITHUB_TOKEN muss VOR buildTestApp() gesetzt sein, da
// routes/feedback.ts ihn beim Modul-Import einmalig liest.
describe('feedback routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPO = 'someone/somerepo';
    const built = await buildTestApp();
    app = built.app;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function register(username: string, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: 'correct-horse' },
    });
    const setCookie = res.headers['set-cookie'];
    return Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  }

  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  it('rejects missing/invalid fields with 400 and never calls the GitHub API', async () => {
    const cookie = await register('feedback-user1', 'fb1@example.com');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const badType = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: { type: 'not-a-type', title: 'x', description: 'y' },
    });
    expect(badType.statusCode).toBe(400);

    const missingTitle = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: { type: 'bug', title: '  ', description: 'y' },
    });
    expect(missingTitle.statusCode).toBe(400);

    const tooLong = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: { type: 'bug', title: 'x'.repeat(201), description: 'y' },
    });
    expect(tooLong.statusCode).toBe(400);

    const badScreenshotType = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: {
        type: 'bug',
        title: 'x',
        description: 'y',
        screenshot: 'data:text/plain;base64,aGVsbG8=',
      },
    });
    expect(badScreenshotType.statusCode).toBe(400);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates a GitHub issue with type-based labels and reporter info, without a screenshot', async () => {
    const cookie = await register('feedback-user2', 'fb2@example.com');
    let sentBody: { title: string; body: string; labels: string[] } | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        sentBody = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 7,
              html_url: 'https://github.com/someone/somerepo/issues/7',
            }),
        });
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: {
        type: 'feature',
        title: 'Bitte X hinzufügen',
        description: 'Wäre praktisch für Y.',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      issue_number: 7,
      issue_url: 'https://github.com/someone/somerepo/issues/7',
    });
    expect(sentBody?.labels).toEqual(['enhancement', 'from-app']);
    expect(sentBody?.body).toContain('feedback-user2');
    expect(sentBody?.body).toContain('fb2@example.com');
    expect(sentBody?.body).not.toContain('![Screenshot]');
  });

  it('uploads an attached screenshot to the feedback-screenshots branch and embeds it as a raw.githubusercontent.com link', async () => {
    const cookie = await register('feedback-user3', 'fb3@example.com');
    let sentBody: { body: string } | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes('/git/ref/heads/feedback-screenshots')) {
          return Promise.resolve({ ok: true, status: 200 });
        }
        if (url.includes('/contents/feedback-screenshots/')) {
          expect(init?.method).toBe('PUT');
          expect(JSON.parse(init!.body as string).branch).toBe('feedback-screenshots');
          return Promise.resolve({ ok: true, status: 201 });
        }
        sentBody = JSON.parse(init!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 8,
              html_url: 'https://github.com/someone/somerepo/issues/8',
            }),
        });
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: {
        type: 'bug',
        title: 'Screenshot-Test',
        description: 'Siehe Bild.',
        screenshot: `data:image/png;base64,${TINY_PNG_BASE64}`,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(sentBody?.body).toMatch(
      /!\[Screenshot\]\(https:\/\/raw\.githubusercontent\.com\/someone\/somerepo\/feedback-screenshots\/feedback-screenshots\/.+\.png\)/
    );
  });

  it('still creates the issue (with a note) when the screenshot upload to GitHub fails', async () => {
    const cookie = await register('feedback-user5', 'fb5@example.com');
    let sentBody: { body: string } | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.includes('/git/ref/heads/feedback-screenshots')) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        sentBody = JSON.parse(init!.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              number: 11,
              html_url: 'https://github.com/someone/somerepo/issues/11',
            }),
        });
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: {
        type: 'bug',
        title: 'Screenshot-Test ohne Upload',
        description: 'Siehe Bild.',
        screenshot: `data:image/png;base64,${TINY_PNG_BASE64}`,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(sentBody?.body).not.toContain('![Screenshot]');
    expect(sentBody?.body).toContain('Screenshot konnte nicht angehängt werden');
  });

  it('surfaces a 502 with the specific error when the GitHub API rejects the request', async () => {
    const cookie = await register('feedback-user4', 'fb4@example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 422 }))
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      headers: { cookie },
      payload: { type: 'bug', title: 'x', description: 'y' },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('GitHub hat die Meldung abgelehnt (Status 422).');
  });

  it('surfaces a 503 with self-hosting hint and repo link when GITHUB_TOKEN is unset and relay forwarding is disabled', async () => {
    const savedToken = process.env.GITHUB_TOKEN;
    const savedForwarding = process.env.FEEDBACK_RELAY_FORWARDING;
    delete process.env.GITHUB_TOKEN;
    process.env.FEEDBACK_RELAY_FORWARDING = 'false';
    try {
      const cookie = await register('feedback-user-no-token', 'notoken@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/api/feedback',
        headers: { cookie },
        payload: { type: 'bug', title: 'x', description: 'y' },
      });

      expect(res.statusCode).toBe(503);
      expect(res.json().error).toContain('GITHUB_TOKEN');
      expect(res.json().error).toContain('https://github.com/someone/somerepo/issues');
    } finally {
      process.env.GITHUB_TOKEN = savedToken;
      if (savedForwarding !== undefined) {
        process.env.FEEDBACK_RELAY_FORWARDING = savedForwarding;
      } else {
        delete process.env.FEEDBACK_RELAY_FORWARDING;
      }
    }
  });

  it('forwards feedback to central relay when GITHUB_TOKEN is unset', async () => {
    const savedToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    let relayPayload: Record<string, unknown> | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        expect(url).toBe('https://reise.ruebenherz.de/api/feedback/relay');
        relayPayload = JSON.parse(init.body as string);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              issue_number: 42,
              issue_url: 'https://github.com/dmstern/reisotor/issues/42',
            }),
        });
      })
    );

    try {
      const cookie = await register('feedback-user-forward', 'forward@example.com');
      const res = await app.inject({
        method: 'POST',
        url: '/api/feedback',
        headers: { cookie },
        payload: {
          type: 'feature',
          title: 'Tolle Idee',
          description: 'Mehr Sonne',
          email: 'custom@example.com',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({
        issue_number: 42,
        issue_url: 'https://github.com/dmstern/reisotor/issues/42',
      });
      expect(relayPayload).toMatchObject({
        type: 'feature',
        title: 'Tolle Idee',
        description: 'Mehr Sonne',
        email: 'custom@example.com',
      });
      expect(relayPayload.version).toBeDefined();
    } finally {
      process.env.GITHUB_TOKEN = savedToken;
    }
  });

  it('handles relay connection errors and 429 rate limit correctly', async () => {
    const savedToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    // Netzwerkfehler
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Network offline')))
    );

    try {
      const cookie = await register('feedback-user-err', 'err@example.com');
      const res502 = await app.inject({
        method: 'POST',
        url: '/api/feedback',
        headers: { cookie },
        payload: { type: 'bug', title: 'Offline Test', description: 'Etwas ist offline' },
      });
      expect(res502.statusCode).toBe(502);
      expect(res502.json().error).toContain('Feedback-Relay');

      // 429 Rate Limit vom Relay
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 429,
            json: () => Promise.resolve({ error: 'Zu viele Meldungen' }),
          })
        )
      );

      const res429 = await app.inject({
        method: 'POST',
        url: '/api/feedback',
        headers: { cookie },
        payload: { type: 'bug', title: 'Rate Limit Test', description: 'Zu viele Meldungen' },
      });
      expect(res429.statusCode).toBe(429);
      expect(res429.json().error).toBe('Zu viele Meldungen');
    } finally {
      process.env.GITHUB_TOKEN = savedToken;
    }
  });

  describe('feedback relay route (POST /api/feedback/relay)', () => {
    it('returns 404 when FEEDBACK_RELAY_ENABLED is not true', async () => {
      const saved = process.env.FEEDBACK_RELAY_ENABLED;
      delete process.env.FEEDBACK_RELAY_ENABLED;
      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/feedback/relay',
          payload: { type: 'bug', title: 'Test', description: 'Test' },
        });
        expect(res.statusCode).toBe(404);
      } finally {
        if (saved !== undefined) process.env.FEEDBACK_RELAY_ENABLED = saved;
      }
    });

    it('enforces rate limiting on relay requests (max 5 per IP)', async () => {
      const savedRelay = process.env.FEEDBACK_RELAY_ENABLED;
      process.env.FEEDBACK_RELAY_ENABLED = 'true';
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                number: 1,
                html_url: 'https://github.com/someone/somerepo/issues/1',
              }),
          })
        )
      );

      try {
        const payload = { type: 'bug', title: 'Rate Test', description: 'Test' };
        for (let i = 0; i < 5; i++) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/feedback/relay',
            payload,
            remoteAddress: '10.0.0.99',
          });
          expect(res.statusCode).toBe(201);
        }

        // 6. Aufruf von gleicher IP muss 429 liefern
        const limitedRes = await app.inject({
          method: 'POST',
          url: '/api/feedback/relay',
          payload,
          remoteAddress: '10.0.0.99',
        });
        expect(limitedRes.statusCode).toBe(429);
        expect(limitedRes.headers['retry-after']).toBeDefined();
        expect(limitedRes.json().error).toContain('Zu viele Feedback-Meldungen');
      } finally {
        if (savedRelay !== undefined) {
          process.env.FEEDBACK_RELAY_ENABLED = savedRelay;
        } else {
          delete process.env.FEEDBACK_RELAY_ENABLED;
        }
      }
    });

    it('creates an issue with community-instance labels when relay is enabled', async () => {
      const savedRelay = process.env.FEEDBACK_RELAY_ENABLED;
      process.env.FEEDBACK_RELAY_ENABLED = 'true';

      let issuePayload: { labels: string[]; body: string } | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init: RequestInit) => {
          if (url.includes('/issues')) {
            issuePayload = JSON.parse(init.body as string);
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  number: 99,
                  html_url: 'https://github.com/someone/somerepo/issues/99',
                }),
            });
          }
          return Promise.resolve({ ok: true });
        })
      );

      try {
        const res = await app.inject({
          method: 'POST',
          url: '/api/feedback/relay',
          payload: {
            type: 'bug',
            title: 'Bug auf Raspberry Pi',
            description: 'Fehler beim Laden',
            version: 'v1.3.0',
            email: 'raspi@example.com',
          },
        });

        expect(res.statusCode).toBe(201);
        expect(res.json()).toEqual({
          issue_number: 99,
          issue_url: 'https://github.com/someone/somerepo/issues/99',
        });
        expect(issuePayload.labels).toEqual([
          'community-instance',
          'needs-triage',
          'bug',
          'from-app',
        ]);
        expect(issuePayload.body).toContain('Fehler beim Laden');
        expect(issuePayload.body).toContain('Externe Community-Instanz');
        expect(issuePayload.body).toContain('`v1.3.0`');
        expect(issuePayload.body).toContain('raspi@example.com');
      } finally {
        if (savedRelay !== undefined) {
          process.env.FEEDBACK_RELAY_ENABLED = savedRelay;
        } else {
          delete process.env.FEEDBACK_RELAY_ENABLED;
        }
      }
    });
  });

  it('requires authentication', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/feedback',
      payload: { type: 'bug', title: 'x', description: 'y' },
    });
    expect(res.statusCode).toBe(401);
  });
});
