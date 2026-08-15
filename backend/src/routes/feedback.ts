import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/index.js';
import { uploadsDir } from '../uploads.js';
import { createGithubIssue } from '../utils/githubIssue.js';

// Bewusst NICHT trip-gebunden (wie routes/users.ts) – ein Bug/eine Idee betrifft die App als
// Ganzes, nicht einen einzelnen Urlaub. Nutzt deshalb weder requireTripMember noch das bestehende,
// an trip_id gebundene attachments-System (siehe routes/attachments.ts); ein Screenshot wird
// stattdessen direkt hier hochgeladen und als Bild-Link in den GitHub-Issue-Body eingebettet.

interface FeedbackBody {
  type: 'bug' | 'feature';
  title: string;
  description: string;
  screenshot?: string; // data:<mime>;base64,<...>
}

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const ALLOWED_SCREENSHOT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: FeedbackBody }>('/feedback', async (req, reply) => {
    const { type, title, description, screenshot } = req.body ?? {};
    if (type !== 'bug' && type !== 'feature') {
      return reply.code(400).send({ error: 'Ungültiger Meldungstyp' });
    }
    if (!title?.trim() || !description?.trim()) {
      return reply.code(400).send({ error: 'Titel und Beschreibung erforderlich' });
    }
    if (title.length > MAX_TITLE_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
      return reply.code(400).send({ error: 'Titel oder Beschreibung ist zu lang' });
    }

    let imageUrl: string | null = null;
    if (screenshot) {
      const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(screenshot);
      if (!match) return reply.code(400).send({ error: 'Ungültiges Bildformat' });
      const [, mimeType, base64] = match;
      const extension = ALLOWED_SCREENSHOT_TYPES[mimeType];
      if (!extension) return reply.code(400).send({ error: 'Nicht unterstützter Bildtyp' });

      const buffer = Buffer.from(base64, 'base64');
      if (buffer.byteLength > MAX_SCREENSHOT_BYTES) {
        return reply.code(413).send({ error: 'Screenshot ist zu groß (max. 8 MB)' });
      }

      const storedFilename = `${randomUUID()}.${extension}`;
      await writeFile(path.join(uploadsDir, storedFilename), buffer);
      // Absolute URL nötig (nicht nur der Pfad) - GitHub lädt das Bild von außerhalb dieses
      // Servers. req.protocol berücksichtigt dank trustProxy:true (app.ts) den von Caddy gesetzten
      // X-Forwarded-Proto-Header korrekt.
      imageUrl = `${req.protocol}://${req.hostname}/api/uploads/${storedFilename}`;
    }

    const reporter = db
      .prepare('SELECT username, email FROM users WHERE id = ?')
      .get(req.session.userId) as { username: string; email: string | null } | undefined;

    const bodyParts = [
      description.trim(),
      imageUrl ? `\n![Screenshot](${imageUrl})` : '',
      '\n---',
      `Gemeldet von **${reporter?.username ?? 'unbekannt'}**${reporter?.email ? ` (${reporter.email})` : ''} über das In-App-Feedback-Formular.`,
    ];

    const result = await createGithubIssue({
      title: title.trim(),
      body: bodyParts.filter(Boolean).join('\n'),
      labels: [type === 'bug' ? 'bug' : 'enhancement', 'from-app'],
    });

    if (!result.ok) {
      return reply.code(502).send({ error: result.error });
    }

    reply.code(201);
    return { issue_number: result.number, issue_url: result.url };
  });
};
