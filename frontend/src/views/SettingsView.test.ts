// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SettingsView from './SettingsView.vue';
import { useAuthStore } from '../stores/auth';
import { useUiSettingsStore } from '../stores/uiSettings';

vi.stubGlobal('__APP_VERSION__', '1.3.0');
vi.stubGlobal('__APP_COMMIT__', 'testcommit');
vi.stubGlobal('__APP_BUILT_AT__', '2026-09-26T10:00:00.000Z');

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url === '/build-info') {
        return Promise.resolve({
          version: '1.3.0',
          ref: 'main',
          builtAt: '2026-09-26T10:00:00.000Z',
          repoUrl: 'https://github.com/dmstern/reisotor',
          hostingLocation: 'Frankfurt',
        });
      }
      if (url === '/users/me/app-settings') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    }),
    put: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  ApiError: class ApiError extends Error {},
}));

vi.mock('../utils/push', () => ({
  isPushSupported: vi.fn().mockReturnValue(false),
  getExistingSubscription: vi.fn().mockResolvedValue(null),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn(),
}));

describe('SettingsView loading state', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.user = { id: 1, username: 'tester', avatar: '🦊', is_admin: false };
    auth.checked = true;

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/settings', component: SettingsView },
        { path: '/', component: { template: '<div>Home</div>' } },
      ],
    });
    await router.push('/settings');
    await router.isReady();
    localStorage.clear();
  });

  function mountComponent() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(SettingsView),
    });
    app.use(pinia);
    app.use(router);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders ViewLoadingState while initial settings and build info are loading', async () => {
    const uiSettings = useUiSettingsStore();
    let resolveUiLoad: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolveUiLoad = resolve;
    });
    vi.spyOn(uiSettings, 'load').mockReturnValue(pendingPromise);

    const { container, cleanUp } = mountComponent();
    await nextTick();

    // While uiSettings.load() is pending, ViewLoadingState is rendered
    expect(container.querySelector('.view-loading')).not.toBeNull();
    expect(container.textContent).toContain('Lade Einstellungen…');
    expect(container.querySelector('.page')).toBeNull();

    // When loading resolves, full settings page appears
    resolveUiLoad();
    // Allow finally block to run
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelector('.view-loading')).toBeNull();
    expect(container.querySelector('.page')).not.toBeNull();
    expect(container.querySelector('h1')?.textContent).toBe('Einstellungen');

    cleanUp();
  });
});
