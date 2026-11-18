import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { registerSW } from 'virtual:pwa-register';
import { useUiSettingsStore } from './uiSettings';
import { api } from '../api/client';
import type { BuildInfo } from '../api/types';
import { isVersionBelowMin } from '../utils/semver';

interface UpdateRequiredDetail {
  minClientVersion?: string | null;
  currentServerVersion?: string | null;
}

// Volle PWA (siehe vite.config.ts's VitePWA-Konfiguration, injectManifest-Strategie): registriert
// denselben public/sw.js wie zuvor (über das von vite-plugin-pwa generierte Modul), zeigt aber
// in NotificationInbox.vue einen Hinweis, wenn eine neue Version bereitsteht (registerType: 'prompt'
// statt stillem Auto-Update) bzw. einmalig, dass die App jetzt offline nutzbar ist.
// Verwaltet außerdem Dialoge für Updates und Changelog nach Versions-Aktualisierungen.
export const usePwaUpdateStore = defineStore('pwaUpdate', () => {
  const uiSettings = useUiSettingsStore();
  const needRefresh = ref(false);
  const offlineReady = ref(false);
  const minClientVersion = ref<string | null>(null);
  const forceUpdateTriggered = ref(false);
  const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

  const updateRequired = computed(
    () => forceUpdateTriggered.value || isVersionBelowMin(currentVersion, minClientVersion.value)
  );

  const updateDialogDismissed = ref(false);
  const showUpdateDialog = computed({
    get: () =>
      updateRequired.value ||
      (needRefresh.value && !updateDialogDismissed.value && uiSettings.showUpdateDialogs),
    set: (value: boolean) => {
      if (!value && !updateRequired.value) {
        updateDialogDismissed.value = true;
      }
    },
  });

  const LAST_SEEN_VERSION_KEY = 'reisotor_last_seen_version';
  const showChangelogDialog = ref(false);
  const showReleaseNotesNotice = ref(false);

  let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
  let swRegistration: ServiceWorkerRegistration | undefined;
  let updateCheckInterval: ReturnType<typeof setInterval> | undefined;
  let onVisibilityChange: (() => void) | undefined;
  let onUpdateRequiredEvent: ((event: Event) => void) | undefined;

  const UPDATE_CHECK_INTERVAL_MS = 60_000;
  const RELOAD_FALLBACK_DELAY_MS = 500;

  function startPeriodicUpdateCheck(registration: ServiceWorkerRegistration | undefined) {
    if (!registration) {
      return;
    }

    swRegistration = registration;
    updateCheckInterval = setInterval(() => {
      registration.update();
      void loadAvailableVersion(true);
    }, UPDATE_CHECK_INTERVAL_MS);

    onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        registration.update();
        void loadAvailableVersion(true);
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
    if (updateRequired.value) {
      return;
    }

    updateDialogDismissed.value = true;
  }

  function simulateUpdateAvailable(version?: string, options?: { required?: boolean }) {
    needRefresh.value = true;
    updateDialogDismissed.value = false;

    if (options?.required !== undefined) {
      forceUpdateTriggered.value = Boolean(options.required);
    }

    if (version) {
      availableVersion.value = version;
      availableVersionRequested = true;
    } else {
      void loadAvailableVersion();
    }
  }

  // Version, auf die das Update wechselt. Das Backend wird zusammen mit dem Frontend ausgerollt
  // und liefert daher bereits die neue Version. Bewusst kein buildInfo-Store (cached die alte).
  const availableVersion = ref<string | null>(null);
  let availableVersionRequested = false;

  async function loadAvailableVersion(force = false) {
    if (availableVersionRequested && !force) {
      return;
    }

    availableVersionRequested = true;

    try {
      const info = await api.get<BuildInfo>('/build-info', {
        silent: true,
        skipOfflineDetection: true,
      });

      if (!info || typeof info !== 'object') {
        availableVersionRequested = false;
        return;
      }

      availableVersion.value = info.version ?? null;
      minClientVersion.value = info.minClientVersion ?? null;

      if (isVersionBelowMin(currentVersion, info.minClientVersion)) {
        needRefresh.value = true;
        void swRegistration?.update();
      }
    } catch {
      availableVersionRequested = false;
    }
  }

  function handleUpdateRequiredEvent(event: Event) {
    const customEvent = event as CustomEvent<UpdateRequiredDetail | null>;
    const detail = customEvent.detail;

    forceUpdateTriggered.value = true;
    needRefresh.value = true;

    if (detail?.minClientVersion) {
      minClientVersion.value = detail.minClientVersion;
    }

    if (detail?.currentServerVersion) {
      availableVersion.value = detail.currentServerVersion;
    }

    void swRegistration?.update();
    void loadAvailableVersion(true);
  }

  if (typeof window !== 'undefined') {
    // @ts-expect-error Dev/Debug helper on window
    window.__triggerUpdateDialog = simulateUpdateAvailable;
    // @ts-expect-error Dev/Debug helper on window
    window.__fakeUpdate = simulateUpdateAvailable;
    window.addEventListener('reisotor:fake-update', (event) => {
      const customEvent = event as CustomEvent<{ version?: string; required?: boolean }>;
      simulateUpdateAvailable(customEvent.detail?.version, {
        required: customEvent.detail?.required,
      });
    });

    onUpdateRequiredEvent = handleUpdateRequiredEvent;
    window.addEventListener('reisotor:update-required', onUpdateRequiredEvent);

    const search = window.location?.search ?? '';

    if (search.includes('testForceUpdate')) {
      simulateUpdateAvailable(undefined, { required: true });
    } else if (search.includes('testUpdate') || search.includes('fakeUpdate')) {
      simulateUpdateAvailable();
    }
  }

  // Analog zu stores/pwaInstall.ts's init(): wird einmalig aus main.ts aufgerufen.
  function init() {
    initVersionCheck();
    void loadAvailableVersion();

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    updateSW = registerSW({
      onNeedRefresh() {
        needRefresh.value = true;
        void loadAvailableVersion(true);
      },
      onOfflineReady() {
        offlineReady.value = true;
      },
      onRegisteredSW(_swUrl, registration) {
        startPeriodicUpdateCheck(registration);
      },
    });
  }

  function performPageReload(targetUrl: string) {
    if (typeof window === 'undefined') {
      return;
    }

    if (targetUrl && targetUrl !== window.location.href) {
      window.location.href = targetUrl;
    } else {
      window.location.reload();
    }
  }

  function reload() {
    needRefresh.value = false;
    forceUpdateTriggered.value = false;
    let targetUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (
      targetUrl.includes('testUpdate') ||
      targetUrl.includes('fakeUpdate') ||
      targetUrl.includes('testForceUpdate')
    ) {
      try {
        const parsedUrl = new URL(targetUrl);
        parsedUrl.searchParams.delete('testUpdate');
        parsedUrl.searchParams.delete('fakeUpdate');
        parsedUrl.searchParams.delete('testForceUpdate');
        targetUrl = parsedUrl.toString();
      } catch {
        // Fallback falls URL-Parsing fehlschlägt
      }
    }

    if (swRegistration) {
      const registration = swRegistration;

      void (async () => {
        try {
          await registration.update();
        } catch {
          // Best-Effort SW-Update vor dem Reload
        }

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        if (updateSW) {
          void updateSW(true);
        }

        // Fallback-Reload: Falls controllerchange ausbleibt (z. B. Worker bereits aktiv,
        // kein waiting-Worker bei simuliertem Update oder Browser-Verzögerung),
        // erzwingen wir nach 500ms einen normalen Reload, damit der Klick verlässlich wirkt.
        setTimeout(() => performPageReload(targetUrl), RELOAD_FALLBACK_DELAY_MS);
      })();

      return;
    }

    if (updateSW) {
      void updateSW(true);
      setTimeout(() => performPageReload(targetUrl), RELOAD_FALLBACK_DELAY_MS);
    } else {
      performPageReload(targetUrl);
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

    if (onUpdateRequiredEvent && typeof window !== 'undefined') {
      window.removeEventListener('reisotor:update-required', onUpdateRequiredEvent);
    }
  }

  return {
    needRefresh,
    offlineReady,
    minClientVersion,
    forceUpdateTriggered,
    updateRequired,
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
