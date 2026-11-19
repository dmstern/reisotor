// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { renderToString } from 'vue/server-renderer';
import LinkedEntityButton from './LinkedEntityButton.vue';
import { SECTION_ICON_DEFS } from '../../utils/sectionIcons';
import { ACTION_ICONS } from '../../utils/actionIcons';

describe('LinkedEntityButton primitive', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders pill button with icon badge, label and arrow', async () => {
    const app = createApp({
      render: () =>
        h(LinkedEntityButton, {
          label: 'Sonnenuntergang am Meer',
          icon: SECTION_ICON_DEFS.diary,
          iconGroup: 'navigation',
        }),
    });
    app.use(createPinia());

    const html = await renderToString(app);
    expect(html).toContain('btn--linked-entity');
    expect(html).toContain('btn--pill');
    expect(html).toContain('linked-entity-button');
    expect(html).toContain('linked-entity-badge');
    expect(html).toContain('linked-entity-label');
    expect(html).toContain('linked-entity-arrow');
    expect(html).toContain('Sonnenuntergang am Meer');
    expect(html).toContain('tabler-icon-notebook');
    expect(html).toContain('tabler-icon-arrow-right');
  });

  it('renders round cover thumbnail when imageUrl is provided instead of icon', async () => {
    const app = createApp({
      render: () =>
        h(LinkedEntityButton, {
          label: 'Bootstour',
          icon: SECTION_ICON_DEFS.excursions,
          iconGroup: 'navigation',
          imageUrl: '/api/uploads/boat.jpg',
        }),
    });
    app.use(createPinia());

    const html = await renderToString(app);
    expect(html).toContain('has-image');
    expect(html).toContain('/api/uploads/boat.jpg');
    expect(html).not.toContain('tabler-icon-backpack');
    expect(html).toContain('tabler-icon-arrow-right');
  });

  it('renders warning state and #badge slot content', async () => {
    const app = createApp({
      render: () =>
        h(
          LinkedEntityButton,
          {
            label: 'Küstentour',
            icon: SECTION_ICON_DEFS.excursions,
            iconGroup: 'navigation',
            warning: true,
          },
          {
            badge: () => h('span', { class: 'custom-mismatch' }, '18.11'),
          }
        ),
    });
    app.use(createPinia());

    const html = await renderToString(app);
    expect(html).toContain('is-warning');
    expect(html).toContain('custom-mismatch');
    expect(html).toContain('18.11');
  });

  it('supports default slot and router link rendering', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/diary', component: { template: '<div>Diary</div>' } }],
    });
    await router.push('/diary');
    await router.isReady();

    const app = createApp({
      render: () =>
        h(
          LinkedEntityButton,
          {
            icon: ACTION_ICONS.recordStart,
            iconGroup: 'actions',
            to: '/diary',
          },
          {
            default: () => 'GPS Track Alpha',
          }
        ),
    });
    app.use(createPinia());
    app.use(router);

    const html = await renderToString(app);
    expect(html).toContain('<a');
    expect(html).toContain('href="/diary"');
    expect(html).toContain('GPS Track Alpha');
  });
});
