// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import UpdateAvailableModal from './UpdateAvailableModal.vue';
import { usePwaUpdateStore } from '../stores/pwaUpdate';
import { useUiSettingsStore } from '../stores/uiSettings';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

describe('UpdateAvailableModal', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
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
      render: () => h(UpdateAvailableModal),
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

  it('renders modal when showUpdateDialog is true', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = true;
    pwaUpdate.needRefresh = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    expect(document.body.innerHTML).toContain('Neues Update verfügbar');
    expect(document.body.innerHTML).toContain('Eine neuere Version von Reisotor steht bereit');
    expect(document.body.innerHTML).toContain('Jetzt aktualisieren');
    expect(document.body.innerHTML).toContain('Später');
    expect(document.body.innerHTML).toContain('Einstellungen');

    cleanUp();
  });

  it('calls pwaUpdate.reload when Jetzt aktualisieren is clicked', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const reloadSpy = vi.spyOn(pwaUpdate, 'reload').mockImplementation(() => {});
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = true;
    pwaUpdate.needRefresh = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    const updateBtn = document.body.querySelector('button.btn--primary') as HTMLButtonElement;
    expect(updateBtn).toBeTruthy();
    updateBtn.click();
    expect(reloadSpy).toHaveBeenCalled();

    cleanUp();
  });

  it('navigates to notification settings and dismisses dialog when settings link is clicked', async () => {
    const pwaUpdate = usePwaUpdateStore();
    const dismissSpy = vi.spyOn(pwaUpdate, 'dismissUpdateDialog');
    const pushSpy = vi.spyOn(router, 'push');
    const uiSettings = useUiSettingsStore();
    uiSettings.showUpdateDialogs = true;
    pwaUpdate.needRefresh = true;

    const { cleanUp } = mountComponent();
    await nextTick();

    const settingsLink = document.body.querySelector('.settings-link') as HTMLButtonElement;
    expect(settingsLink).toBeTruthy();
    settingsLink.click();

    expect(dismissSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledWith({ path: '/settings', query: { tab: 'notifications' } });

    cleanUp();
  });
});
