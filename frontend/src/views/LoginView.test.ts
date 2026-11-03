// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LoginView from './LoginView.vue';
import { useAuthStore } from '../stores/auth';
import { api, ApiError } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ registrationMode: 'full' }),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    data?: any;
    constructor(status: number, message: string, meta?: { data?: any }) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
      this.data = meta?.data;
    }
  },
}));

vi.stubGlobal('__LANDING_URL__', 'https://example.com/landing');

describe('LoginView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/login', component: LoginView },
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/privacy', component: { template: '<div>Privacy</div>' } },
        { path: '/imprint', component: { template: '<div>Imprint</div>' } },
      ],
    });
    await router.push('/login');
    await router.isReady();
    localStorage.clear();
  });

  function mountComponent() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(LoginView),
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

  it('shows loading spinner on submit button while login is in progress', async () => {
    const auth = useAuthStore();
    let resolveLogin: () => void = () => {};
    const loginPromise = new Promise<void>((resolve) => {
      resolveLogin = resolve;
    });
    vi.spyOn(auth, 'login').mockReturnValue(loginPromise);

    const { container, cleanUp } = mountComponent();
    await nextTick();

    const usernameInput = container.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitBtn.classList.contains('is-loading')).toBe(false);
    expect(submitBtn.querySelector('.spinner')).toBeNull();

    usernameInput.value = 'daenu';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'secret123';
    passwordInput.dispatchEvent(new Event('input'));

    const form = container.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();

    expect(submitBtn.classList.contains('is-loading')).toBe(true);
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.querySelector('.spinner')).not.toBeNull();
    expect(submitBtn.textContent).toContain('Anmelden…');

    resolveLogin();
    await nextTick();
    cleanUp();
  });

  it('resets loading state and shows error message when login fails', async () => {
    const auth = useAuthStore();
    vi.spyOn(auth, 'login').mockRejectedValue(new ApiError(401, 'Ungültige Anmeldedaten'));

    const { container, cleanUp } = mountComponent();
    await nextTick();

    const usernameInput = container.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;
    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    usernameInput.value = 'daenu';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'wrongpassword';
    passwordInput.dispatchEvent(new Event('input'));

    const form = container.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Wait for promise rejection to propagate
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(submitBtn.classList.contains('is-loading')).toBe(false);
    expect(submitBtn.disabled).toBe(false);
    expect(container.querySelector('.error')?.textContent).toContain('Ungültige Anmeldedaten');

    cleanUp();
  });

  it('renders privacy and imprint links in the footer', async () => {
    const { container, cleanUp } = mountComponent();
    await nextTick();

    const privacyLink = container.querySelector('a[href="/privacy"]');
    const imprintLink = container.querySelector('a[href="/imprint"]');

    expect(privacyLink).not.toBeNull();
    expect(privacyLink?.textContent).toContain('Datenschutz');
    expect(imprintLink).not.toBeNull();
    expect(imprintLink?.textContent).toContain('Impressum');

    cleanUp();
  });

  it('displays contact admin action button when unverified email error occurs', async () => {
    const auth = useAuthStore();
    const errorWithData = new ApiError(
      403,
      'Dieses Konto ist noch nicht freigeschaltet. Da kein Mailserver eingerichtet ist, muss dein Konto manuell von der Administration freigeschaltet werden.',
      { data: { unverifiedEmail: true, noMailServer: true } }
    );
    vi.spyOn(auth, 'login').mockRejectedValue(errorWithData);

    const { container, cleanUp } = mountComponent();
    await nextTick();

    const usernameInput = container.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;

    usernameInput.value = 'unverified_user';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'password123';
    passwordInput.dispatchEvent(new Event('input'));

    const form = container.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelector('.error')?.textContent).toContain(
      'Dieses Konto ist noch nicht freigeschaltet'
    );
    const contactBtn = container.querySelector('.contact-admin-action') as HTMLButtonElement;
    expect(contactBtn).not.toBeNull();
    expect(contactBtn.textContent).toContain('Admin um Freischaltung bitten');

    cleanUp();
  });

  it('renders contact admin help link on login page', async () => {
    const { container, cleanUp } = mountComponent();
    await nextTick();

    const helpLink = container.querySelector('.help-contact-link') as HTMLButtonElement;
    expect(helpLink).not.toBeNull();
    expect(helpLink.textContent).toContain('Probleme bei Registrierung oder Anmeldung?');

    cleanUp();
  });

  it('hides contact admin buttons and links when contactAdminEnabled is false', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      registrationMode: 'full',
      contactAdminEnabled: false,
    });
    const auth = useAuthStore();
    const errorWithData = new ApiError(403, 'Dieses Konto ist noch nicht freigeschaltet.', {
      data: { unverifiedEmail: true, noMailServer: true },
    });
    vi.spyOn(auth, 'login').mockRejectedValue(errorWithData);

    const { container, cleanUp } = mountComponent();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelector('.help-contact-link')).toBeNull();

    const usernameInput = container.querySelector('#login-username') as HTMLInputElement;
    const passwordInput = container.querySelector('#login-password') as HTMLInputElement;
    usernameInput.value = 'user';
    passwordInput.value = 'pass';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.dispatchEvent(new Event('input'));

    const form = container.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelector('.contact-admin-action')).toBeNull();
    cleanUp();
  });
});
