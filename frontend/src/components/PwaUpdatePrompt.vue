<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Volle PWA (siehe vite.config.ts's VitePWA-Konfiguration, injectManifest-Strategie): registriert
// denselben public/sw.js wie zuvor (nur jetzt über das von vite-plugin-pwa generierte Modul statt
// manuell in main.ts), zeigt aber zusätzlich einen kurzen Hinweis, wenn eine neue Version bereitsteht
// (registerType: 'prompt' statt stillem Auto-Update) bzw. einmalig, dass die App jetzt offline
// nutzbar ist. utils/push.ts's navigator.serviceWorker.ready-Erwartung bleibt unverändert erfüllt,
// da weiterhin derselbe /sw.js unter demselben Scope registriert wird.
const needRefresh = ref(false);
const offlineReady = ref(false);

// Der Browser prüft von sich aus nur bei einer echten Navigation auf eine neue Service-Worker-
// Version - bleibt eine (v. a. iOS-Safari-)PWA im Standalone-Modus einfach offen/im Hintergrund
// (App-Switcher, kein echter Neustart), passiert das nie von selbst, der Hinweis erscheint erst
// beim nächsten kompletten Neustart der App. registration.update() stößt denselben Check manuell
// an: einmal alle 60s, plus sofort, sobald die Seite wieder sichtbar wird (schneller als aufs
// nächste Intervall zu warten, z. B. beim Zurückholen aus dem App-Switcher).
const UPDATE_CHECK_INTERVAL_MS = 60_000;
let updateCheckInterval: ReturnType<typeof setInterval> | undefined;
let onVisibilityChange: (() => void) | undefined;

function startPeriodicUpdateCheck(registration: ServiceWorkerRegistration | undefined) {
  if (!registration) return;
  updateCheckInterval = setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
  onVisibilityChange = () => {
    if (document.visibilityState === 'visible') registration.update();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
}

const updateSW = registerSW({
  onNeedRefresh() {
    needRefresh.value = true;
  },
  onOfflineReady() {
    offlineReady.value = true;
  },
  onRegisteredSW(_swUrl, registration) {
    startPeriodicUpdateCheck(registration);
  },
});

onUnmounted(() => {
  if (updateCheckInterval != null) clearInterval(updateCheckInterval);
  if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
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
    <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Update verfügbar
    <button type="button" class="pwa-pill-btn" @click="reload">Neu laden</button>
  </span>
  <span
    v-else-if="offlineReady"
    class="pwa-pill ready"
    title="Diese App lädt jetzt auch ohne Internetverbindung"
  >
    <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> App ist jetzt offline verfügbar
    <IconButton
      variant="ghost"
      size="sm"
      :icon="ACTION_ICONS.close"
      aria-label="Hinweis schließen"
      title="Hinweis schließen"
      @click="dismissOfflineReady"
    />
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
  /* Beide Varianten (Update verfügbar/App ist offline verfügbar) sind "gute Nachrichten", keine
     Warnungen — grün statt der bisherigen Primär-/Accent-Farbe, damit sie sich klar von
     OfflineIndicator.vue's orangen "wartet noch"-Pill unterscheiden. */
  background: var(--color-success);
  padding: 4px 6px 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
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
