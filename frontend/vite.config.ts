import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// API_PROXY_TARGET erlaubt der e2e-Testsuite (/e2e), das Frontend gegen ein Backend auf einem
// anderen Port laufen zu lassen (parallel zum normalen lokalen Dev-Server auf Port 3000), ohne
// diesen Standardwert zu verändern.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// Statischer GitHub-Pages-Build (Issue #172, siehe .github/workflows/pages-deploy.yml): 'landing'
// baut landing.html statt index.html als einzigen Entry-Punkt. Der Demo-Build (VITE_DEMO_MODE,
// siehe demo/isDemoMode.ts) bleibt bewusst die normale index.html/App.vue - nur mit anderem
// outDir/base, siehe package.json's build:demo-Skript. Der normale `npm run build` (echtes
// Backend-Deploy über ci.yml) bleibt dadurch komplett unverändert (kein Env-Var gesetzt).
const buildTarget = process.env.VITE_BUILD_TARGET;
const pagesBase = process.env.VITE_BASE;

// Version kommt aus der Root-package.json (einzige Versionsquelle fürs ganze Repo, siehe
// backend/scripts/generate-build-info.mjs) statt aus der lokalen frontend/package.json.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

let gitRef = 'unknown';
try {
  gitRef = execSync('git describe --tags --always').toString().trim();
} catch {
  // Kein Git-Kontext beim Build (z. B. Release-Artefakt ohne .git-Verzeichnis) — 'unknown' bleibt.
}

// Leichter Vite-Plugin zur Optimierung von @tabler/icons-vue Barrel-Imports:
// Wandelt `import { IconBed, IconSun } from '@tabler/icons-vue'` um in direkte Subpath-Imports
// `import IconBed from '@tabler/icons-vue/dist/esm/icons/IconBed.mjs'`.
// Verhindert, dass Rollup beim Build das 6.000+ Icons umfassende Barrel-File parsen muss.
function tablerIconsOptimizer() {
  return {
    name: 'tabler-icons-optimizer',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (
        (id.endsWith('.vue') || id.endsWith('.ts') || id.endsWith('.js')) &&
        code.includes('@tabler/icons-vue')
      ) {
        return code.replace(
          /import\s*\{([^}]+)\}\s*from\s*['"]@tabler\/icons-vue['"];?/g,
          (match, importsStr) => {
            const imports = importsStr
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            return imports
              .map((name: string) => {
                const parts = name.split(/\s+as\s+/);
                const originalName = parts[0].trim();
                const aliasName = parts[1] ? parts[1].trim() : originalName;
                return `import ${aliasName} from '@tabler/icons-vue/dist/esm/icons/${originalName}.mjs';`;
              })
              .join('\n');
          }
        );
      }
    },
  };
}

export default defineConfig({
  // Nur für die statischen Pages-Builds gesetzt (dist-landing/dist-demo unter
  // <owner>.github.io/reisotor/[demo/]) - der normale Build (echtes Backend-Deploy) bleibt bei '/'.
  base: pagesBase ?? '/',
  build:
    buildTarget === 'landing'
      ? {
          // Landingpage hat keine eigene PWA/App-Manifest-Notwendigkeit - eigener, schlanker
          // Entry-Punkt statt index.html/App.vue (siehe landing.html/landing-main.ts).
          rollupOptions: { input: 'landing.html' },
        }
      : undefined,
  plugins: [
    tablerIconsOptimizer(),
    vue(),
    // Volle PWA (Home-Bildschirm-Icon + Offline-App-Shell): injectManifest statt der
    // Standard-generateSW-Strategie, damit der bestehende, handgeschriebene public/sw.js
    // (Web-Push-Handler, siehe dortiger Kommentar) erhalten bleibt und nur um Workbox-Precaching
    // ERWEITERT statt komplett ersetzt wird (siehe self.__WB_MANIFEST-Import in sw.js selbst).
    // Die Landingpage (landing-main.ts) registriert keinen Service Worker (kein
    // PwaUpdatePrompt.vue-Import) und braucht kein App-Manifest - Plugin dort komplett weglassen
    // statt eines für sie irreführenden sw.js/manifest.webmanifest im Build-Output.
    buildTarget !== 'landing' &&
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
            {
              src: '/icons/maskable-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: 'Kalender',
              url: '/calendar',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'ToDo',
              url: '/todo',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
            {
              name: 'Packliste',
              url: '/packing',
              icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
            },
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
  // Backt Versions-/Build-Zeitpunkt-Infos zur Build-Zeit direkt in den Bundle (siehe SettingsView.vue's
  // Build-Info-Card) – Gegenstück zu backend/scripts/generate-build-info.mjs, das dasselbe für den
  // Backend-Build in eine build-info.json schreibt (kein Vite-Äquivalent nötig, da der Backend-
  // Prozess einfach eine Datei zur Laufzeit lesen kann, das Frontend als statischer Bundle aber
  // nicht).
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitRef),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    // Fallback für AppFooterLinks.vue, wenn kein backendseitiges build-info verfügbar ist (Login-
    // Seite vor dem Login, statische Landingpage/Demo-Build auf GitHub Pages) - Issue #172.
    __REPO_URL__: JSON.stringify(
      `https://github.com/${process.env.GITHUB_REPO ?? 'dmstern/reisotor'}`
    ),
    __LANDING_URL__: JSON.stringify(
      process.env.VITE_LANDING_URL ?? 'https://dmstern.github.io/reisotor/'
    ),
  },
  test: {
    // Alle aktuellen Testziele sind plain Functions auf plain Daten (utils/*.ts) - kein DOM nötig,
    // daher kein jsdom/@vue/test-utils. Bei künftigen Komponenten-Tests hier auf 'jsdom' wechseln.
    environment: 'node',
  },
});
