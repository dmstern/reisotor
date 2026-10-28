// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import VerifyEmailView from './VerifyEmailView.vue';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
  },
}));

describe('VerifyEmailView', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  function mountComponent(token?: string) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/verify-email', name: 'verify-email', component: VerifyEmailView },
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
        { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } },
        { path: '/privacy', name: 'privacy', component: { template: '<div>Privacy</div>' } },
        { path: '/imprint', name: 'imprint', component: { template: '<div>Imprint</div>' } },
      ],
    });

    const app = createApp({
      render() {
        return h(VerifyEmailView);
      },
    });

    app.use(pinia);
    app.use(router);

    return {
      router,
      mount: async () => {
        await router.push(token ? `/verify-email?token=${token}` : '/verify-email');
        app.mount(container);
        await nextTick();
      },
      container,
    };
  }

  it('zeigt Fehler an, wenn kein Token übergeben wird', async () => {
    const { mount, container } = mountComponent();
    await mount();
    await nextTick();

    expect(container.textContent).toContain('In diesem Link fehlt der Bestätigungs-Token');
  });

  it('sendet Token an /auth/verify-email und zeigt Erfolgsmeldung', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ success: true, message: 'OK' });
    vi.mocked(api.get).mockResolvedValueOnce({ id: 1, email: 'test@example.com' });

    const { mount, container } = mountComponent('valid-token-123');
    await mount();

    // Warten auf API-Aufruf und Reaktions-Update
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/auth/verify-email', { token: 'valid-token-123' });
    expect(container.textContent).toContain('E-Mail-Adresse bestätigt!');
  });

  it('zeigt Fehlermeldung bei ungültigem Token', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(
      new ApiError(400, 'Ungültiger oder abgelaufener Bestätigungslink')
    );

    const { mount, container } = mountComponent('invalid-token');
    await mount();
    await flushPromises();

    expect(container.textContent).toContain('Bestätigung fehlgeschlagen');
    expect(container.textContent).toContain('Ungültiger oder abgelaufener Bestätigungslink');
  });
});

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
