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

  it('renders result with temporary password, auto-copies to clipboard, and copies on button click', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

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

    // Auto-copy triggered when result was provided
    expect(writeTextMock).toHaveBeenCalledWith('TempPass1234!');

    const copyBtns = Array.from(document.querySelectorAll('.copy-btn')) as HTMLButtonElement[];
    expect(copyBtns.length).toBe(2);

    // Click link copy button
    copyBtns[1].click();
    await nextTick();
    expect(writeTextMock).toHaveBeenCalledWith(
      'https://reise.ruebenherz.de/reset-password?token=secret123'
    );

    const doneBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Fertig')
    );
    expect(doneBtn).toBeTruthy();
    doneBtn?.click();
    await nextTick();

    expect(onClose).toHaveBeenCalled();

    cleanUp();
  });

  it('does not copy to clipboard or write undefined when result has no temporary password', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const mockResult = {
      temporaryPassword: '',
      resetUrl: '',
      emailSent: false,
      username: 'testuser',
      message: 'Erfolgreich',
    } as unknown as AdminResetPasswordResult;

    const { cleanUp } = mountTestApp(AdminResetPasswordModal, {
      modelValue: true,
      user: mockUser,
      result: mockResult,
      loading: false,
    });
    await nextTick();

    expect(writeTextMock).not.toHaveBeenCalled();

    const copyBtns = Array.from(document.querySelectorAll('.copy-btn')) as HTMLButtonElement[];
    expect(copyBtns[0].disabled).toBe(true);
    expect(copyBtns[1].disabled).toBe(true);

    cleanUp();
  });
});
