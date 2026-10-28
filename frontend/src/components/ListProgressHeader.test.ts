import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ListProgressHeader from './ListProgressHeader.vue';

describe('ListProgressHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function renderHeader(props: any, slots?: any) {
    const app = createApp({
      render: () => h(ListProgressHeader, props, slots),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders title, counts, and default completed label', async () => {
    const html = await renderHeader({
      title: 'ToDo',
      total: 10,
      completed: 4,
    });

    expect(html).toContain('ToDo');
    expect(html).toContain('4/10 erledigt');
    expect(html).toContain('40%');
  });

  it('renders custom completed label and handles 100% completion', async () => {
    const html = await renderHeader({
      title: 'Packliste',
      total: 5,
      completed: 5,
      completedLabel: 'gepackt',
    });

    expect(html).toContain('Packliste');
    expect(html).toContain('5/5 gepackt');
    expect(html).toContain('100%');
  });

  it('renders actions slot when provided', async () => {
    const html = await renderHeader(
      {
        title: 'Shopping',
        total: 0,
        completed: 0,
      },
      {
        actions: () => h('button', { class: 'test-action' }, 'Settings'),
      }
    );

    expect(html).toContain('test-action');
    expect(html).toContain('Settings');
  });
});
