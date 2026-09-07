/**
 * @vitest-environment jsdom
 */
/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import Button from './Button.vue';

describe('Button primitive', () => {
  it('renders a button element by default', () => {
    const app = createApp({
      render: () => h(Button, null, () => 'Click me'),
    });
    const el = document.createElement('div');
    app.mount(el);
    const btn = el.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim()).toBe('Click me');
    expect(btn?.classList.contains('btn')).toBe(true);
    expect(btn?.classList.contains('btn--primary')).toBe(true);
  });

  it('renders an anchor tag when href is passed', () => {
    const app = createApp({
      render: () => h(Button, { href: 'https://example.com' }, () => 'Link'),
    });
    const el = document.createElement('div');
    app.mount(el);
    const a = el.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://example.com');
  });

  it('renders a router-link (anchor tag) when to is passed', async () => {
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
    const el = document.createElement('div');
    app.mount(el);

    const link = el.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/trash');
    expect(link?.classList.contains('btn--card-action')).toBe(true);
  });
});
