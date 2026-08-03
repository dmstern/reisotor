import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_BACKEND_PORT, E2E_PWA_PREVIEW_PORT } from '../constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const authFile = path.join(__dirname, '..', '.auth', 'user.json');
const previewUrl = `http://localhost:${E2E_PWA_PREVIEW_PORT}`;

// Dieser Test läuft bewusst NICHT gegen den geteilten Dev-Server aus playwright.config.ts (Port
// E2E_FRONTEND_PORT) — devOptions.enabled ist in vite.config.ts's VitePWA-Konfiguration bewusst
// false (Workbox-Precaching gegen den sich ständig ändernden Dev-Bundle wäre nur Verwirrung), die
// Offline-App-Shell ist ein reines Produktions-Build-Feature. Braucht deshalb einen eigenen,
// echten Build + `vite preview` auf einem eigenen Port, parallel zum laufenden Dev-Server.
let previewProcess: ChildProcess | undefined;
let previewOutput = '';

async function waitForPreviewServer(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(previewUrl);
      if (res.ok) return;
    } catch {
      // Server noch nicht bereit - weiter pollen.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `vite preview auf ${previewUrl} nicht innerhalb von 30s erreichbar geworden. Ausgabe:\n${previewOutput}`,
  );
}

test.describe.serial('Offline-App-Shell (Workbox-Precaching)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);

    execSync('npm run build', { cwd: frontendDir, stdio: 'pipe' });

    // API_PROXY_TARGET nutzt vite.config.ts's `preview.proxy` (Gegenstück zu `server.proxy` für den
    // Dev-Server) - der Browser sieht dadurch nur EINEN Origin (den Preview-Port), Anfragen an
    // /api/* laufen server-seitig zum bereits laufenden e2e-Backend durch. Dadurch bleibt die
    // Session-Cookie-Anmeldung aus dem geteilten storageState (auth.setup.ts) same-origin gültig,
    // ganz ohne CORS-Sonderfall für diesen einen Test.
    previewProcess = spawn(
      path.join(frontendDir, 'node_modules', '.bin', 'vite'),
      ['preview', '--port', String(E2E_PWA_PREVIEW_PORT), '--strictPort'],
      {
        cwd: frontendDir,
        env: { ...process.env, API_PROXY_TARGET: `http://127.0.0.1:${E2E_BACKEND_PORT}` },
        stdio: 'pipe',
      },
    );
    previewProcess.stdout?.on('data', (chunk) => (previewOutput += chunk.toString()));
    previewProcess.stderr?.on('data', (chunk) => (previewOutput += chunk.toString()));

    await waitForPreviewServer();
  });

  test.afterAll(() => {
    previewProcess?.kill();
  });

  test('Dashboard rendert nach komplettem Offline-Reload aus dem Service-Worker-Cache', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();

    await page.goto(previewUrl + '/');
    // navigator.serviceWorker.ready löst erst nach abgeschlossener Aktivierung auf - Workbox
    // precacht die App-Shell während der install-Phase (vor activate), ist an dieser Stelle also
    // garantiert bereits fertig.
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await expect(page.locator('.trip-name')).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    // Die App-Shell (HTML/JS/CSS) kommt jetzt aus precacheAndRoute()'s Cache statt vom Netz - das
    // Dashboard muss weiterhin echtes Vue-Markup rendern statt des Browser-eigenen
    // Offline-Fehlers ("Diese Seite ist nicht erreichbar"). Der Trip-Name selbst kommt aus dem
    // bereits bestehenden Daten-Cache (api/offline.ts) - nicht Gegenstand dieses Tests, hier zählt
    // nur, dass die App überhaupt lädt.
    await expect(page.locator('.trip-name')).toBeVisible();

    await context.setOffline(false);
    await context.close();
  });
});
