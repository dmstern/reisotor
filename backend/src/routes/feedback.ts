import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { createGithubIssue, uploadFeedbackScreenshot } from '../utils/githubIssue.js';

// Bewusst NICHT trip-gebunden (wie routes/users.ts) – ein Bug/eine Idee betrifft die App als
// Ganzes, nicht einen einzelnen Urlaub. Nutzt deshalb weder requireTripMember noch das bestehende,
// an trip_id gebundene attachments-System (siehe routes/attachments.ts); ein Screenshot wird
// stattdessen direkt per GitHub Contents API in den feedback-screenshots-Branch committet (siehe
// utils/githubIssue.ts) und als raw.githubusercontent.com-Bild-Link in den Issue-Body eingebettet -
// nicht auf diesem Server abgelegt, damit die Sichtbarkeit im Issue nicht von der externen
// Erreichbarkeit dieses Servers zum (von GitHub selbst bestimmten) Abrufzeitpunkt abhängt (#111).

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
    let screenshotError: string | null = null;
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

      const uploadResult = await uploadFeedbackScreenshot(buffer, extension, `${randomUUID()}.${extension}`);
      // Ein fehlgeschlagener Screenshot-Upload soll die Meldung selbst nicht verhindern - die
      // Beschreibung allein ist immer noch nützlich. Stattdessen landet ein Hinweis im Issue-Body.
      if (uploadResult.ok) {
        imageUrl = uploadResult.url;
      } else {
        screenshotError = uploadResult.error;
      }
    }

    const reporter = db
      .prepare('SELECT username, email FROM users WHERE id = ?')
      .get(req.session.userId) as { username: string; email: string | null } | undefined;

    const bodyParts = [
      description.trim(),
      imageUrl ? `\n![Screenshot](${imageUrl})` : '',
      screenshotError ? `\n_Screenshot konnte nicht angehängt werden: ${screenshotError}_` : '',
      '\n---',
      `Gemeldet von **${reporter?.username ?? 'unbekannt'}**${reporter?.email ? ` (${reporter.email})` : ''} über das In-App-Feedback-Formular.`,
    ];

    const labels = [type === 'bug' ? 'bug' : 'enhancement', 'from-app'];

    const result = await createGithubIssue({
      title: title.trim(),
      body: bodyParts.filter(Boolean).join('\n'),
      labels,
    });

    if (!result.ok) {
      return reply.code(502).send({ error: result.error });
    }

    reply.code(201);
    return { issue_number: result.number, issue_url: result.url };
  });
};
