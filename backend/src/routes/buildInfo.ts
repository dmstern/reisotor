import type { FastifyPluginAsync } from 'fastify';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

interface BuildInfo {
  version: string | null;
  ref: string | null;
  builtAt: string | null;
  changelog: ChangelogEntry | null;
}

/** Von scripts/generate-build-info.mjs beim Build (npm run build / dev) geschrieben, siehe
 *  package.json — relativ zu process.cwd() statt import.meta.url, da dist/ nicht Teil des
 *  TypeScript-Kompiliervorgangs selbst ist (rootDir ist src/, siehe tsconfig.json). */
function readBuildInfo(): BuildInfo {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'dist', 'build-info.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Root-package.json ist die einzige Versionsquelle (siehe generate-build-info.mjs), process.cwd()
    // ist backend/ - daher eine Ebene hoch.
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), '..', 'package.json'), 'utf-8'));
    const env =
      process.env.APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development');
    const versionSuffix = env === 'staging' ? '-staging' : env === 'production' ? '' : '-dev';
    const fallbackVersion = pkg.version ? `${pkg.version}${versionSuffix}` : null;
    return { version: fallbackVersion, ref: null, builtAt: null, changelog: null };
  }
}

export const buildInfoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/build-info', async () => ({
    ...readBuildInfo(),
    // Gleiches GITHUB_REPO-Env-Var-Muster wie in utils/githubIssue.ts (Feedback-Formular).
    repoUrl: `https://github.com/${process.env.GITHUB_REPO ?? 'dmstern/reisotor'}`,
    // Konfigurierbar, damit andere Betreiber:innen (eigenes Hosting statt Berlin) den Über-Tab-
    // Hinweis anpassen können, siehe Issue #171.
    hostingLocation: process.env.HOSTING_LOCATION ?? 'Berlin',
    // Pro Instanz (Prod/Staging) im systemd-Service gesetzt - das Frontend wird für beide identisch
    // gebaut (siehe .github/workflows/ci.yml), kann die Umgebung also nicht aus einem
    // Build-Time-Env-Var erkennen und fragt sie stattdessen hier zur Laufzeit ab, siehe Issue #219.
    environment:
      process.env.APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  }));
};
