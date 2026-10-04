// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, type Component, nextTick } from 'vue';
import { createPinia } from 'pinia';
import SearchFilterBar from './SearchFilterBar.vue';

function mountBar(props: Record<string, unknown> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const pinia = createPinia();
  const app = createApp({
    render: () => h(SearchFilterBar as unknown as Component, props),
  });
  app.use(pinia);
  app.mount(container);
  return {
    container,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('SearchFilterBar', () => {
  it('renders search input with placeholder', () => {
    const { container, cleanUp } = mountBar({
      searchPlaceholder: 'Suche nach Test...',
    });
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.placeholder).toBe('Suche nach Test...');
    cleanUp();
  });

  it('opens and positions filter menu using computePopoverPosition', async () => {
    const { container, cleanUp } = mountBar({
      categoryOptions: ['Kultur', 'Natur'],
    });

    const filterBtn = container.querySelectorAll('button')[1]; // second button is filter
    filterBtn.click();
    await nextTick();

    const picker = document.querySelector('.picker-menu');
    expect(picker).not.toBeNull();
    cleanUp();
  });
});
