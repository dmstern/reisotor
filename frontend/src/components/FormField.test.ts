/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import FormField from './FormField.vue';

describe('FormField component', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders regular label without asterisk when not required', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Notiz' }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('Notiz');
    expect(html).not.toContain('required-indicator');
    expect(html).not.toContain('*');
  });

  it('renders asterisk indicator when required is true', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Titel', required: true }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('Titel');
    expect(html).toContain('required-indicator');
    expect(html).toContain('*');
  });

  it('renders asterisk indicator and trims label when label ends with an asterisk', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Titel *' }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('Titel');
    expect(html).toContain('required-indicator');
    expect(html).toContain('*');
    // Ensure displayLabel did not retain the literal trailing asterisk in the text node
    expect(html).not.toContain('Titel *');
  });

  it('renders error hint when error prop is provided', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Titel', error: 'Dieses Feld ist erforderlich' }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('field-error-hint');
    expect(html).toContain('Dieses Feld ist erforderlich');
    expect(html).toContain('has-error');
  });

  it('adds has-error class when invalid prop is true', async () => {
    const app = createApp({
      render: () => h(FormField, { label: 'Titel', invalid: true }),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('has-error');
  });
});
