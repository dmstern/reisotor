import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CategoryChip from './CategoryChip.vue';

describe('CategoryChip', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(props: { category: string | null | undefined; iconOnly?: boolean }) {
    const app = createApp({
      render: () => h(CategoryChip, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders category text and accessible attributes by default', async () => {
    const html = await mountComponent({ category: 'Sehenswürdigkeit' });
    expect(html).toContain('Sehenswürdigkeit');
    expect(html).toContain('category-chip-label');
    expect(html).toContain('title="Sehenswürdigkeit"');
    expect(html).not.toContain('is-icon-only');
    expect(html).not.toContain('sr-only');
  });

  it('hides text label visually in iconOnly mode using sr-only while keeping icon and title', async () => {
    const html = await mountComponent({ category: 'Sehenswürdigkeit', iconOnly: true });
    expect(html).toContain('is-icon-only');
    expect(html).toContain('category-chip-label');
    expect(html).toContain('sr-only');
    expect(html).toContain('Sehenswürdigkeit');
    expect(html).toContain('title="Sehenswürdigkeit"');
  });

  it('renders nothing when category is null or undefined', async () => {
    const htmlNull = await mountComponent({ category: null });
    expect(htmlNull).toBe('<!---->');
    const htmlUndefined = await mountComponent({ category: undefined });
    expect(htmlUndefined).toBe('<!---->');
  });

  it('renders expense category chip when type is expense', async () => {
    const app = createApp({
      render: () => h(CategoryChip, { category: 'Essen & Trinken', type: 'expense' }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('Essen &amp; Trinken');
    expect(html).toContain('category-chip');
    expect(html).toContain('--category-color:#e34948');
  });

  it('renders custom category using customMeta', async () => {
    const app = createApp({
      render: () =>
        h(CategoryChip, {
          category: 'Tauchkurs',
          customMeta: {
            label: 'Tauchkurs',
            icon: '🤿',
            color: '#0ea5e9',
            tabler: { id: 'swimming', emoji: '🤿', outline: () => null },
          },
        }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('Tauchkurs');
    expect(html).toContain('--category-color:#0ea5e9');
  });
});
