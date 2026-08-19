import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
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

  test('"Neu laden"-Button aktiviert die neue Version tatsächlich statt nichts zu tun', async ({ browser }) => {
    // Regressionstest für einen vom Nutzer gemeldeten Bug: der Button rief vite-plugin-pwa's
    // updateSW(true) auf, das per workbox-window eine {type:'SKIP_WAITING'}-Nachricht an den
    // wartenden Service Worker schickt - public/sw.js (injectManifest-Strategie, siehe
    // vite.config.ts) hatte dafür aber KEINEN message-Listener (den fügt nur die generateSW-
    // Strategie automatisch ein). self.skipWaiting() wurde nie aufgerufen, der neue Worker nie
    // aktiv, kein automatischer Reload (workbox-window's "controlling"-Event) - der Klick tat
    // buchstäblich nichts. Fix: eigener message-Listener in public/sw.js.
    test.setTimeout(60_000);
    const appVuePath = path.join(frontendDir, 'src', 'App.vue');
    const originalAppVue = fs.readFileSync(appVuePath, 'utf-8');

    const context = await browser.newContext({ storageState: authFile });
    const page = await context.newPage();
    try {
      await page.goto(previewUrl + '/');
      await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
      await expect(page.locator('.trip-name')).toBeVisible();

      // Simuliert ein neues Deployment: jede Quelländerung verschiebt mindestens einen Datei-Hash
      // und damit den in sw.js selbst eingebetteten Precache-Manifest-Array - sw.js' eigene Bytes
      // ändern sich dadurch garantiert, was der Browser bei der nächsten Navigation erkennt.
      fs.writeFileSync(appVuePath, `${originalAppVue}\n<!-- e2e-update-test -->\n`);
      execSync('npm run build', { cwd: frontendDir, stdio: 'pipe' });

      // Normale Navigation (kein page.goto auf eine neue URL, echtes Reload) - der Browser prüft
      // dabei von sich aus auf eine neue Service-Worker-Version, unabhängig von unserem eigenen
      // Popping in PwaUpdatePrompt.vue.
      // Timeout bewusst großzügig (30s statt der Playwright-Default-5s): der execSync('npm run
      // build') direkt davor konkurriert auf einem gemeinsam genutzten CI-Runner um CPU/IO mit
      // dem Playwright-Browser-Prozess, wodurch die Service-Worker-Update-Erkennung nach dem
      // reload() spürbar länger dauern kann als lokal.
      await page.reload();
      await expect(page.locator('.pwa-pill.update')).toBeVisible({ timeout: 30_000 });

      // Der eigentliche Kern des Bugs: ohne den sw.js-Fix passiert nach diesem Klick nichts, das
      // Warten auf ein 'load'-Event würde in einen Timeout laufen.
      await Promise.all([page.waitForEvent('load', { timeout: 10_000 }), page.locator('.pwa-pill-btn').click()]);

      await expect(page.locator('.trip-name')).toBeVisible();
      await expect(page.locator('.pwa-pill.update')).toHaveCount(0);
    } finally {
      fs.writeFileSync(appVuePath, originalAppVue);
      await context.close();
    }
  });
});
