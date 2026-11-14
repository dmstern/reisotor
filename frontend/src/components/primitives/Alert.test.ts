// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import Alert from './Alert.vue';
import Button from './Button.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { useErrorNotifier } from '../../composables/useErrorNotifier';

describe('Alert primitive', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const pinia = createPinia();
    setActivePinia(pinia);
    useErrorNotifier().clearErrors();
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

  it('renders reportable alert as a button and opens ErrorDetailModal on click', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(Alert, {
          variant: 'danger',
          size: 'sm',
          reportable: true,
          description: 'Drittanbieter antwortet nicht',
          errorContext: 'Wetterdienst',
        }),
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const btn = container.querySelector('button.alert--reportable') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain('Drittanbieter antwortet nicht');
    expect(btn?.textContent).toContain('Fehlerdetails anzeigen & melden');

    btn!.click();
    await nextTick();

    const { isErrorModalOpen, activeError } = useErrorNotifier();
    expect(isErrorModalOpen.value).toBe(true);
    expect(activeError.value?.summary).toContain('Wetterdienst');
    expect(activeError.value?.rawMessage).toContain('Drittanbieter antwortet nicht');

    app.unmount();
    container.remove();
  });

  it('renders separate report trigger inside content when actions slot is also present', async () => {
    const html = await renderAlert(
      {
        variant: 'danger',
        reportable: true,
        description: 'Sync fehlgeschlagen',
      },
      {
        actions: () => h(Button, { size: 'sm' }, () => 'Erneut versuchen'),
      }
    );

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('alert__report-btn');
    expect(html).toContain('Erneut versuchen');
  });
});
