import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/index.js';
import { requireAuth } from '../auth.js';
import {
  createGithubIssue,
  getGithubRepo,
  uploadFeedbackScreenshot,
} from '../utils/githubIssue.js';
import { checkFeedbackRateLimit } from '../utils/feedbackRateLimiter.js';
import { readBuildInfo } from './buildInfo.js';

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
  email?: string;
  version?: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 200;
const ALLOWED_SCREENSHOT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;
const DEFAULT_RELAY_URL = 'https://reise.ruebenherz.de/api/feedback/relay';

function getRelayUrl(): string | null {
  if (process.env.FEEDBACK_RELAY_FORWARDING === 'false') {
    return null;
  }
  const configured = process.env.FEEDBACK_RELAY_URL;
  if (configured !== undefined) {
    return configured.trim() || null;
  }
  return DEFAULT_RELAY_URL;
}

interface ProcessScreenshotResult {
  imageUrl: string | null;
  screenshotError: string | null;
  errorStatus?: number;
  errorMessage?: string;
}

async function processAndUploadScreenshot(screenshot: string): Promise<ProcessScreenshotResult> {
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(screenshot);
  if (!match)
    return {
      imageUrl: null,
      screenshotError: null,
      errorStatus: 400,
      errorMessage: 'Ungültiges Bildformat',
    };
  const [, mimeType, base64] = match;
  const extension = ALLOWED_SCREENSHOT_TYPES[mimeType];
  if (!extension)
    return {
      imageUrl: null,
      screenshotError: null,
      errorStatus: 400,
      errorMessage: 'Nicht unterstützter Bildtyp',
    };

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > MAX_SCREENSHOT_BYTES) {
    return {
      imageUrl: null,
      screenshotError: null,
      errorStatus: 413,
      errorMessage: 'Screenshot ist zu groß (max. 8 MB)',
    };
  }

  const uploadResult = await uploadFeedbackScreenshot(
    buffer,
    extension,
    `${randomUUID()}.${extension}`
  );
  if (uploadResult.ok) {
    return { imageUrl: uploadResult.url, screenshotError: null };
  } else {
    return { imageUrl: null, screenshotError: uploadResult.error };
  }
}

