import type { FastifyPluginAsync } from 'fastify';
import path from 'node:path';
import fs from 'node:fs';
import { uploadsDir } from '../uploads.js';
import { getUploads } from '../uploadRegistry.js';
import { isTripMember } from '../tripAccess.js';

export const uploadsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { filename: string } }>('/uploads/:filename', async (req, reply) => {
    const rawFilename = req.params.filename;
    // Defensiver Path-Traversal-Schutz: Dateiname darf keine Verzeichnistrenner oder führende Punkte enthalten
    const filename = path.basename(rawFilename);
    if (!filename || filename !== rawFilename || filename.startsWith('.')) {
      return reply.code(400).send({ error: 'Ungültiger Dateiname' });
    }

    const userId = req.session.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Nicht eingeloggt' });
    }

    const records = getUploads(filename);
    if (records.length === 0) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }

    const hasAccess = records.some((r) => {
      if (r.trip_id != null) {
        return isTripMember(r.trip_id, userId);
      }
      return r.uploaded_by != null && r.uploaded_by === userId;
    });

    if (!hasAccess) {
      return reply.code(403).send({ error: 'Kein Zugriff auf diesen Urlaub' });
    }

    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }

    reply.header('Cache-Control', 'private, max-age=3600');
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.sendFile(filename, uploadsDir);
  });
};
