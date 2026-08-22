import { readFileSync } from 'node:fs';
import path from 'node:path';
/** Von scripts/generate-build-info.mjs beim Build (npm run build / dev) geschrieben, siehe
 *  package.json — relativ zu process.cwd() statt import.meta.url, da dist/ nicht Teil des
 *  TypeScript-Kompiliervorgangs selbst ist (rootDir ist src/, siehe tsconfig.json). */
function readBuildInfo() {
    try {
        const raw = readFileSync(path.join(process.cwd(), 'dist', 'build-info.json'), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        // Root-package.json ist die einzige Versionsquelle (siehe generate-build-info.mjs), process.cwd()
        // ist backend/ - daher eine Ebene hoch.
        const pkg = JSON.parse(readFileSync(path.join(process.cwd(), '..', 'package.json'), 'utf-8'));
        return { version: pkg.version ?? null, ref: null, builtAt: null, changelog: null };
    }
}
export const buildInfoRoutes = async (app) => {
    app.get('/build-info', async () => ({
        ...readBuildInfo(),
        // Gleiches GITHUB_REPO-Env-Var-Muster wie in utils/githubIssue.ts (Feedback-Formular).
        repoUrl: `https://github.com/${process.env.GITHUB_REPO ?? 'dmstern/reisotor'}`,
        // Konfigurierbar, damit andere Betreiber:innen (eigenes Hosting statt Berlin) den Über-Tab-
        // Hinweis anpassen können, siehe Issue #171.
        hostingLocation: process.env.HOSTING_LOCATION ?? 'Berlin',
        // Pro Instanz (Prod/Staging) im systemd-Service gesetzt - das Frontend wird für beide identisch
        // gebaut (siehe .github/workflows/build-deploy.yml), kann die Umgebung also nicht aus einem
        // Build-Time-Env-Var erkennen und fragt sie stattdessen hier zur Laufzeit ab, siehe Issue #219.
        environment: process.env.APP_ENV ?? 'production',
    }));
};
