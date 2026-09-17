import type { FastifyPluginAsync } from 'fastify';
import { ZipArchive } from 'archiver';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { unlink } from 'node:fs/promises';
import { createWriteStream, createReadStream } from 'node:fs';
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

    const runId = randomUUID();
    const tempDbPath = path.join(os.tmpdir(), `reisotor-db-${runId}.sqlite`);
    const tempZipPath = path.join(os.tmpdir(), `reisotor-backup-${runId}.zip`);

    try {
      // Sicheres Snapshot-Backup der laufenden SQLite-Datenbank erstellen
      await db.backup(tempDbPath);

      await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(tempZipPath);
        const archive = new ZipArchive({ zlib: { level: 9 } });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);
        archive.file(tempDbPath, { name: 'data.sqlite' });
        archive.directory(uploadsDir, 'uploads');
        archive.finalize();
      });

      const filename = `reisotor-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      // Cleanup
      reply.raw.on('close', () => {
        unlink(tempDbPath).catch(() => {});
        unlink(tempZipPath).catch(() => {});
      });

      return reply.send(createReadStream(tempZipPath));
    } catch (err) {
      req.log.error(err);
      await unlink(tempDbPath).catch(() => {});
      await unlink(tempZipPath).catch(() => {});
      return reply.code(500).send({ error: 'Fehler beim Erstellen des Backups.' });
    }
  });
};
