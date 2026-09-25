import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import Combobox from './Combobox.vue';
import { expenseCategoryMeta } from '../utils/expenseCategory';

describe('Combobox', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function render(props: Record<string, unknown>) {
    const app = createApp({
      render: () => h(Combobox, props as any),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders input without leading icon when modelValue is empty', async () => {
    const html = await render({
      modelValue: '',
      options: ['Unterkunft', 'Transport'],
      iconDefFor: (c: string) => expenseCategoryMeta(c).tabler,
      colorFor: (c: string) => expenseCategoryMeta(c).color,
      placeholder: 'Kategorie auswählen',
    });
    expect(html).toContain('placeholder="Kategorie auswählen"');
    expect(html).not.toContain('has-leading-icon');
    expect(html).not.toContain('combobox-leading-icon');
  });

  it('renders leading icon when modelValue is present and matched', async () => {
    const html = await render({
      modelValue: 'Unterkunft',
      options: ['Unterkunft', 'Transport'],
      iconDefFor: (c: string) => expenseCategoryMeta(c).tabler,
      colorFor: (c: string) => expenseCategoryMeta(c).color,
      placeholder: 'Kategorie auswählen',
    });
    expect(html).toContain('has-leading-icon');
    expect(html).toContain('combobox-leading-icon');
    expect(html).toContain('app-icon');
  });

  it('renders icon with custom color if provided', async () => {
    const html = await render({
      modelValue: 'Unterkunft',
      options: ['Unterkunft'],
      iconDefFor: (c: string) => expenseCategoryMeta(c).tabler,
      colorFor: () => '#1baf7a',
    });
    expect(html).toMatch(/color:\s*#1baf7a/);
  });
});
