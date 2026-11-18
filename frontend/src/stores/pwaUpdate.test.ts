// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

import { usePwaUpdateStore } from './pwaUpdate';
import { useUiSettingsStore } from './uiSettings';

describe('usePwaUpdateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes with needRefresh and offlineReady set to false', () => {
    const store = usePwaUpdateStore();
    expect(store.needRefresh).toBe(false);
    expect(store.offlineReady).toBe(false);
    expect(store.showUpdateDialog).toBe(false);
  });

  it('dismissOfflineReady clears offlineReady flag', () => {
    const store = usePwaUpdateStore();
    store.offlineReady = true;
    expect(store.offlineReady).toBe(true);

    store.dismissOfflineReady();
    expect(store.offlineReady).toBe(false);
  });

  it('shows update dialog when needRefresh is true and showUpdateDialogs is enabled', () => {
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = true;

    const store = usePwaUpdateStore();
    expect(store.showUpdateDialog).toBe(false);

    store.needRefresh = true;
    expect(store.showUpdateDialog).toBe(true);

    store.dismissUpdateDialog();
    expect(store.showUpdateDialog).toBe(false);

    store.simulateUpdateAvailable();
    expect(store.showUpdateDialog).toBe(true);
  });

  it('does not show update dialog when showUpdateDialogs is disabled in uiSettings', () => {
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = false;

    const store = usePwaUpdateStore();
    store.needRefresh = true;
    expect(store.showUpdateDialog).toBe(false);
  });

  it('initializes version check on fresh install without showing changelog', () => {
    const store = usePwaUpdateStore();
    store.initVersionCheck();

    expect(localStorage.getItem('reisotor_last_seen_version')).toBe(store.currentVersion);
    expect(store.showReleaseNotesNotice).toBe(false);
    expect(store.showChangelogDialog).toBe(false);
  });

  it('shows changelog dialog when a new version is detected and showUpdateDialogs is true', () => {
    localStorage.setItem('reisotor_last_seen_version', '0.0.1-old');
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = true;

    const store = usePwaUpdateStore();
    store.initVersionCheck();

    expect(store.showReleaseNotesNotice).toBe(true);
    expect(store.showChangelogDialog).toBe(true);

    store.dismissChangelogDialog();
    expect(store.showChangelogDialog).toBe(false);
    expect(store.showReleaseNotesNotice).toBe(false);
    expect(localStorage.getItem('reisotor_last_seen_version')).toBe(store.currentVersion);
  });

  it('shows release notes notice but suppresses changelog dialog when showUpdateDialogs is false', () => {
    localStorage.setItem('reisotor_last_seen_version', '0.0.1-old');
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = false;

    const store = usePwaUpdateStore();
    store.initVersionCheck();

    expect(store.showReleaseNotesNotice).toBe(true);
    expect(store.showChangelogDialog).toBe(false);

    // Can still be opened manually (e.g. from notification dropdown)
    store.openChangelogDialog();
    expect(store.showChangelogDialog).toBe(true);
  });

  it('reload resets needRefresh and reloads page', () => {
    const store = usePwaUpdateStore();
    store.needRefresh = true;
    const reloadMock = vi.fn();
    vi.stubGlobal('location', {
      href: 'http://localhost/',
      reload: reloadMock,
    });

    store.reload();
    expect(store.needRefresh).toBe(false);
    expect(reloadMock).toHaveBeenCalled();
  });

  it('forces update dialog even when showUpdateDialogs is false if minClientVersion exceeds currentVersion', () => {
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = false;

    const store = usePwaUpdateStore();
    store.minClientVersion = '999.0.0';

    expect(store.updateRequired).toBe(true);
    expect(store.showUpdateDialog).toBe(true);

    store.dismissUpdateDialog();
    store.showUpdateDialog = false;
    expect(store.showUpdateDialog).toBe(true);
  });

  it('activates mandatory update mode on reisotor:update-required window event', () => {
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = false;

    const store = usePwaUpdateStore();
    expect(store.updateRequired).toBe(false);

    window.dispatchEvent(
      new CustomEvent('reisotor:update-required', {
        detail: { minClientVersion: '99.0.0', currentServerVersion: '99.1.0' },
      })
    );

    expect(store.forceUpdateTriggered).toBe(true);
    expect(store.updateRequired).toBe(true);
    expect(store.needRefresh).toBe(true);
    expect(store.minClientVersion).toBe('99.0.0');
    expect(store.availableVersion).toBe('99.1.0');
    expect(store.showUpdateDialog).toBe(true);

    store.cleanup();
  });

  it('supports simulateUpdateAvailable with required option', () => {
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = false;

    const store = usePwaUpdateStore();
    store.simulateUpdateAvailable('99.2.0', { required: true });

    expect(store.updateRequired).toBe(true);
    expect(store.showUpdateDialog).toBe(true);
    expect(store.availableVersion).toBe('99.2.0');
  });

  it('awaits swRegistration.update() and sends SKIP_WAITING to waiting worker before reload', async () => {
    const { registerSW } = await import('virtual:pwa-register');
    const postMessageMock = vi.fn();
    const swUpdateMock = vi.fn().mockResolvedValue(undefined);
    const updateSwMock = vi.fn().mockResolvedValue(undefined);

    vi.mocked(registerSW).mockImplementation((opts) => {
      opts?.onRegisteredSW?.('/sw.js', {
        update: swUpdateMock,
        waiting: { postMessage: postMessageMock },
      } as unknown as ServiceWorkerRegistration);
      return updateSwMock;
    });

    vi.stubGlobal('navigator', { serviceWorker: {} });
    const store = usePwaUpdateStore();
    store.init();
    store.simulateUpdateAvailable('99.3.0', { required: true });
    store.reload();

    await vi.waitFor(() => {
      expect(swUpdateMock).toHaveBeenCalledTimes(1);
      expect(postMessageMock).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(updateSwMock).toHaveBeenCalledWith(true);
    });

    store.cleanup();
  });
});
