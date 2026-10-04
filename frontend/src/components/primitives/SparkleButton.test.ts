// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import SparkleButton from './SparkleButton.vue';

function mountSparkle(props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const pinia = createPinia();
  const app = createApp({
    render: () => h(SparkleButton as unknown as Component, props),
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

describe('SparkleButton primitive', () => {
  it('renders button with sparkle icon and title/aria-label', () => {
    const { container, cleanUp } = mountSparkle({
      title: 'Vorschlag generieren',
      dataTestid: 'sparkle-btn',
    });
    const btn = container.querySelector('[data-testid="sparkle-btn"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('title')).toBe('Vorschlag generieren');
    expect(btn.getAttribute('aria-label')).toBe('Vorschlag generieren');
    expect(btn.querySelector('.app-icon')).toBeTruthy();
    cleanUp();
  });

  it('renders loading state with spinning class and disabled attribute', () => {
    const { container, cleanUp } = mountSparkle({
      loading: true,
      dataTestid: 'sparkle-btn',
    });
    const btn = container.querySelector('[data-testid="sparkle-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains('is-loading')).toBe(true);
    expect(btn.querySelector('.sparkle-spin')).toBeTruthy();
    cleanUp();
  });

  it('applies variant classes and custom classes', () => {
    const { container, cleanUp } = mountSparkle({
      variant: 'address',
      class: 'custom-sparkle',
      dataTestid: 'sparkle-btn',
    });
    const btn = container.querySelector('[data-testid="sparkle-btn"]') as HTMLButtonElement;
    expect(btn.classList.contains('sparkle-suggest-btn--address')).toBe(true);
    expect(btn.classList.contains('custom-sparkle')).toBe(true);
    cleanUp();
  });

  it('handles click events when not disabled', () => {
    const onClick = vi.fn();
    const { container, cleanUp } = mountSparkle({
      dataTestid: 'sparkle-btn',
      onClick,
    });
    const btn = container.querySelector('[data-testid="sparkle-btn"]') as HTMLButtonElement;
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    cleanUp();
  });
});
