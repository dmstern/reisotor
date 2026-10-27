import type { FastifyPluginAsync } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getEffectiveSetting } from '../instanceSettings.js';

interface ChangelogGroup {
  title: string;
  notes: string[];
}

interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
  groups?: ChangelogGroup[];
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
export function readBuildInfo(): BuildInfo {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'dist', 'build-info.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Root-package.json ist die einzige Versionsquelle (siehe generate-build-info.mjs)
    let pkg: { version?: string } = {};
    const localPkg = path.join(process.cwd(), 'package.json');
    const parentPkg = path.join(process.cwd(), '..', 'package.json');
    try {
      if (existsSync(localPkg)) {
        pkg = JSON.parse(readFileSync(localPkg, 'utf-8'));
      } else if (existsSync(parentPkg)) {
        pkg = JSON.parse(readFileSync(parentPkg, 'utf-8'));
      }
    } catch {
      pkg = {};
    }
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
    repoUrl: `https://github.com/${getEffectiveSetting('github_repo', 'GITHUB_REPO', 'dmstern/reisotor')}`,
    // Konfigurierbar, damit andere Betreiber:innen (eigenes Hosting statt Berlin) den Über-Tab-
    // Hinweis anpassen können, siehe Issue #171.
    hostingLocation: getEffectiveSetting('hosting_location', 'HOSTING_LOCATION', 'Berlin'),
    // Pro Instanz (Prod/Staging) im systemd-Service gesetzt - das Frontend wird für beide identisch
    // gebaut (siehe .github/workflows/ci.yml), kann die Umgebung also nicht aus einem
    // Build-Time-Env-Var erkennen und fragt sie stattdessen hier zur Laufzeit ab, siehe Issue #219.
    environment:
      process.env.APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  }));
};
