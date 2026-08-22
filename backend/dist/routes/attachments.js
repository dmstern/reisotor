import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/index.js';
import { uploadsDir } from '../uploads.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { isUserRestricted } from '../registrationConfig.js';
// Mappt jede Domäne auf ihre Tabelle – daraus wird trip_id server-seitig nachgeschlagen (nie vom
// Client vertraut), das verhindert Spoofing/Cross-Trip-Zugriff über eine falsche trip_id im Body.
// 'spots' deckt seit der Verschmelzung von Unterkunft in Spots (siehe Migrationskommentar in
// db/index.ts) auch Unterkunft-Anhänge (Tickets/Buchungsbestätigungen) ab – jeder Spot kann jetzt
// Datei-Anhänge tragen, nicht mehr nur die vormals eigene Unterkunft-Tabelle. 'ideas' deckt seit
// #176 (Ablösung von travel_items) auch die ehemaligen Reise-Etappen-Anhänge (Tickets/Buchungs-
// bestätigungen) ab - eine Tour mit gesetztem role trägt jetzt dieselben Anhänge wie zuvor der
// travel_items-Eintrag (siehe Migrationsblock in db/index.ts, der bestehende domain='travel'-Zeilen
// einmalig auf domain='ideas' + die neue Tour-Id umhängt).
const DOMAIN_TABLE = {
    ideas: 'ideas',
    spots: 'spots',
    notes: 'notes',
    schedule: 'schedule_items',
    budget: 'budget_items',
};
function isAttachmentDomain(domain) {
    return domain in DOMAIN_TABLE;
}
function serialize(row) {
    return { ...row, url: `/api/uploads/${row.filename}` };
}
/** Löst domain+entity_id zur trip_id des referenzierten Objekts auf (404, falls das Objekt nicht
 *  existiert) – entity_id ist polymorph (siehe attachments-Tabelle, analog trip_activity), es gibt
 *  daher keinen SQL-FK, der das automatisch prüfen würde. */
function tripIdForEntity(domain, entityId) {
    const row = db.prepare(`SELECT trip_id FROM ${DOMAIN_TABLE[domain]} WHERE id = ?`).get(entityId);
    return row?.trip_id ?? null;
}
// Erweitert gegenüber routes/diary.ts's /diary/images um application/pdf (Tickets/Dokumente sind
// oft PDFs, nicht nur Fotos) – bewusst weiterhin kein serverseitiges Resizing/Verarbeiten (siehe
// dortiger Kommentar zum ressourcenschwachen Raspberry Pi 2 Host).
const ALLOWED_MIME_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
};
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const attachmentsRoutes = async (app) => {
    app.get('/attachments', async (req, reply) => {
        const { domain, entity_id } = req.query;
        if (!domain || !entity_id || !isAttachmentDomain(domain)) {
            return reply.code(400).send({ error: 'domain und entity_id erforderlich' });
        }
        const tripId = tripIdForEntity(domain, Number(entity_id));
        if (tripId == null)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, tripId, req.session.userId))
            return;
        return db
            .prepare('SELECT * FROM attachments WHERE domain = ? AND entity_id = ? ORDER BY created_at ASC')
            .all(domain, Number(entity_id))
            .map((row) => serialize(row));
    });
    app.post('/attachments', async (req, reply) => {
        const { domain, entity_id, filename } = req.body ?? {};
        if (!domain || !entity_id || !isAttachmentDomain(domain)) {
            return reply.code(400).send({ error: 'domain und entity_id erforderlich' });
        }
        const tripId = tripIdForEntity(domain, entity_id);
        if (tripId == null)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, tripId, req.session.userId))
            return;
        if (isUserRestricted(req.session.userId)) {
            return reply.code(403).send({ error: 'Eingeschränkter Modus - Kein Datei-Upload möglich' });
        }
        const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(req.body?.data ?? '');
        if (!match)
            return reply.code(400).send({ error: 'Ungültiges Dateiformat' });
        const [, mimeType, base64] = match;
        const extension = ALLOWED_MIME_TYPES[mimeType];
        if (!extension)
            return reply.code(400).send({ error: 'Nicht unterstützter Dateityp' });
        const buffer = Buffer.from(base64, 'base64');
        if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
            return reply.code(413).send({ error: 'Datei ist zu groß (max. 15 MB)' });
        }
        const storedFilename = `${randomUUID()}.${extension}`;
        await writeFile(path.join(uploadsDir, storedFilename), buffer);
        const result = db
            .prepare(`INSERT INTO attachments (trip_id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(tripId, domain, entity_id, storedFilename, filename || storedFilename, mimeType, buffer.byteLength, req.session.userId, new Date().toISOString());
        recordActivity(tripId, domain, entity_id, 'attachment_added', req.session.userId);
        reply.code(201);
        const row = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
        return serialize(row);
    });
    app.delete('/attachments/:id', async (req, reply) => {
        const existing = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
        if (!existing)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existing.trip_id, req.session.userId))
            return;
        db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
        await unlink(path.join(uploadsDir, existing.filename)).catch(() => { });
        recordActivity(existing.trip_id, existing.domain, existing.entity_id, 'attachment_removed', req.session.userId);
        return reply.code(204).send();
    });
};
