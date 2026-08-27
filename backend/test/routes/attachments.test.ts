import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für Datei-Anhänge (routes/attachments.ts): Auth-Gating über den
// domain/entity_id-basierten trip_id-Lookup (kein Client-seitig vertrautes trip_id), Mime-Type-
// Validierung und der 404-Fall bei nicht existierendem Zielobjekt.
describe('attachments routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  async function register(username: string, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: 'correct-horse' },
    });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    return { cookie, userId: res.json().id as number };
  }

  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  it('POST /attachments requires a valid domain+entity_id and rejects non-members', async () => {
    const owner = await register('flori', 'flori@example.com');
    const outsider = await register('greta', 'greta@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Anhang-Trip', start_date: '2026-05-01', end_date: '2026-05-05' },
    });
    const tripId = tripRes.json().id;

    const noteRes = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, title: 'Ticket', content: 'Flugticket-Notiz' },
    });
    const noteId = noteRes.json().id;

    const badDomain = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie: owner.cookie },
      payload: { domain: 'not-a-domain', entity_id: noteId, data: 'x', filename: 'x.png' },
    });
    expect(badDomain.statusCode).toBe(400);

    const missingEntity = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie: owner.cookie },
      payload: {
        domain: 'notes',
        entity_id: 999999,
        data: `data:image/png;base64,${TINY_PNG_BASE64}`,
        filename: 'x.png',
      },
    });
    expect(missingEntity.statusCode).toBe(404);

    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie: outsider.cookie },
      payload: {
        domain: 'notes',
        entity_id: noteId,
        data: `data:image/png;base64,${TINY_PNG_BASE64}`,
        filename: 'x.png',
      },
    });
    expect(forbidden.statusCode).toBe(403);

    const unsupportedType = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie: owner.cookie },
      payload: {
        domain: 'notes',
        entity_id: noteId,
        data: 'data:text/plain;base64,aGVsbG8=',
        filename: 'x.txt',
      },
    });
    expect(unsupportedType.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie: owner.cookie },
      payload: {
        domain: 'notes',
        entity_id: noteId,
        data: `data:image/png;base64,${TINY_PNG_BASE64}`,
        filename: 'ticket.png',
      },
    });
    expect(created.statusCode).toBe(201);
    const attachment = created.json();
    expect(attachment.url).toMatch(/^\/api\/uploads\//);
    expect(attachment.original_name).toBe('ticket.png');

    const listForbidden = await app.inject({
      method: 'GET',
      url: `/api/attachments?domain=notes&entity_id=${noteId}`,
      headers: { cookie: outsider.cookie },
    });
    expect(listForbidden.statusCode).toBe(403);

    const list = await app.inject({
      method: 'GET',
      url: `/api/attachments?domain=notes&entity_id=${noteId}`,
      headers: { cookie: owner.cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const deleteForbidden = await app.inject({
      method: 'DELETE',
      url: `/api/attachments/${attachment.id}`,
      headers: { cookie: outsider.cookie },
    });
    expect(deleteForbidden.statusCode).toBe(403);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/attachments/${attachment.id}`,
      headers: { cookie: owner.cookie },
    });
    expect(deleted.statusCode).toBe(204);
  });

  it('DELETE /attachments/:id uses safe path.basename to prevent path traversal', async () => {
    const owner = await register('traversal_user', 'traversal@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Traversal-Trip' },
    });
    const tripId = tripRes.json().id;

    const noteRes = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, title: 'Note', content: 'Note text' },
    });
    const noteId = noteRes.json().id;

    // Manually insert an attachment record with a relative path traversal sequence in filename
    const { db } = await import('../../src/db/index.js');
    const result = db
      .prepare(
        `INSERT INTO attachments (trip_id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        tripId,
        'notes',
        noteId,
        '../secrets.txt',
        'secrets.txt',
        'text/plain',
        10,
        owner.userId,
        new Date().toISOString()
      );
    const attachmentId = result.lastInsertRowid;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/attachments/${attachmentId}`,
      headers: { cookie: owner.cookie },
    });
    expect(deleteRes.statusCode).toBe(204);
  });
});
