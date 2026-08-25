import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für die serverseitige HTML-Sanitizing (routes/notes.ts, utils/sanitizeHtml.ts) -
// stellvertretend für alle Routen, die vom neuen WYSIWYG-Editor (RichTextEditor.vue) befülltes HTML
// entgegennehmen (siehe content_format/note_format-Spalten, db/index.ts). Verteidigung gegen
// Clients, die die clientseitige Sanitizing vor dem Absenden umgehen.
describe('notes route HTML sanitizing', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('sanitizetester', bcrypt.hashSync('correct-horse', 10), '🧪');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'sanitizetester', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Sanitize-Testreise', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    tripId = tripRes.json().id;
  });

  it('strips a <script> tag from HTML content before storing it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Sanitize-Test',
        content: '<p>Hallo</p><script>alert("xss")</script>',
        content_format: 'html',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.content).not.toContain('<script>');
    expect(body.content).toContain('<p>Hallo</p>');
    expect(body.content_format).toBe('html');
  });

  it('keeps content untouched (no sanitizing/format flip) when content_format is not "html"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Legacy-Test',
        content: '**fett** und <script>bad()</script>',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    // Legacy-Pfad speichert unverändert (wird nur beim Anzeigen über renderRichText() escaped) -
    // kein serverseitiges Sanitizing für Plain-Text-Inhalte nötig, die nie als HTML gerendert werden.
    expect(body.content).toBe('**fett** und <script>bad()</script>');
    expect(body.content_format).toBe('legacy');
  });
});
