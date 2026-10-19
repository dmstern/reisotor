// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import CopyButton from './CopyButton.vue';
import * as toastModule from '../../composables/useToast';

describe('CopyButton', () => {
  const showToastMock = vi.fn();

  function mountCopyButton(props: Record<string, unknown> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const pinia = createPinia();
    const app = createApp({
      render: () => h(CopyButton as unknown as Component, props),
    });
    app.use(pinia);
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(toastModule, 'useToast').mockReturnValue({
      showToast: showToastMock,
      toasts: { value: [] },
      removeToast: vi.fn(),
      clearAllToasts: vi.fn(),
    } as unknown as ReturnType<typeof toastModule.useToast>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with default label, title and size', () => {
    const { container, cleanUp } = mountCopyButton({
      text: 'Musterstraße 123, 10115 Berlin',
    });

    const btn = container.querySelector('button.copy-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('In die Zwischenablage kopieren');
    expect(btn.getAttribute('title')).toBe('In die Zwischenablage kopieren');
    expect(btn.classList.contains('copy-btn--sm')).toBe(true);
    expect(btn.classList.contains('copy-btn--hover-only')).toBe(true);
    expect(btn.classList.contains('is-copied')).toBe(false);

    cleanUp();
  });

  it('copies text using navigator.clipboard, shows toast and marks button as copied', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const onCopy = vi.fn();
    const { container, cleanUp } = mountCopyButton({
      text: 'Bahnhofstraße 5',
      label: 'Adresse kopieren',
      toastMessage: 'Adresse in die Zwischenablage kopiert.',
      onCopy,
    });

    const btn = container.querySelector('button.copy-btn') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await nextTick();

    expect(writeTextMock).toHaveBeenCalledWith('Bahnhofstraße 5');
    expect(showToastMock).toHaveBeenCalledWith({
      message: 'Adresse in die Zwischenablage kopiert.',
      type: 'success',
    });
    expect(onCopy).toHaveBeenCalledWith('Bahnhofstraße 5');

    // Button should now be in copied state
    expect(btn.classList.contains('is-copied')).toBe(true);
    expect(btn.getAttribute('aria-label')).toBe('Kopiert!');
    expect(btn.getAttribute('title')).toBe('Kopiert!');

    // After 2000ms timeout, state should reset
    vi.advanceTimersByTime(2000);
    await Promise.resolve();
    await nextTick();

    expect(btn.classList.contains('is-copied')).toBe(false);
    expect(btn.getAttribute('aria-label')).toBe('Adresse kopieren');

    vi.useRealTimers();
    cleanUp();
  });

  it('falls back to document.execCommand when navigator.clipboard is not available', async () => {
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommandSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandSpy;
    const onCopy = vi.fn();

    const { container, cleanUp } = mountCopyButton({
      text: 'Fallbackstraße 1',
      toastMessage: 'Fallback kopiert.',
      onCopy,
    });

    const btn = container.querySelector('button.copy-btn') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await nextTick();

    expect(execCommandSpy).toHaveBeenCalledWith('copy');
    expect(showToastMock).toHaveBeenCalledWith({
      message: 'Fallback kopiert.',
      type: 'success',
    });
    expect(onCopy).toHaveBeenCalledWith('Fallbackstraße 1');

    Object.assign(navigator, { clipboard: originalClipboard });
    cleanUp();
  });

  it('respects hoverOnly=false and size="md"', () => {
    const { container, cleanUp } = mountCopyButton({
      text: 'Test',
      hoverOnly: false,
      size: 'md',
    });

    const btn = container.querySelector('button.copy-btn') as HTMLButtonElement;
    expect(btn.classList.contains('copy-btn--md')).toBe(true);
    expect(btn.classList.contains('copy-btn--hover-only')).toBe(false);

    cleanUp();
  });
});
