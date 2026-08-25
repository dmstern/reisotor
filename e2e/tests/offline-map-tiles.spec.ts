import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_BACKEND_PORT, E2E_PWA_PREVIEW_PORT } from '../constants.js';
import { newContextWithReducedMotion } from './helpers/context';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
const authFile = path.join(__dirname, '..', '.auth', 'user.json');
// previewUrl bleibt bei 'localhost' - der storageState aus auth.setup.ts wurde gegen
// http://localhost:5273 erzeugt, das Session-Cookie ist also an die Domain 'localhost' gebunden;
// ein Navigieren zu 127.0.0.1 statt localhost würde diese Cookie-Wiederverwendung stillschweigend
// brechen (andere Origin trotz gleicher Maschine). --host unten zwingt stattdessen den SERVER,
// zusätzlich explizit auf der IPv4-Loopback-Adresse zu lauschen - manche Container-Umgebungen lösen
// 'localhost' clientseitig (unser fetch() hier) zu einer anderen Adressfamilie auf als Vites eigener
// Default, was sonst zu dauerhaftem ECONNREFUSED trotz laufendem Server führt.
const previewHost = '127.0.0.1';
const previewUrl = `http://localhost:${E2E_PWA_PREVIEW_PORT}`;

// Braucht wie offline-app-shell.spec.ts einen echten Produktions-Build + `vite preview` statt des
// geteilten Dev-Servers - devOptions.enabled ist in vite.config.ts's VitePWA-Konfiguration bewusst
// false, der Service Worker (und damit die hier getestete Kartenkacheln-Route) existiert im
// Dev-Server also gar nicht.
let previewProcess: ChildProcess | undefined;
let previewOutput = '';

async function waitForPreviewServer(): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(previewUrl);
      if (res.ok) return;
    } catch (err) {
      // Server noch nicht bereit - weiter pollen, aber den letzten Fehler für eine aussagekräftige
      // Timeout-Meldung merken (z. B. um ECONNREFUSED von einem DNS-/Adressfamilien-Problem
      // unterscheiden zu können, statt nur "nicht erreichbar" zu wissen).
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `vite preview auf ${previewUrl} nicht innerhalb von 30s erreichbar geworden. Letzter Fehler: ${String(lastError)}. Ausgabe:\n${previewOutput}`
  );
}

test.describe.serial('Offline-Kartenkacheln (Workbox Runtime Caching)', () => {
  test.beforeAll(async () => {
    test.setTimeout(180_000);

    execSync('npm run build', { cwd: frontendDir, stdio: 'pipe' });

    previewProcess = spawn(
      path.join(frontendDir, 'node_modules', '.bin', 'vite'),
      ['preview', '--port', String(E2E_PWA_PREVIEW_PORT), '--strictPort', '--host', previewHost],
      {
        cwd: frontendDir,
        env: { ...process.env, API_PROXY_TARGET: `http://127.0.0.1:${E2E_BACKEND_PORT}` },
        stdio: 'pipe',
      }
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
    'base64'
  );

  test('bereits angesehene Kartenkacheln bleiben nach einem Offline-Reload sichtbar', async ({
    browser,
  }) => {
    const context = await newContextWithReducedMotion(browser, { storageState: authFile });
    await context.route('https://*.tile.openstreetmap.org/**/*.png', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_TILE_PNG })
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

  // Regressionstest für utils/offlineMapTiles.ts (Task: Kartenmaterial vorab für den "totalen"
  // Offline-Fall herunterladen, bevor man tatsächlich offline ist) - derselbe Mock-Ansatz wie oben
  // (echte Requests gegen tile.openstreetmap.org verbietet deren Nutzungsrichtlinie), hier zusätzlich
  // ein Dialog-Handler für den window.confirm()-Bestätigungsdialog vor dem eigentlichen Download.
  test('sichtbarer Kartenausschnitt lässt sich vorab für die Offline-Nutzung herunterladen', async ({
    browser,
  }) => {
    const context = await newContextWithReducedMotion(browser, { storageState: authFile });
    await context.route('https://*.tile.openstreetmap.org/**/*.png', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: FAKE_TILE_PNG })
    );
    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(previewUrl + '/excursions');
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await page.locator('.offline-download-btn').click();
    await expect(page.locator('.tile-download-pill')).toContainText('offline gespeichert', {
      timeout: 30_000,
    });
    await expect(page.locator('.tile-download-pill')).not.toContainText('fehlgeschlagen');

    await page.locator('.tile-download-pill button').click();
    await expect(page.locator('.tile-download-pill')).toHaveCount(0);

    await context.close();
  });
});
