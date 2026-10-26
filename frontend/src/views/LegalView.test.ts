// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LegalView from './LegalView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

describe('LegalView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);

    vi.mocked(api.get).mockResolvedValue({
      operator: {
        name: 'Test Betreiber',
        address: 'Teststraße 1\n10115 Berlin',
        email: 'test@example.com',
        phone: null,
      },
      hasOperatorInfo: true,
      services: {
        photonUrl: 'https://photon.komoot.io/api/',
        isCustomPhoton: false,
        nominatimEnabled: true,
        nominatimUrl: 'https://nominatim.openstreetmap.org/search',
        isCustomNominatim: false,
        orsConfigured: false,
        githubFeedbackConfigured: false,
        pushConfigured: false,
      },
      hostingLocation: 'Berlin',
    });

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/privacy', name: 'privacy', component: LegalView },
        { path: '/imprint', name: 'imprint', component: LegalView },
        { path: '/login', name: 'login', component: { template: '<div>Login</div>' } },
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
      ],
    });
  });

  function mountComponent() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(LegalView),
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

  it('renders privacy policy at /privacy and fetches /legal', async () => {
    await router.push('/privacy');
    await router.isReady();

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await nextTick();

    expect(api.get).toHaveBeenCalledWith('/legal');
    expect(container.querySelector('h1')?.textContent).toContain('Datenschutzerklärung');
    expect(container.textContent).toContain('Test Betreiber');
    expect(container.textContent).toContain('test@example.com');

    cleanUp();
  });

  it('renders imprint at /imprint', async () => {
    await router.push('/imprint');
    await router.isReady();

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await nextTick();

    expect(container.querySelector('h1')?.textContent).toContain('Impressum');
    expect(container.textContent).toContain('Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)');
    expect(container.textContent).toContain('Test Betreiber');

    cleanUp();
  });

  it('displays "Zurück zur Anmeldung" when logged out and "Zurück zur App" when logged in', async () => {
    const auth = useAuthStore();
    auth.user = null;

    await router.push('/privacy');
    await router.isReady();

    const { container, cleanUp } = mountComponent();
    await nextTick();

    const backBtn = container.querySelector('.back-btn');
    expect(backBtn?.textContent).toContain('Zurück zur Anmeldung');

    // Simulate logged in user
    auth.user = { id: 1, username: 'testuser', avatar: '🐱' };
    await nextTick();

    expect(backBtn?.textContent).toContain('Zurück zur App');

    cleanUp();
  });
});
