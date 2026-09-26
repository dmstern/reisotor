// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LoginView from './LoginView.vue';
import { useAuthStore } from '../stores/auth';
import { ApiError } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ registrationMode: 'full' }),
    post: vi.fn(),
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
});
