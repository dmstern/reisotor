import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CollapsibleFieldset from './CollapsibleFieldset.vue';

function createTestApp(
  rootComponent: Component,
  props: Record<string, unknown> = {},
  slots?: Record<string, unknown>
) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(rootComponent, props, slots),
  });
  app.use(pinia);
  return app;
}

describe('CollapsibleFieldset primitive', () => {
  it('renders closed by default with proper aria attributes', async () => {
    const app = createTestApp(
      CollapsibleFieldset,
      { label: 'Optionale Angaben' },
      {
        default: () => h('div', 'Content inside'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('collapsible-fieldset');
    expect(html).toContain('is-closed');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('Optionale Angaben');
    expect(html).toContain('Content inside');
  });

  it('renders open when openInitial is true', async () => {
    const app = createTestApp(
      CollapsibleFieldset,
      { label: 'Touren zuordnen', openInitial: true },
      {
        default: () => h('div', 'Excursion list'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('is-open');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-hidden="false"');
    expect(html).toContain('Excursion list');
  });

  it('renders count badge when provided', async () => {
    const app = createTestApp(
      CollapsibleFieldset,
      { label: 'Spots zuordnen', count: '(3 ausgewählt)' },
      {
        default: () => h('div', 'Spots'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('picker-count');
    expect(html).toContain('(3 ausgewählt)');
  });

  it('respects controlled open / modelValue prop', async () => {
    const app = createTestApp(
      CollapsibleFieldset,
      { label: 'Controlled', modelValue: true },
      {
        default: () => h('div', 'Inner'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('is-open');
    expect(html).toContain('aria-expanded="true"');
  });

  it('renders custom slots for label and count', async () => {
    const app = createTestApp(
      CollapsibleFieldset,
      {},
      {
        label: () => h('span', { class: 'custom-label' }, 'Custom Title'),
        count: () => h('span', { class: 'custom-count' }, '99 Items'),
        default: () => h('p', 'Slot content'),
      }
    );
    const html = await renderToString(app);
    expect(html).toContain('custom-label');
    expect(html).toContain('Custom Title');
    expect(html).toContain('custom-count');
    expect(html).toContain('99 Items');
    expect(html).toContain('Slot content');
  });
});
