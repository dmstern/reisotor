// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import Badge from './Badge.vue';

function createTestApp(
  rootComponent: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = { default: () => 'Test Badge' }
) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(rootComponent, props, slots),
  });
  app.use(pinia);
  return app;
}

describe('Badge primitive', () => {
  it('renders default badge with slot text', async () => {
    const app = createTestApp(Badge, { variant: 'primary', size: 'sm' });
    const html = await renderToString(app);
    expect(html).toContain('<span');
    expect(html).toContain('badge--primary');
    expect(html).toContain('badge--size-sm');
    expect(html).toContain('Test Badge');
    expect(html).not.toContain('badge__close-btn');
  });

  it('renders closable badge with integrated close button', async () => {
    const app = createTestApp(Badge, {
      closable: true,
      closeTitle: 'Filter entfernen',
      closeAriaLabel: 'Filter entfernen',
      closeButtonClass: 'custom-close-class',
    });
    const html = await renderToString(app);
    expect(html).toContain('badge--closable');
    expect(html).toContain('<button');
    expect(html).toContain('badge__close-btn');
    expect(html).toContain('custom-close-class');
    expect(html).toContain('aria-label="Filter entfernen"');
    expect(html).toContain('title="Filter entfernen"');
  });

  it('emits close event when close button is clicked', async () => {
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const pinia = createPinia();
    const app = createApp({
      render: () => h(Badge, { closable: true, onClose }, { default: () => 'Klickbar' }),
    });
    app.use(pinia);
    app.mount(container);

    const closeBtn = container.querySelector('.badge__close-btn') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();

    expect(onClose).toHaveBeenCalledTimes(1);

    app.unmount();
    container.remove();
  });
});
