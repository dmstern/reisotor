import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// API_PROXY_TARGET erlaubt der e2e-Testsuite (/e2e), das Frontend gegen ein Backend auf einem
// anderen Port laufen zu lassen (parallel zum normalen lokalen Dev-Server auf Port 3000), ohne
// diesen Standardwert zu verändern.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

let gitRef = 'unknown';
try {
  gitRef = execSync('git describe --tags --always').toString().trim();
} catch {
  // Kein Git-Kontext beim Build (z. B. Release-Artefakt ohne .git-Verzeichnis) — 'unknown' bleibt.
}

export default defineConfig({
  plugins: [vue()],
  server: {
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
