import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import IconButton from './IconButton.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

function createTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  return app;
}

describe('IconButton primitive', () => {
  it('renders a button with icon-only and ghost variant by default', async () => {
    const app = createTestApp(IconButton, {
      icon: ACTION_ICONS.close,
      title: 'Schließen',
      ariaLabel: 'Schließen',
    });
    const html = await renderToString(app);
    expect(html).toContain('<button');
    expect(html).toContain('btn--icon-only');
    expect(html).toContain('icon-btn');
    expect(html).toContain('aria-label="Schließen"');
    expect(html).toContain('title="Schließen"');
  });

  it('renders with circle shape when shape="circle" is specified', async () => {
    const app = createTestApp(IconButton, { icon: ACTION_ICONS.close, shape: 'circle' });
    const html = await renderToString(app);
    expect(html).toContain('btn--circle');
  });

  it('preserves additional classes passed to IconButton', async () => {
    const app = createTestApp(IconButton, { icon: ACTION_ICONS.close, class: 'close-btn' });
    const html = await renderToString(app);
    expect(html).toContain('close-btn');
    expect(html).toContain('icon-btn');
  });
});