export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  // Öffentlicher Relay-Endpunkt für Self-Hosted-Instanzen (#526)
  app.post<{ Body: FeedbackBody }>('/feedback/relay', async (req, reply) => {
    if (process.env.FEEDBACK_RELAY_ENABLED !== 'true') {
      return reply
        .code(404)
        .send({ error: 'Feedback-Relay ist auf dieser Instanz nicht aktiviert' });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkFeedbackRateLimit(clientIp);
    if (!rateLimit.allowed) {
      if (rateLimit.retryAfterSeconds) {
        reply.header('Retry-After', String(rateLimit.retryAfterSeconds));
      }
      return reply.code(429).send({
        error:
          'Zu viele Feedback-Meldungen von dieser IP-Adresse. Bitte versuche es später erneut.',
      });
    }

    const { type, title, description, screenshot, email, version } = req.body ?? {};
    if (type !== 'bug' && type !== 'feature') {
      return reply.code(400).send({ error: 'Ungültiger Meldungstyp' });
    }
    if (!title?.trim() || !description?.trim()) {
      return reply.code(400).send({ error: 'Titel und Beschreibung erforderlich' });
    }
    if (title.length > MAX_TITLE_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
      return reply.code(400).send({ error: 'Titel oder Beschreibung ist zu lang' });
    }
    if (email && (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH)) {
      return reply.code(400).send({ error: 'Ungültige E-Mail-Adresse' });
    }
    if (version && (typeof version !== 'string' || version.length > 50)) {
      return reply.code(400).send({ error: 'Ungültige Versionsangabe' });
    }

    let imageUrl: string | null = null;
    let screenshotError: string | null = null;
    if (screenshot) {
      const uploadRes = await processAndUploadScreenshot(screenshot);
      if (uploadRes.errorStatus) {
        return reply.code(uploadRes.errorStatus).send({ error: uploadRes.errorMessage });
      }
      imageUrl = uploadRes.imageUrl;
      screenshotError = uploadRes.screenshotError;
    }

    const metaParts = [
      'Instanz: Externe Community-Instanz',
      version?.trim() ? `Version: \`${version.trim()}\`` : null,
      email?.trim() ? `Kontakt: ${email.trim()}` : null,
    ].filter(Boolean);

    const bodyParts = [
      description.trim(),
      imageUrl ? `\n![Screenshot](${imageUrl})` : '',
      screenshotError ? `\n_Screenshot konnte nicht angehängt werden: ${screenshotError}_` : '',
      '\n---',
      `Eingereicht über eine externe Reisotor-Community-Instanz via Feedback-Relay.\n${metaParts.join(' | ')}`,
    ];

    const labels = [
      'community-instance',
      'needs-triage',
      type === 'bug' ? 'bug' : 'enhancement',
      'from-app',
    ];

    const result = await createGithubIssue({
      title: title.trim(),
      body: bodyParts.filter(Boolean).join('\n'),
      labels,
    });

    if (!result.ok) {
      req.log.error({ err: result.error }, 'Relay feedback issue creation failed');
      return reply.code(result.status ?? 502).send({ error: result.error });
    }

    reply.code(201);
    return { issue_number: result.number, issue_url: result.url };
  });

  // Regulärer In-App-Endpunkt (nur für eingeloggte Nutzer dieser Instanz)
  app.post<{ Body: FeedbackBody }>(
    '/feedback',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const { type, title, description, screenshot, email } = req.body ?? {};
      if (type !== 'bug' && type !== 'feature') {
        return reply.code(400).send({ error: 'Ungültiger Meldungstyp' });
      }
      if (!title?.trim() || !description?.trim()) {
        return reply.code(400).send({ error: 'Titel und Beschreibung erforderlich' });
      }
      if (title.length > MAX_TITLE_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
        return reply.code(400).send({ error: 'Titel oder Beschreibung ist zu lang' });
      }
      if (email && (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH)) {
        return reply.code(400).send({ error: 'Ungültige E-Mail-Adresse' });
      }

      const reporter = db
        .prepare('SELECT username, email FROM users WHERE id = ?')
        .get(req.session.userId) as { username: string; email: string | null } | undefined;

      // Wenn kein lokales GITHUB_TOKEN konfiguriert ist, transparent an den Relay weiterleiten (#526)
      if (!process.env.GITHUB_TOKEN) {
        const relayUrl = getRelayUrl();
        if (!relayUrl) {
          return reply.code(503).send({
            error: `Auf diesem Server ist kein GitHub-Zugang (GITHUB_TOKEN) und kein Feedback-Relay eingerichtet. Bei selbstgehosteten Instanzen können Fehler und Feedback direkt auf GitHub gemeldet werden: https://github.com/${getGithubRepo()}/issues`,
          });
        }

        const buildInfo = readBuildInfo();
        const appVersion = buildInfo.version ?? undefined;
        const contactEmail = email?.trim() || reporter?.email || undefined;

        try {
          const relayRes = await fetch(relayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type,
              title: title.trim(),
              description: description.trim(),
              screenshot: screenshot ?? undefined,
              email: contactEmail,
              version: appVersion,
            }),
            signal: AbortSignal.timeout(20_000),
          });

          const data = (await relayRes.json()) as {
            error?: string;
            issue_number?: number;
            issue_url?: string;
          };
          if (!relayRes.ok) {
            const errorMsg = data?.error || `Relay antwortete mit Status ${relayRes.status}`;
            return reply
              .code(relayRes.status >= 400 && relayRes.status < 500 ? relayRes.status : 502)
              .send({
                error: errorMsg,
              });
          }

          reply.code(201);
          return { issue_number: data.issue_number, issue_url: data.issue_url };
        } catch (err) {
          req.log.error({ err }, 'Forwarding to feedback relay failed');
          return reply.code(502).send({
            error:
              'Meldung konnte nicht an den Feedback-Relay übermittelt werden (Verbindungsfehler). Bitte später erneut versuchen.',
          });
        }
      }

      // Lokaler Modus: Direkte GitHub-Issue-Erstellung mit eigenem Token
      let imageUrl: string | null = null;
      let screenshotError: string | null = null;
      if (screenshot) {
        const uploadRes = await processAndUploadScreenshot(screenshot);
        if (uploadRes.errorStatus) {
          return reply.code(uploadRes.errorStatus).send({ error: uploadRes.errorMessage });
        }
        imageUrl = uploadRes.imageUrl;
        screenshotError = uploadRes.screenshotError;
      }

      const contactEmail = email?.trim() || reporter?.email;
      const bodyParts = [
        description.trim(),
        imageUrl ? `\n![Screenshot](${imageUrl})` : '',
        screenshotError ? `\n_Screenshot konnte nicht angehängt werden: ${screenshotError}_` : '',
        '\n---',
        `Gemeldet von **${reporter?.username ?? 'unbekannt'}**${contactEmail ? ` (${contactEmail})` : ''} über das In-App-Feedback-Formular.`,
      ];

      const labels = [type === 'bug' ? 'bug' : 'enhancement', 'from-app'];

      const result = await createGithubIssue({
        title: title.trim(),
        body: bodyParts.filter(Boolean).join('\n'),
        labels,
      });

      if (!result.ok) {
        req.log.error({ err: result.error }, 'Feedback issue creation failed');
        return reply.code(result.status ?? 502).send({ error: result.error });
      }

      reply.code(201);
      return { issue_number: result.number, issue_url: result.url };
    }
  );
};
