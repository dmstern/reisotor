/* eslint-disable vue/one-component-per-file */
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { renderToString } from 'vue/server-renderer';
import Button from './Button.vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

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

  it('renders btn--danger and btn--secondary when secondary is true with variant danger', async () => {
    const app = createApp({
      render: () => h(Button, { variant: 'danger', secondary: true }, () => 'Löschen'),
    });
    const html = await renderToString(app);
    expect(html).toContain('btn--danger');
    expect(html).toContain('btn--secondary');
  });

  it('renders btn--card-action and btn--sm when size="sm" is passed with variant="card-action"', async () => {
    const app = createApp({
      render: () => h(Button, { variant: 'card-action', size: 'sm' }, () => 'Auf Karte'),
    });
    const html = await renderToString(app);
    expect(html).toContain('btn--card-action');
    expect(html).toContain('btn--sm');
    expect(html).toContain('Auf Karte');
  });

  it('renders filled icon variant when button is active and icon has filled variant', async () => {
    setActivePinia(createPinia());
    const app = createApp({
      render: () =>
        h(Button, { active: true }, () => [
          h(AppIcon, { icon: ACTION_ICONS.today, group: 'actions' }),
          'Heute',
        ]),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('tabler-icon-calendar-event-filled');
    expect(html).toContain('Heute');
  });

  it('renders outline icon variant when button is not active', async () => {
    setActivePinia(createPinia());
    const app = createApp({
      render: () =>
        h(Button, { active: false }, () => [
          h(AppIcon, { icon: ACTION_ICONS.today, group: 'actions' }),
          'Heute',
        ]),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('tabler-icon-calendar-event');
    expect(html).not.toContain('tabler-icon-calendar-event-filled');
  });

  it('gracefully falls back to outline for icons without filled variant (such as vacation) even when button is active', async () => {
    setActivePinia(createPinia());
    const app = createApp({
      render: () =>
        h(Button, { active: true }, () => [
          h(AppIcon, { icon: ACTION_ICONS.vacation, group: 'actions' }),
          'Urlaub',
        ]),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('tabler-icon-beach');
    expect(html).toContain('Urlaub');
  });

  it('renders LoadingSpinner and disables button when loading is true', async () => {
    const app = createApp({
      render: () => h(Button, { loading: true }, () => 'Speichern'),
    });
    const html = await renderToString(app);
    expect(html).toContain('is-loading');
    expect(html).toContain('disabled');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('spinner');
    expect(html).toContain('btn-spinner');
    expect(html).toContain('Speichern');
  });
});
