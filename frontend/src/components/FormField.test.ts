/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import FormField from './FormField.vue';

describe('FormField component', () => {
  it('renders regular label without asterisk when not required', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Notiz' }),
    });
    const html = await renderToString(app);
    expect(html).toContain('Notiz');
    expect(html).not.toContain('required-indicator');
    expect(html).not.toContain('*');
  });

  it('renders asterisk indicator when required is true', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Titel', required: true }),
    });
    const html = await renderToString(app);
    expect(html).toContain('Titel');
    expect(html).toContain('required-indicator');
    expect(html).toContain('*');
  });

  it('renders asterisk indicator and trims label when label ends with an asterisk', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Titel *' }),
    });
    const html = await renderToString(app);
    expect(html).toContain('Titel');
    expect(html).toContain('required-indicator');
    expect(html).toContain('*');
    // Ensure displayLabel did not retain the literal trailing asterisk in the text node
    expect(html).not.toContain('Titel *');
  });
});
