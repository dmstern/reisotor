import type { FastifyPluginAsync } from 'fastify';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface BuildInfo {
  version: string | null;
  ref: string | null;
  builtAt: string | null;
}

/** Von scripts/generate-build-info.mjs beim Build (npm run build / dev) geschrieben, siehe
 *  package.json — relativ zu process.cwd() statt import.meta.url, da dist/ nicht Teil des
 *  TypeScript-Kompiliervorgangs selbst ist (rootDir ist src/, siehe tsconfig.json). */
function readBuildInfo(): BuildInfo {
  try {
    const raw = readFileSync(path.join(process.cwd(), 'dist', 'build-info.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    return { version: pkg.version ?? null, ref: null, builtAt: null };
  }
}

export const buildInfoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/build-info', async () => readBuildInfo());
};
