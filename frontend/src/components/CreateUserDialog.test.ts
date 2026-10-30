// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import CreateUserDialog, { STORAGE_KEY_REMEMBER_ROLE } from './CreateUserDialog.vue';
import { api } from '../api/client';

function mountTestApp(
  rootComponent: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props, slots),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('CreateUserDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders role dropdown defaulting to Basis-Konto', async () => {
    const { cleanUp } = mountTestApp(CreateUserDialog, { modelValue: true });
    await nextTick();

    const select = document.querySelector('#create-role') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('restricted');

    const hint = document.querySelector('.create-user-form .hint');
    expect(hint).not.toBeNull();
    cleanUp();
  });

  it('restores remembered role from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY_REMEMBER_ROLE, 'plus');
    const { cleanUp } = mountTestApp(CreateUserDialog, { modelValue: true });
    await nextTick();

    const select = document.querySelector('#create-role') as HTMLSelectElement;
    expect(select.value).toBe('plus');

    const rememberCheckbox = document.querySelector('#create-remember-role') as HTMLInputElement;
    expect(rememberCheckbox.checked).toBe(true);
    cleanUp();
  });

  it('submits selected role and saves to localStorage when rememberRole is active', async () => {
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({
      id: 99,
      username: 'new_plus_user',
      avatar: '🙂',
      is_admin: false,
      is_restricted: false,
    });

    const { cleanUp } = mountTestApp(CreateUserDialog, { modelValue: true });
    await nextTick();

    const usernameInput = document.querySelector('#create-username') as HTMLInputElement;
    const passwordInput = document.querySelector('#create-password') as HTMLInputElement;
    const select = document.querySelector('#create-role') as HTMLSelectElement;
    const rememberCheckbox = document.querySelector('#create-remember-role') as HTMLInputElement;

    usernameInput.value = 'new_plus_user';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'secret123';
    passwordInput.dispatchEvent(new Event('input'));

    select.value = 'plus';
    select.dispatchEvent(new Event('change'));

    rememberCheckbox.checked = true;
    rememberCheckbox.dispatchEvent(new Event('change'));
    await nextTick();

    const form = document.querySelector('.create-user-form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await nextTick();

    expect(postSpy).toHaveBeenCalledWith('/users', {
      username: 'new_plus_user',
      email: undefined,
      password: 'secret123',
      avatar: '🙂',
      role: 'plus',
      is_admin: false,
      is_restricted: false,
    });

    expect(localStorage.getItem(STORAGE_KEY_REMEMBER_ROLE)).toBe('plus');
    cleanUp();
  });
});
