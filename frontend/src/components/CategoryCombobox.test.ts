import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CategoryCombobox from './CategoryCombobox.vue';

describe('CategoryCombobox', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function render(props: Record<string, unknown>) {
    const app = createApp({
      render: () => h(CategoryCombobox, props as any),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders with expense defaults and leading icon when value matches', async () => {
    const html = await render({
      modelValue: 'Unterkunft',
      type: 'expense',
    });
    expect(html).toContain('has-leading-icon');
    expect(html).toContain('combobox-leading-icon');
    expect(html).toContain('placeholder="Kategorie (z. B. Essen &amp; Trinken, Unterkunft)"');
  });

  it('renders spot category defaults when type="spot"', async () => {
    const html = await render({
      modelValue: 'Restaurant',
      type: 'spot',
    });
    expect(html).toContain('has-leading-icon');
    expect(html).toContain('placeholder="Kategorie (z. B. Restaurant – oder eigene erstellen)"');
  });
});
