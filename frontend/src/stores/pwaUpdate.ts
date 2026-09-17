import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import { useUiSettingsStore } from './uiSettings';

// Volle PWA (siehe vite.config.ts's VitePWA-Konfiguration, injectManifest-Strategie): registriert
// denselben public/sw.js wie zuvor (über das von vite-plugin-pwa generierte Modul), zeigt aber
// in NotificationInbox.vue einen Hinweis, wenn eine neue Version bereitsteht (registerType: 'prompt'
// statt stillem Auto-Update) bzw. einmalig, dass die App jetzt offline nutzbar ist.
// Verwaltet außerdem Dialoge für Updates und Changelog nach Versions-Aktualisierungen.
export const usePwaUpdateStore = defineStore('pwaUpdate', () => {
  const uiSettings = useUiSettingsStore();
  const needRefresh = ref(false);
  const offlineReady = ref(false);

  const updateDialogDismissed = ref(false);
  const showUpdateDialog = computed({
    get: () => needRefresh.value && !updateDialogDismissed.value && uiSettings.showUpdateDialogs,
    set: (v: boolean) => {
      if (!v) updateDialogDismissed.value = true;
    },
  });

  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';
  const LAST_SEEN_VERSION_KEY = 'reisotor_last_seen_version';
  const showChangelogDialog = ref(false);
  const showReleaseNotesNotice = ref(false);

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

  function initVersionCheck() {
    if (typeof localStorage === 'undefined') return;
    const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
    if (lastSeen === null) {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
      showReleaseNotesNotice.value = false;
      showChangelogDialog.value = false;
    } else if (lastSeen !== currentVersion) {
      showReleaseNotesNotice.value = true;
      if (uiSettings.showUpdateDialogs) {
        showChangelogDialog.value = true;
      }
    }
  }

  function openChangelogDialog() {
    showChangelogDialog.value = true;
  }

  function dismissChangelogDialog() {
    showChangelogDialog.value = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
    }
    showReleaseNotesNotice.value = false;
  }

  function dismissReleaseNotesNotice() {
    showReleaseNotesNotice.value = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
    }
  }

  function dismissUpdateDialog() {
    updateDialogDismissed.value = true;
  }

  // Analog zu stores/pwaInstall.ts's init(): wird einmalig aus main.ts aufgerufen.
  function init() {
    initVersionCheck();
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
    showUpdateDialog,
    updateDialogDismissed,
    dismissUpdateDialog,
    currentVersion,
    showChangelogDialog,
    showReleaseNotesNotice,
    initVersionCheck,
    openChangelogDialog,
    dismissChangelogDialog,
    dismissReleaseNotesNotice,
    init,
    reload,
    dismissOfflineReady,
    cleanup,
  };
});
