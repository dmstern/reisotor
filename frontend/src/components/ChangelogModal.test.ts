// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ChangelogModal from './ChangelogModal.vue';
import { usePwaUpdateStore } from '../stores/pwaUpdate';
import { useBuildInfoStore } from '../stores/buildInfo';
import { useAuthStore } from '../stores/auth';
import type { User } from '../api/types';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

const mockUser: User = {
  id: 1,
  username: 'testuser',
  avatar: '👤',
  email: 'test@example.com',
  must_change_password: false,
};

describe('ChangelogModal', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.user = mockUser;
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/settings', component: { template: '<div>Settings</div>' } },
      ],
    });
    await router.push('/');
    await router.isReady();
    localStorage.clear();
  });

  function mountComponent() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(ChangelogModal),
    });
    app.use(pinia);
    app.use(router);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders changelog notes when modal is open and changelog exists', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const buildInfoStore = useBuildInfoStore();
    buildInfoStore.buildInfo = {
      version: '1.4.0',
      ref: 'abc',
      builtAt: '2026-09-17T18:00:00Z',
      changelog: {
        version: '1.4.0',
        date: '2026-09-17',
        notes: ['Neuer Update-Dialog', 'Einstellungs-Option für Popups'],
      },
      repoUrl: '',
      hostingLocation: '',
      environment: 'production',
    };
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    expect(document.body.innerHTML).toContain('Was ist neu in v');
    expect(document.body.innerHTML).toContain('Neuer Update-Dialog');
    expect(document.body.innerHTML).toContain('Einstellungs-Option für Popups');
    expect(document.body.innerHTML).toContain('Alles klar');
    expect(document.body.innerHTML).toContain('Einstellungen');

    cleanUp();
  });

  it('renders grouped changelog notes with group titles when groups exist', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const buildInfoStore = useBuildInfoStore();
    buildInfoStore.buildInfo = {
      version: '1.4.0',
      ref: 'abc',
      builtAt: '2026-09-17T18:00:00Z',
      changelog: {
        version: '1.4.0',
        date: '2026-09-17',
        notes: ['🔔 **Update-Dialoge**: Neue Dialoge', '🗺️ **Touren**: Kartenanzeige optimiert'],
        groups: [
          {
            title: 'Design & Navigation',
            notes: ['🔔 **Update-Dialoge**: Neue Dialoge'],
          },
          {
            title: 'Spots & Touren',
            notes: ['🗺️ **Touren**: Kartenanzeige optimiert'],
          },
        ],
      },
      repoUrl: '',
      hostingLocation: '',
      environment: 'production',
    };
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    expect(document.body.innerHTML).toContain('Design &amp; Navigation');
    expect(document.body.innerHTML).toContain('Spots &amp; Touren');
    expect(document.body.innerHTML).toContain('Update-Dialoge');
    expect(document.body.innerHTML).toContain('Kartenanzeige optimiert');
    expect(document.body.innerHTML).toContain('🔔');
    expect(document.body.innerHTML).toContain('🗺️');

    cleanUp();
  });

  it('renders fallback when no changelog notes exist', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const buildInfoStore = useBuildInfoStore();
    buildInfoStore.buildInfo = {
      version: '1.4.0',
      ref: 'abc',
      builtAt: '2026-09-17T18:00:00Z',
      changelog: null,
      repoUrl: '',
      hostingLocation: '',
      environment: 'production',
    };
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    expect(document.body.innerHTML).toContain('erfolgreich auf Version v');
    expect(document.body.innerHTML).toContain('aktualisiert.');

    cleanUp();
  });

  it('dismisses modal when Alles klar button is clicked', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const dismissSpy = vi.spyOn(pwaUpdate, 'dismissChangelogDialog');
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    const actionBtn = document.body.querySelector('.changelog-actions button') as HTMLButtonElement;
    expect(actionBtn).toBeTruthy();
    actionBtn.click();

    expect(dismissSpy).toHaveBeenCalled();
    cleanUp();
  });

  it('navigates to settings and dismisses dialog when settings link is clicked', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const dismissSpy = vi.spyOn(pwaUpdate, 'dismissChangelogDialog');
    const pushSpy = vi.spyOn(router, 'push');
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    const settingsLink = document.body.querySelector('.settings-link') as HTMLButtonElement;
    expect(settingsLink).toBeTruthy();
    settingsLink.click();

    expect(dismissSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledWith({ path: '/settings', query: { tab: 'notifications' } });

    cleanUp();
  });

  it('does not display modal when user is not logged in', async () => {
    const auth = useAuthStore();
    auth.user = null;
    const pwaUpdate = usePwaUpdateStore();
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    expect(document.body.innerHTML).not.toContain('Was ist neu in v');
    cleanUp();
  });

  it('displays modal when user logs in', async () => {
    const auth = useAuthStore();
    auth.user = null;
    const pwaUpdate = usePwaUpdateStore();
    pwaUpdate.showChangelogDialog = true;

    const { cleanUp } = mountComponent();
    await nextTick();
    expect(document.body.innerHTML).not.toContain('Was ist neu in v');

    auth.user = mockUser;
    await nextTick();
    expect(document.body.innerHTML).toContain('Was ist neu in v');

    cleanUp();
  });
});
