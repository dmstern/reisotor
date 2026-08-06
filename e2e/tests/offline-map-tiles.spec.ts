import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_BACKEND_PORT, E2E_PWA_PREVIEW_PORT } from '../constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const authFile = path.join(__dirname, '..', '.auth', 'user.json');
const previewUrl = `http://localhost:${E2E_PWA_PREVIEW_PORT}`;

// Braucht wie offline-app-shell.spec.ts einen echten Produktions-Build + `vite preview` statt des
// geteilten Dev-Servers - devOptions.enabled ist in vite.config.ts's VitePWA-Konfiguration bewusst
// false, der Service Worker (und damit die hier getestete Kartenkacheln-Route) existiert im
// Dev-Server also gar nicht.
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

test.describe.serial('Offline-Kartenkacheln (Workbox Runtime Caching)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);

    execSync('npm run build', { cwd: frontendDir, stdio: 'pipe' });

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

  // 1x1-transparentes PNG als Fake-Kachel-Antwort statt echter Requests gegen tile.openstreetmap.org:
  // OSMs Tile Usage Policy untersagt automatisierten/gehäuften Zugriff wie aus einer CI-Testsuite
  // (https://operations.osmfoundation.org/policies/tiles/), ein e2e-Test gegen den echten Server
  // wäre also unabhängig von jeder Sandbox-Netzwerkbeschränkung die falsche Wahl. Die Route wird auf
  // Context-Ebene registriert (nicht page.route), da die Kachel-Requests vom Service Worker
  // ausgehen, nicht direkt von der Seite.
  const FAKE_TILE_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  test('bereits angesehene Kartenkacheln bleiben nach einem Offline-Reload sichtbar', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authFile });
    await context.route('https://*.tile.openstreetmap.org/**/*.png', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_TILE_PNG }),
    );
    const page = await context.newPage();

    // Erstbesuch: der Service Worker installiert/aktiviert sich hier, "kontrolliert" das GERADE
    // GELADENE Dokument aber noch nicht (Standard-SW-Lifecycle, kein self.clients.claim() in sw.js -
    // bewusst so gelassen, siehe dortiger Kommentar zum "Neu laden"-Update-Flow). Kachel-Requests
    // dieses allerersten Ladens laufen daher NICHT durch die CacheFirst-Route und würden nie gecacht.
    // Ein zusätzlicher Reload weiter unten sorgt für ein Laden unter einem bereits aktiven,
    // kontrollierenden Service Worker - erst dabei greift das Caching. Betrifft nur diesen
    // Test-Aufbau, nicht Nutzer:innen: ein reales zweites Öffnen der App (nächster Tab, App-Neustart)
    // ist immer schon SW-kontrolliert.
    const tiles = page.locator('.leaflet-tile-pane img.leaflet-tile-loaded');

    await page.goto(previewUrl + '/excursions');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await expect(async () => {
      expect(await tiles.count()).toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });
    const tileCountOnline = await tiles.count();

    // Route-Mock entfernen und stattdessen JEDE Kachel-Anfrage hart blocken: zeigt zuverlässig, ob
    // die Kachel wirklich aus dem Service-Worker-eigenen "osm-tiles"-Cache (CacheFirst-Strategie in
    // sw.js) kommt, statt versehentlich erneut über die (bei diesem Test ohnehin gemockte) Route zu
    // laufen. setOffline(true) allein würde auch reine Browser-Cache-Treffer verdecken.
    await context.unroute('https://*.tile.openstreetmap.org/**/*.png');
    await context.route('https://*.tile.openstreetmap.org/**/*.png', (route) => route.abort());
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));

    // Dieselben Kacheln (gleicher Kartenausschnitt/Zoom) wurden bereits online geladen und liegen
    // dank der CacheFirst-Route in sw.js im "osm-tiles"-Cache - sie müssen trotz geblockter
    // Netzwerk-Route genauso sichtbar werden wie beim ersten, echten Laden statt leerer/grauer
    // Flächen zu bleiben.
    await expect(async () => {
      expect(await tiles.count()).toBeGreaterThanOrEqual(tileCountOnline);
    }).toPass({ timeout: 15_000 });

    await context.close();
  });
});
