import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CheckableListItem from './CheckableListItem.vue';

describe('CheckableListItem primitive', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function renderItem(
    props: Record<string, unknown> | null,
    slots?: Record<string, () => unknown>
  ) {
    const app = createApp({
      render: () =>
        h(
          CheckableListItem,
          props,
          slots || {
            default: () => 'Task Title',
          }
        ),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders default item with class checkable-list-item and row', async () => {
    const html = await renderItem(null);
    expect(html).toContain('checkable-list-item');
    expect(html).toContain('row');
    expect(html).toContain('Task Title');
  });

  it('renders done state with checkable-list-item--done and row--done', async () => {
    const html = await renderItem({ done: true });
    expect(html).toContain('checkable-list-item--done');
    expect(html).toContain('row--done');
  });

  it('renders highlighted item with new-highlight and list-item-sparkle badge', async () => {
    const html = await renderItem({ highlighted: true });
    expect(html).toContain('new-highlight');
    expect(html).toContain('checkable-list-item--highlighted');
    expect(html).toContain('list-item-sparkle');
  });

  it('renders focused item with is-focused and checkable-list-item--focused', async () => {
    const html = await renderItem({ focused: true });
    expect(html).toContain('is-focused');
    expect(html).toContain('checkable-list-item--focused');
  });

  it('renders actions slot when provided', async () => {
    const html = await renderItem(null, {
      default: () => 'Task Title',
      actions: () => h('button', 'Delete'),
    });
    expect(html).toContain('row-actions');
    expect(html).toContain('Delete');
  });
});
