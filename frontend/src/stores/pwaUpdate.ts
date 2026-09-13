import { defineStore } from 'pinia';
import { ref } from 'vue';
import { registerSW } from 'virtual:pwa-register';

// Volle PWA (siehe vite.config.ts's VitePWA-Konfiguration, injectManifest-Strategie): registriert
// denselben public/sw.js wie zuvor (über das von vite-plugin-pwa generierte Modul), zeigt aber
// in NotificationInbox.vue einen Hinweis, wenn eine neue Version bereitsteht (registerType: 'prompt'
// statt stillem Auto-Update) bzw. einmalig, dass die App jetzt offline nutzbar ist.
export const usePwaUpdateStore = defineStore('pwaUpdate', () => {
  const needRefresh = ref(false);
  const offlineReady = ref(false);

  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
  let updateCheckInterval: ReturnType<typeof setInterval> | undefined;
  let onVisibilityChange: (() => void) | undefined;

  const UPDATE_CHECK_INTERVAL_MS = 60_000;

  function startPeriodicUpdateCheck(registration: ServiceWorkerRegistration | undefined) {
    if (!registration) return;
    updateCheckInterval = setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
    onVisibilityChange = () => {
      if (document.visibilityState === 'visible') registration.update();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  // Analog zu stores/pwaInstall.ts's init(): wird einmalig aus main.ts aufgerufen.
  function init() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    updateSW = registerSW({
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
  }

  function reload() {
    if (updateSW) {
      updateSW(true);
    } else {
      window.location.reload();
    }
  }

  function dismissOfflineReady() {
    offlineReady.value = false;
  }

  function cleanup() {
    if (updateCheckInterval != null) clearInterval(updateCheckInterval);
    if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  return {
    needRefresh,
    offlineReady,
    init,
    reload,
    dismissOfflineReady,
    cleanup,
  };
});
