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
});
