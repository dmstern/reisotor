import type { FastifyPluginAsync } from 'fastify';
// @ts-ignore
import archiver from 'archiver';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { unlink } from 'node:fs/promises';
import { db } from '../db/index.js';
import { uploadsDir } from '../uploads.js';
import { isUserAdmin } from '../registrationConfig.js';

export const backupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/backup/export', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply
        .code(403)
        .send({ error: 'Nur Administrator:innen dürfen Datensicherungen durchführen.' });
    }

    const tempDbPath = path.join(os.tmpdir(), `reisotor-db-${randomUUID()}.sqlite`);

    try {
      // Sicheres Snapshot-Backup der laufenden SQLite-Datenbank erstellen
      await db.backup(tempDbPath);

      const filename = `reisotor-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      // Cleanup wenn der Stream fertig ist
      archive.on('end', () => {
        unlink(tempDbPath).catch(() => {});
      });
      archive.on('error', (err: Error) => {
        req.log.error(err);
        unlink(tempDbPath).catch(() => {});
      });

      // 1. Die Datenbank-Datei hinzufügen
      archive.file(tempDbPath, { name: 'data.sqlite' });

      // 2. Den gesamten Uploads-Ordner hinzufügen
      archive.directory(uploadsDir, 'uploads');

      archive.finalize();

      return reply.send(archive);
    } catch (err) {
      req.log.error(err);
      await unlink(tempDbPath).catch(() => {});
      return reply.code(500).send({ error: 'Fehler beim Erstellen des Backups.' });
    }
  });
};
