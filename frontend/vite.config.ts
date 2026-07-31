import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// API_PROXY_TARGET erlaubt der e2e-Testsuite (/e2e), das Frontend gegen ein Backend auf einem
// anderen Port laufen zu lassen (parallel zum normalen lokalen Dev-Server auf Port 3000), ohne
// diesen Standardwert zu verändern.
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

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
  test: {
    // Alle aktuellen Testziele sind plain Functions auf plain Daten (utils/*.ts) - kein DOM nötig,
    // daher kein jsdom/@vue/test-utils. Bei künftigen Komponenten-Tests hier auf 'jsdom' wechseln.
    environment: 'node',
  },
});
