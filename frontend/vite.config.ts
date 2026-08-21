import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// API_PROXY_TARGET erlaubt der e2e-Testsuite (/e2e), das Frontend gegen ein Backend auf einem
// anderen Port laufen zu lassen (parallel zum normalen lokalen Dev-Server auf Port 3000), ohne
// diesen Standardwert zu verändern.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// Version kommt aus der Root-package.json (einzige Versionsquelle fürs ganze Repo, siehe
// backend/scripts/generate-build-info.mjs) statt aus der lokalen frontend/package.json.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

let gitRef = 'unknown';
try {
  gitRef = execSync('git describe --tags --always').toString().trim();
} catch {
  // Kein Git-Kontext beim Build (z. B. Release-Artefakt ohne .git-Verzeichnis) — 'unknown' bleibt.
}

export default defineConfig({
  plugins: [
    vue(),
    // Volle PWA (Home-Bildschirm-Icon + Offline-App-Shell): injectManifest statt der
    // Standard-generateSW-Strategie, damit der bestehende, handgeschriebene public/sw.js
    // (Web-Push-Handler, siehe dortiger Kommentar) erhalten bleibt und nur um Workbox-Precaching
    // ERWEITERT statt komplett ersetzt wird (siehe self.__WB_MANIFEST-Import in sw.js selbst).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      // 'public'-Assets werden von Vite ohnehin 1:1 nach dist/ kopiert - injectManifest schreibt
      // direkt in public/sw.js hinein/liest von dort, daher kein separates outDir nötig.
      injectManifest: {
        // Fonts/Logo/Icons zusätzlich zu den von Vite selbst erzeugten Haupt-Bundles precachen -
        // ohne diese explizite Liste würden nur JS/CSS/index.html erfasst, nicht die unter
        // public/ liegenden statischen Assets.
        globPatterns: ['**/*.{js,css,html}', 'icons/*.png', 'fonts/*.woff2', 'reisotor_logo.svg'],
      },
      registerType: 'prompt',
      devOptions: {
        // Im Dev-Server bewusst deaktiviert - Workbox-Precaching gegen den sich ständig ändernden
        // Vite-Dev-Bundle sorgt nur für Verwirrung (veraltete gecachte Module); die Offline-
        // App-Shell ist ein reines Produktions-Build-Feature.
        enabled: false,
      },
      includeAssets: ['reisotor_logo.svg', 'fonts/*.woff2'],
      manifest: {
        name: 'Reisotor',
        short_name: 'Reisotor',
        description: 'Gemeinsame Reiseplanung',
        start_url: '/',
        scope: '/',
        id: '/',
        display: 'standalone',
        orientation: 'any',
        categories: ['travel', 'productivity'],
        // Kreis-Hintergrundfarbe des Logos (reisotor_logo.svg) - Splashscreen-Hintergrund beim
        // Start von Home-Bildschirm/Taskleiste aus.
        background_color: '#EAF6F4',
        // style.css's --color-primary (Light-Mode).
        theme_color: '#2a7f74',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Kalender', url: '/calendar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'ToDo', url: '/todo', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Packliste', url: '/packing', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  // Gleicher Proxy wie oben, aber für `vite preview` (Produktions-Build lokal servieren) - genutzt
  // vom e2e-Offline-App-Shell-Test (e2e/tests/offline-app-shell.spec.ts), der echtes
  // Workbox-Precaching gegen den Build statt den Dev-Server prüfen muss (devOptions.enabled ist
  // bewusst false, siehe oben) und dafür denselben API-Proxy-Trick braucht, damit der Browser die
  // Session-Cookie-Anfragen weiterhin als same-origin sieht.
  preview: {
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  // Backt Versions-/Build-Zeitpunkt-Infos zur Build-Zeit direkt in den Bundle (siehe ProfileView.vue's
  // Build-Info-Card) – Gegenstück zu backend/scripts/generate-build-info.mjs, das dasselbe für den
  // Backend-Build in eine build-info.json schreibt (kein Vite-Äquivalent nötig, da der Backend-
  // Prozess einfach eine Datei zur Laufzeit lesen kann, das Frontend als statischer Bundle aber
  // nicht).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitRef),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    // Alle aktuellen Testziele sind plain Functions auf plain Daten (utils/*.ts) - kein DOM nötig,
    // daher kein jsdom/@vue/test-utils. Bei künftigen Komponenten-Tests hier auf 'jsdom' wechseln.
    environment: 'node',
  },
});
