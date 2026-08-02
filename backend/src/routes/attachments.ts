import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/index.js';
import { uploadsDir } from '../uploads.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

export type AttachmentDomain = 'travel' | 'accommodation' | 'notes' | 'schedule' | 'budget';

// Mappt jede Domäne auf ihre Tabelle – daraus wird trip_id server-seitig nachgeschlagen (nie vom
// Client vertraut), das verhindert Spoofing/Cross-Trip-Zugriff über eine falsche trip_id im Body.
const DOMAIN_TABLE: Record<AttachmentDomain, string> = {
  travel: 'travel_items',
  accommodation: 'accommodation',
  notes: 'notes',
  schedule: 'schedule_items',
  budget: 'budget_items',
};

function isAttachmentDomain(domain: string): domain is AttachmentDomain {
  return domain in DOMAIN_TABLE;
}

interface AttachmentRow {
  id: number;
  trip_id: number;
  domain: string;
  entity_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  created_at: string;
}

function serialize(row: AttachmentRow) {
  return { ...row, url: `/api/uploads/${row.filename}` };
}

/** Löst domain+entity_id zur trip_id des referenzierten Objekts auf (404, falls das Objekt nicht
 *  existiert) – entity_id ist polymorph (siehe attachments-Tabelle, analog trip_activity), es gibt
 *  daher keinen SQL-FK, der das automatisch prüfen würde. */
function tripIdForEntity(domain: AttachmentDomain, entityId: number): number | null {
  const row = db.prepare(`SELECT trip_id FROM ${DOMAIN_TABLE[domain]} WHERE id = ?`).get(entityId) as
    | { trip_id: number }
    | undefined;
  return row?.trip_id ?? null;
}

interface UploadBody {
  domain: string;
  entity_id: number;
  data: string;
  filename: string;
}

// Erweitert gegenüber routes/diary.ts's /diary/images um application/pdf (Tickets/Dokumente sind
// oft PDFs, nicht nur Fotos) – bewusst weiterhin kein serverseitiges Resizing/Verarbeiten (siehe
// dortiger Kommentar zum ressourcenschwachen Raspberry Pi 2 Host).
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const attachmentsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { domain?: string; entity_id?: string } }>('/attachments', async (req, reply) => {
    const { domain, entity_id } = req.query;
    if (!domain || !entity_id || !isAttachmentDomain(domain)) {
      return reply.code(400).send({ error: 'domain und entity_id erforderlich' });
    }
    const tripId = tripIdForEntity(domain, Number(entity_id));
    if (tripId == null) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    return db
      .prepare('SELECT * FROM attachments WHERE domain = ? AND entity_id = ? ORDER BY created_at ASC')
      .all(domain, Number(entity_id))
      .map((row) => serialize(row as AttachmentRow));
  });

  app.post<{ Body: UploadBody }>('/attachments', async (req, reply) => {
    const { domain, entity_id, filename } = req.body ?? {};
    if (!domain || !entity_id || !isAttachmentDomain(domain)) {
      return reply.code(400).send({ error: 'domain und entity_id erforderlich' });
    }
    const tripId = tripIdForEntity(domain, entity_id);
    if (tripId == null) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(req.body?.data ?? '');
    if (!match) return reply.code(400).send({ error: 'Ungültiges Dateiformat' });

    const [, mimeType, base64] = match;
    const extension = ALLOWED_MIME_TYPES[mimeType];
    if (!extension) return reply.code(400).send({ error: 'Nicht unterstützter Dateityp' });

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      return reply.code(413).send({ error: 'Datei ist zu groß (max. 15 MB)' });
    }

    const storedFilename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadsDir, storedFilename), buffer);

    const result = db
      .prepare(
        `INSERT INTO attachments (trip_id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tripId,
        domain,
        entity_id,
        storedFilename,
        filename || storedFilename,
        mimeType,
        buffer.byteLength,
        req.session.userId,
        new Date().toISOString(),
      );
    recordActivity(tripId, domain, entity_id, 'attachment_added', req.session.userId!);
    reply.code(201);
    const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid) as AttachmentRow;
    return serialize(row);
  });

  app.delete<{ Params: { id: string } }>('/attachments/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id) as
      | AttachmentRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existing.trip_id, req.session.userId)) return;

    db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
    await unlink(path.join(uploadsDir, existing.filename)).catch(() => {});
    recordActivity(existing.trip_id, existing.domain, existing.entity_id, 'attachment_removed', req.session.userId!);
    return reply.code(204).send();
  });
};
