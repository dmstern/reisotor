import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import { useUiSettingsStore } from './uiSettings';
import { api } from '../api/client';
import type { BuildInfo } from '../api/types';

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
      if (!v) {
        updateDialogDismissed.value = true;
      }
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
    if (!registration) {
      return;
    }

    updateCheckInterval = setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);

    onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registration.update();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function initVersionCheck() {
    if (typeof localStorage === 'undefined') {
      return;
    }

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

  function simulateUpdateAvailable(version?: string) {
    needRefresh.value = true;
    updateDialogDismissed.value = false;

    if (version) {
      availableVersion.value = version;
      availableVersionRequested = true;
    } else {
      loadAvailableVersion();
    }
  }

  // Version, auf die das Update wechselt. Das Backend wird zusammen mit dem Frontend ausgerollt
  // und liefert daher bereits die neue Version. Bewusst kein buildInfo-Store (cached die alte).
  const availableVersion = ref<string | null>(null);
  let availableVersionRequested = false;

  async function loadAvailableVersion() {
    if (availableVersionRequested) {
      return;
    }

    availableVersionRequested = true;

    try {
      const info = await api.get<BuildInfo>('/build-info');
      availableVersion.value = info.version ?? null;
    } catch {
      availableVersionRequested = false;
    }
  }

  if (typeof window !== 'undefined') {
    // @ts-expect-error Dev/Debug helper on window
    window.__triggerUpdateDialog = simulateUpdateAvailable;
    // @ts-expect-error Dev/Debug helper on window
    window.__fakeUpdate = simulateUpdateAvailable;
    window.addEventListener('reisotor:fake-update', (e) => {
      const customEvent = e as CustomEvent<{ version?: string }>;
      simulateUpdateAvailable(customEvent.detail?.version);
    });

    if (
      window.location.search.includes('testUpdate') ||
      window.location.search.includes('fakeUpdate')
    ) {
      simulateUpdateAvailable();
    }
  }

  // Analog zu stores/pwaInstall.ts's init(): wird einmalig aus main.ts aufgerufen.
  function init() {
    initVersionCheck();

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    updateSW = registerSW({
      onNeedRefresh() {
        needRefresh.value = true;
        loadAvailableVersion();
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
    needRefresh.value = false;
    let targetUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (targetUrl.includes('testUpdate') || targetUrl.includes('fakeUpdate')) {
      try {
        const u = new URL(targetUrl);
        u.searchParams.delete('testUpdate');
        u.searchParams.delete('fakeUpdate');
        targetUrl = u.toString();
      } catch {
        // Fallback falls URL-Parsing fehlschlägt
      }
    }

    if (updateSW) {
      updateSW(true);
      // Fallback-Reload: Falls controllerchange ausbleibt (z. B. Worker bereits aktiv,
      // kein waiting-Worker bei simuliertem Update oder Browser-Verzögerung),
      // erzwingen wir nach 500ms einen normalen Reload, damit der Klick verlässlich wirkt.
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          if (targetUrl && targetUrl !== window.location.href) {
            window.location.href = targetUrl;
          } else {
            window.location.reload();
          }
        }
      }, 500);
    } else if (typeof window !== 'undefined') {
      if (targetUrl && targetUrl !== window.location.href) {
        window.location.href = targetUrl;
      } else {
        window.location.reload();
      }
    }
  }

  function dismissOfflineReady() {
    offlineReady.value = false;
  }

  function cleanup() {
    if (updateCheckInterval != null) {
      clearInterval(updateCheckInterval);
    }

    if (onVisibilityChange) {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  }

  return {
    needRefresh,
    offlineReady,
    showUpdateDialog,
    updateDialogDismissed,
    dismissUpdateDialog,
    currentVersion,
    availableVersion,
    loadAvailableVersion,
    showChangelogDialog,
    showReleaseNotesNotice,
    initVersionCheck,
    openChangelogDialog,
    dismissChangelogDialog,
    dismissReleaseNotesNotice,
    init,
    reload,
    dismissOfflineReady,
    simulateUpdateAvailable,
    cleanup,
  };
});
