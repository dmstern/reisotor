import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  E2E_BACKEND_PORT,
  E2E_FRONTEND_PORT,
  E2E_PASSWORD,
  E2E_PASSWORD_2,
  E2E_SESSION_SECRET,
  E2E_USERNAME,
  E2E_USERNAME_2,
} from './constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '.tmp', 'e2e-backend.sqlite');
const authFile = path.join(__dirname, '.auth', 'user.json');

export default defineConfig({
  testDir: './tests',
  // Alle Specs teilen sich einen Backend-Prozess + eine SQLite-Datei — bewusst seriell, um jede
  // Interferenz zwischen Tests auszuschließen (siehe Plan, Kernentscheidung 7).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './global-setup.ts',

  use: {
    baseURL: `http://localhost:${E2E_FRONTEND_PORT}`,
    trace: 'on-first-retry',
    // Artefakt für manuelles/Claude-Review bei fehlgeschlagenen Tests — bewusst kein
    // toHaveScreenshot()-Pixel-Vergleich (Font-/OS-Rendering-Drift zwischen Maschinen, siehe
    // CLAUDE.md).
    screenshot: 'only-on-failure',
    video: 'off',
    // Splash Screen (SplashScreen.vue/ReisotorRobot.vue's "packing"-Phase, #149) blockt die
    // eigentliche UI beim allerersten App-Start bis zu ~2s lang, bis die Rucksack-Animation
    // durchgelaufen ist - respektiert dafür bereits prefers-reduced-motion (nahezu verzögerungsfrei,
    // siehe dortige @media-Regel). Ohne dieses Flag würden reihenweise Tests (Default-Timeouts oft
    // 5s) knapp an dieser künstlichen Wartezeit scheitern, allen voran auth.setup.ts direkt nach dem
    // Login. Global statt nur hier betroffene Specs, da jeder Test nach einem frischen Login/
    // Urlaubswechsel denselben Splash treffen kann.
    reducedMotion: 'reduce',
    // Opt-in für Sandboxes mit einer vorinstallierten, von diesem Playwright-Paket abweichenden
    // Chromium-Revision (z. B. Claude-Code-Remote-Umgebungen ohne Internetzugriff für
    // `playwright install`) — no-op, solange die Env-Var nicht gesetzt ist.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],

  // reuseExistingServer immer false (auch lokal): diese Suite testet deterministisch geseedeten
  // Zustand, nie die echten Nutzdaten eines laufenden Dev-Servers.
  webServer: [
    {
      // Playwright startet webServer-Prozesse VOR globalSetup (nicht danach!) — Wipe+Seed müssen
      // deshalb hier im Befehl selbst passieren, bevor der Dev-Server die DB öffnet. global-setup.ts
      // liest die Fixture-Daten danach aus (läuft nach diesem webServer-Schritt, DB ist zu dem
      // Zeitpunkt bereits fertig geseedet und stabil).
      //
      // In CI (oder bei E2E_PROD_MODE=1) nutzen wir den Produktions-Build (node dist/server.js &
      // vite preview), um on-the-fly TypeScript-/Vue-Kompilierung während der Tests zu vermeiden.
      command:
        process.env.CI || process.env.E2E_PROD_MODE
          ? `mkdir -p "$(dirname "$DB_PATH")" && rm -f "$DB_PATH"* && npx tsx src/db/seedDemo.ts && node dist/server.js`
          : `mkdir -p "$(dirname "$DB_PATH")" && rm -f "$DB_PATH"* && npx tsx src/db/seedDemo.ts && npm run dev`,
      cwd: '../backend',
      url: `http://127.0.0.1:${E2E_BACKEND_PORT}/api/auth/me`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        DB_PATH: dbPath,
        PORT: String(E2E_BACKEND_PORT),
        SESSION_SECRET: E2E_SESSION_SECRET,
        // Erlaubt dem Frontend-webServer unten (eigener Port statt Vites Default 5173), Cookies zu
        // setzen — siehe backend/src/server.ts. Läuft dadurch konfliktfrei neben einem evtl.
        // bereits laufenden echten Dev-Server auf 3000/5173.
        CORS_ORIGIN: `http://localhost:${E2E_FRONTEND_PORT}`,
        SEED_USER1: E2E_USERNAME,
        SEED_PASS1: E2E_PASSWORD,
        SEED_USER2: E2E_USERNAME_2,
        SEED_PASS2: E2E_PASSWORD_2,
      },
    },
    {
      // --strictPort: fail-fast statt dass Vite bei belegtem Port still auf den nächsten
      // ausweicht — Playwrights url-Healthcheck würde sonst nie den richtigen Port erreichen.
      command:
        process.env.CI || process.env.E2E_PROD_MODE
          ? `npm run preview -- --port ${E2E_FRONTEND_PORT} --strictPort`
          : `npm run dev -- --port ${E2E_FRONTEND_PORT} --strictPort`,
      cwd: '../frontend',
      url: `http://localhost:${E2E_FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Vites /api-Proxy zeigt sonst hart auf Port 3000 (frontend/vite.config.ts) — muss auf den
        // e2e-Backend-Port zeigen, sonst laufen alle API-Calls ins Leere oder (schlimmer) gegen
        // einen evtl. echten Dev-Server auf 3000.
        API_PROXY_TARGET: `http://127.0.0.1:${E2E_BACKEND_PORT}`,
      },
    },
  ],
});
