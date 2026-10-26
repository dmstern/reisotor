// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import AdminResetPasswordModal from './AdminResetPasswordModal.vue';
import type { User, AdminResetPasswordResult } from '../api/types';

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

describe('AdminResetPasswordModal', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  const mockUser: User = {
    id: 42,
    username: 'testuser',
    avatar: '🙂',
    email: 'test@example.com',
  };

  it('renders reset form with auto and custom option when result is null', async () => {
    const onReset = vi.fn();
    const { cleanUp } = mountTestApp(AdminResetPasswordModal, {
      modelValue: true,
      user: mockUser,
      result: null,
      loading: false,
      onReset,
    });
    await nextTick();

    expect(document.body.textContent).toContain('Passwort zurücksetzen – testuser');
    expect(document.body.textContent).toContain('Zufälliges Passwort automatisch generieren');

    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Passwort jetzt zurücksetzen')
    );
    expect(submitBtn).toBeTruthy();
    submitBtn?.click();
    await nextTick();

    expect(onReset).toHaveBeenCalledWith();

    cleanUp();
  });

  it('renders result with temporary password and reset link when result is provided', async () => {
    const mockResult: AdminResetPasswordResult = {
      temporaryPassword: 'TempPass1234!',
      resetUrl: 'https://reise.ruebenherz.de/reset-password?token=secret123',
      emailSent: true,
      username: 'testuser',
      message: 'Erfolgreich',
    };

    const onClose = vi.fn();
    const { cleanUp } = mountTestApp(AdminResetPasswordModal, {
      modelValue: true,
      user: mockUser,
      result: mockResult,
      loading: false,
      onClose,
    });
    await nextTick();

    expect(document.body.textContent).toContain('Das Passwort wurde erfolgreich zurückgesetzt.');
    expect(document.body.textContent).toContain('TempPass1234!');
    expect(document.body.textContent).toContain(
      'https://reise.ruebenherz.de/reset-password?token=secret123'
    );
    expect(document.body.textContent).toContain('Eine E-Mail mit dem Reset-Link wurde direkt');

    const doneBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Fertig')
    );
    expect(doneBtn).toBeTruthy();
    doneBtn?.click();
    await nextTick();

    expect(onClose).toHaveBeenCalled();

    cleanUp();
  });
});
