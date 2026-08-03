<script setup lang="ts">
import { ref } from 'vue';
import { registerSW } from 'virtual:pwa-register';

// Volle PWA (siehe vite.config.ts's VitePWA-Konfiguration, injectManifest-Strategie): registriert
// denselben public/sw.js wie zuvor (nur jetzt über das von vite-plugin-pwa generierte Modul statt
// manuell in main.ts), zeigt aber zusätzlich einen kurzen Hinweis, wenn eine neue Version bereitsteht
// (registerType: 'prompt' statt stillem Auto-Update) bzw. einmalig, dass die App jetzt offline
// nutzbar ist. utils/push.ts's navigator.serviceWorker.ready-Erwartung bleibt unverändert erfüllt,
// da weiterhin derselbe /sw.js unter demselben Scope registriert wird.
const needRefresh = ref(false);
const offlineReady = ref(false);

const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh.value = true;
  },
  onOfflineReady() {
    offlineReady.value = true;
  },
});

function reload() {
  updateSW(true);
}

function dismissOfflineReady() {
  offlineReady.value = false;
}
</script>

<template>
  <span v-if="needRefresh" class="pwa-pill update">
    🔄 Update verfügbar
    <button type="button" class="pwa-pill-btn" @click="reload">Neu laden</button>
  </span>
  <span v-else-if="offlineReady" class="pwa-pill" title="Diese App lädt jetzt auch ohne Internetverbindung">
    ✅ App ist jetzt offline verfügbar
    <button type="button" class="pwa-pill-btn" aria-label="Hinweis schließen" @click="dismissOfflineReady">✕</button>
  </span>
</template>

<style scoped>
.pwa-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-accent);
  padding: 4px 6px 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

.pwa-pill.update {
  background: var(--color-primary);
}

.pwa-pill-btn {
  background: rgba(255, 255, 255, 0.25);
  border: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  border-radius: 999px;
  padding: 2px 8px;
  cursor: pointer;
  line-height: 1.4;
}

.pwa-pill-btn:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>
