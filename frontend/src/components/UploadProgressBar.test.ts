import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import UploadProgressBar from './UploadProgressBar.vue';

function createTestApp(props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(UploadProgressBar, props),
  });
  app.use(pinia);
  return app;
}

describe('UploadProgressBar component', () => {
  it('renders progress text for multiple files and calculates percent', async () => {
    const app = createTestApp({
      current: 2,
      total: 5,
      progressPercent: 40,
      filename: 'urlaub.jpg',
    });
    const html = await renderToString(app);

    expect(html).toContain('Lade 2 von 5 Dateien hoch… (40%)');
    expect(html).toContain('urlaub.jpg');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain('Abbrechen');
  });

  it('renders progress text for single file', async () => {
    const app = createTestApp({
      current: 1,
      total: 1,
      progressPercent: 85,
    });
    const html = await renderToString(app);

    expect(html).toContain('Lade Datei hoch… (85%)');
    expect(html).toContain('aria-valuenow="85"');
  });

  it('calculates progressPercent automatically from current and total if not provided', async () => {
    const app = createTestApp({
      current: 1,
      total: 2,
    });
    const html = await renderToString(app);

    expect(html).toContain('Lade 1 von 2 Dateien hoch… (50%)');
    expect(html).toContain('aria-valuenow="50"');
  });

  it('hides cancel button when cancellable is false', async () => {
    const app = createTestApp({
      current: 1,
      total: 1,
      cancellable: false,
    });
    const html = await renderToString(app);

    expect(html).not.toContain('Abbrechen');
  });

  it('renders error message when error is provided', async () => {
    const app = createTestApp({
      current: 1,
      total: 1,
      error: 'Verbindungsabbruch',
    });
    const html = await renderToString(app);

    expect(html).toContain('has-error');
    expect(html).toContain('Verbindungsabbruch');
  });
});
