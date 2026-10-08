// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { renderToString } from 'vue/server-renderer';
import DashboardTile from './DashboardTile.vue';
import { SECTION_ICON_DEFS } from '../../utils/sectionIcons';

describe('DashboardTile', () => {
  function renderTile(props: Record<string, unknown>, slotContent = 'Tile Content') {
    const pinia = createPinia();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/test', component: { template: '<div>Test</div>' } },
      ],
    });
    const app = createApp({
      render: () => h(DashboardTile, props as never, () => slotContent),
    });
    app.use(pinia);
    app.use(router);
    return renderToString(app);
  }

  it('renders button element when no "to" prop is passed', async () => {
    const html = await renderTile({
      color: '#4a90e2',
      icon: SECTION_ICON_DEFS.calendar,
      title: 'Kalender',
    });
    expect(html).toContain('<button');
    expect(html).toContain('tile-btn');
    expect(html).toContain('Kalender');
    expect(html).toContain('Tile Content');
  });

  it('renders router-link anchor when "to" prop is passed', async () => {
    const html = await renderTile({
      to: '/test',
      color: '#27ae60',
      icon: SECTION_ICON_DEFS.packing,
      title: 'Packliste',
    });
    expect(html).toContain('<a');
    expect(html).toContain('href="/test"');
    expect(html).toContain('Packliste');
    expect(html).toContain('Tile Content');
  });

  it('applies color styles for background and border', async () => {
    const html = await renderTile({
      color: '#ff5500',
      icon: SECTION_ICON_DEFS.notes,
      title: 'Notizen',
    });
    expect(html).toContain('background:#ff55000d');
    expect(html).toContain('border-color:#ff5500');
  });
});
