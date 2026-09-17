// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
});
