/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { renderToString } from 'vue/server-renderer';
import Button from './Button.vue';

describe('Button primitive', () => {
  it('renders a button element by default', async () => {
    const app = createApp({
      render: () => h(Button, null, () => 'Click me'),
    });
    const html = await renderToString(app);
    expect(html).toContain('<button');
    expect(html).toContain('Click me');
    expect(html).toContain('btn');
    expect(html).toContain('btn--primary');
  });

  it('renders an anchor tag when href is passed', async () => {
    const app = createApp({
      render: () => h(Button, { href: 'https://example.com' }, () => 'Link'),
    });
    const html = await renderToString(app);
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('Link');
  });

  it('renders a router-link (anchor tag with href) when to is passed', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/trash', component: { template: '<div>Trash</div>' } }],
    });
    await router.push('/trash');
    await router.isReady();

    const app = createApp({
      render: () => h(Button, { to: '/trash', variant: 'card-action' }, () => 'Papierkorb öffnen'),
    });
    app.use(router);

    const html = await renderToString(app);
    expect(html).toContain('<a');
    expect(html).toContain('href="/trash"');
    expect(html).toContain('btn--card-action');
    expect(html).toContain('Papierkorb öffnen');
  });
});
