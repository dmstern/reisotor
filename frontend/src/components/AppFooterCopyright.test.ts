import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import AppFooterCopyright from './AppFooterCopyright.vue';

describe('AppFooterCopyright', () => {
  it('renders copyright year, author, license and tagline', async () => {
    const app = createApp({
      render: () =>
        h(AppFooterCopyright, {
          repoUrl: 'https://github.com/dmstern/reisotor',
        }),
    });
    const html = await renderToString(app);

    const year = new Date().getFullYear().toString();
    expect(html).toContain(year);
    expect(html).toContain('Daniel Morgenstern');
    expect(html).toContain('EUPL-1.2');
    expect(html).toContain('https://github.com/dmstern/reisotor/blob/main/LICENSE');
    expect(html).toContain('Made with love, coffee and AI');
    expect(html).toContain('copyright-group');
    expect(html).toContain('sep sep-break');
  });

  it('renders hosting location when provided', async () => {
    const app = createApp({
      render: () =>
        h(AppFooterCopyright, {
          repoUrl: 'https://github.com/dmstern/reisotor',
          hostingLocation: 'Berlin',
        }),
    });
    const html = await renderToString(app);

    expect(html).toContain('gehostet in Berlin');
  });

  it('omits hosting location when not provided', async () => {
    const app = createApp({
      render: () =>
        h(AppFooterCopyright, {
          repoUrl: 'https://github.com/dmstern/reisotor',
        }),
    });
    const html = await renderToString(app);

    expect(html).not.toContain('gehostet in');
  });
});
