import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import Alert from './Alert.vue';
import Button from './Button.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

describe('Alert primitive', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  function renderAlert(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(Alert, props, slots),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders with default info variant and size md', async () => {
    const html = await renderAlert({}, { default: () => 'Hinweistext' });
    expect(html).toContain('alert');
    expect(html).toContain('alert--info');
    expect(html).toContain('alert--md');
    expect(html).toContain('Hinweistext');
  });

  it('renders all variants correctly', async () => {
    for (const variant of ['warning', 'danger', 'success', 'info', 'neutral'] as const) {
      const html = await renderAlert({ variant }, { default: () => `Text für ${variant}` });
      expect(html).toContain(`alert--${variant}`);
    }
  });

  it('renders size sm when specified', async () => {
    const html = await renderAlert({ size: 'sm' }, { default: () => 'Kompakter Text' });
    expect(html).toContain('alert--sm');
  });

  it('renders title and description', async () => {
    const html = await renderAlert({
      title: 'Wichtiger Hinweis',
      description: 'Bitte rechtzeitig da sein.',
    });
    expect(html).toContain('Wichtiger Hinweis');
    expect(html).toContain('Bitte rechtzeitig da sein.');
  });

  it('omits icon when icon is false', async () => {
    const html = await renderAlert({ icon: false }, { default: () => 'Kein Icon' });
    expect(html).not.toContain('alert__icon');
  });

  it('renders actions slot with button', async () => {
    const html = await renderAlert(
      { variant: 'warning' },
      {
        default: () => 'Zeitdifferenz erkannt',
        actions: () => h(Button, { size: 'sm', variant: 'secondary' }, () => 'Synchronisieren'),
      }
    );
    expect(html).toContain('alert__actions');
    expect(html).toContain('btn--sm');
    expect(html).toContain('Synchronisieren');
  });

  it('supports custom icon prop', async () => {
    const html = await renderAlert(
      { icon: ACTION_ICONS.sparkles },
      { default: () => 'Glitzer-Meldung' }
    );
    expect(html).toContain('alert__icon');
    expect(html).toContain('Glitzer-Meldung');
  });
});
