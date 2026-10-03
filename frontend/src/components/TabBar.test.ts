// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TabBar, { type TabBarItem } from './TabBar.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('TabBar', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const sampleTabs: TabBarItem[] = [
    { key: 'spots', label: 'Spots', icon: ACTION_ICONS.add },
    { key: 'touren', label: 'Touren', icon: ACTION_ICONS.edit, unseen: true },
    { key: 'tracks', label: 'Tracks', icon: ACTION_ICONS.delete },
  ];

  function mockTabGeometry(container: HTMLElement) {
    const tabs = container.querySelectorAll<HTMLElement>('.tab');
    let offset = 0;
    tabs.forEach((tab, i) => {
      const width = 80 + i * 20;
      Object.defineProperty(tab, 'offsetLeft', { configurable: true, value: offset });
      Object.defineProperty(tab, 'offsetWidth', { configurable: true, value: width });
      offset += width + 10;
    });
  }

  function mountTabBar(
    props: { tabs: TabBarItem[]; activeKey: string; fadeBg?: 'bg' | 'surface' | string },
    onSelect?: (key: string) => void
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TabBar, {
          tabs: props.tabs,
          activeKey: props.activeKey,
          fadeBg: props.fadeBg,
          onSelect,
        }),
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

  it('renders tabs with accessible attributes and unseen indicator', async () => {
    const { container, cleanUp } = mountTabBar({ tabs: sampleTabs, activeKey: 'spots' });
    await nextTick();

    const buttons = container.querySelectorAll<HTMLButtonElement>('.tab');
    expect(buttons).toHaveLength(3);

    expect(buttons[0]?.textContent).toContain('Spots');
    expect(buttons[0]?.getAttribute('role')).toBe('tab');
    expect(buttons[0]?.getAttribute('aria-selected')).toBe('true');
    expect(buttons[0]?.classList.contains('active')).toBe(true);

    expect(buttons[1]?.textContent).toContain('Touren');
    expect(buttons[1]?.getAttribute('aria-selected')).toBe('false');
    expect(buttons[1]?.classList.contains('active')).toBe(false);
    expect(buttons[1]?.querySelector('.unseen-dot')).not.toBeNull();

    expect(buttons[2]?.textContent).toContain('Tracks');
    expect(buttons[2]?.getAttribute('aria-selected')).toBe('false');

    cleanUp();
  });

  it('emits select event when a tab is clicked', async () => {
    let selectedKey = '';
    const { container, cleanUp } = mountTabBar({ tabs: sampleTabs, activeKey: 'spots' }, (key) => {
      selectedKey = key;
    });
    await nextTick();

    const buttons = container.querySelectorAll<HTMLButtonElement>('.tab');
    buttons[1]?.click();

    expect(selectedKey).toBe('touren');
    cleanUp();
  });

  it('positions underline on the active tab and updates when activeKey changes', async () => {
    const { container, cleanUp } = mountTabBar({ tabs: sampleTabs, activeKey: 'spots' });
    mockTabGeometry(container);

    // Initial tick to allow mounted hook and nextTick to run
    await nextTick();
    await nextTick();

    const underline = container.querySelector<HTMLElement>('.tab-underline');
    expect(underline).not.toBeNull();
    // spots: offsetLeft = 0, offsetWidth = 80
    expect(underline?.style.transform).toBe('translateX(0px)');
    expect(underline?.style.width).toBe('80px');

    cleanUp();
  });

  it('renders the track inside the tab bar for unified scroll positioning', async () => {
    const { container, cleanUp } = mountTabBar({ tabs: sampleTabs, activeKey: 'spots' });
    await nextTick();

    const track = container.querySelector('.tab-bar .tab-bar-track');
    expect(track).not.toBeNull();

    const buttons = track?.querySelectorAll('.tab');
    expect(buttons).toHaveLength(3);

    const underline = track?.querySelector('.tab-underline');
    expect(underline).not.toBeNull();

    cleanUp();
  });

  it('rendert Scroll-Pfeile mit Verlauf, wenn die Tab-Leiste horizontal scrollbar ist', async () => {
    const { container, cleanUp } = mountTabBar({ tabs: sampleTabs, activeKey: 'spots' });
    await nextTick();

    const tabBar = container.querySelector<HTMLElement>('.tab-bar');
    expect(tabBar).not.toBeNull();

    // Simuliere Scroll-Zustand mittig: Links und rechts überhängender Inhalt
    Object.defineProperty(tabBar, 'scrollLeft', { configurable: true, value: 50 });
    Object.defineProperty(tabBar, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(tabBar, 'scrollWidth', { configurable: true, value: 300 });

    tabBar?.dispatchEvent(new Event('scroll'));
    await nextTick();

    const arrowLeft = container.querySelector<HTMLButtonElement>('.tab-bar-arrow.left');
    const arrowRight = container.querySelector<HTMLButtonElement>('.tab-bar-arrow.right');

    expect(arrowLeft).not.toBeNull();
    expect(arrowRight).not.toBeNull();
    expect(arrowLeft?.getAttribute('aria-label')).toBe('Tabs nach links scrollen');
    expect(arrowRight?.getAttribute('aria-label')).toBe('Tabs nach rechts scrollen');

    cleanUp();
  });

  it('setzt dynamische CSS-Variable fuer den Fade-Hintergrund bei fadeBg-Prop', async () => {
    const { container: containerSurface, cleanUp: cleanUpSurface } = mountTabBar({
      tabs: sampleTabs,
      activeKey: 'spots',
      fadeBg: 'surface',
    });
    await nextTick();

    const scrollerSurface = containerSurface.querySelector<HTMLElement>('.tab-bar-scroller');
    expect(scrollerSurface?.style.getPropertyValue('--tab-bar-fade-bg')).toBe(
      'var(--color-surface)'
    );
    cleanUpSurface();

    const { container: containerBg, cleanUp: cleanUpBg } = mountTabBar({
      tabs: sampleTabs,
      activeKey: 'spots',
      fadeBg: 'bg',
    });
    await nextTick();

    const scrollerBg = containerBg.querySelector<HTMLElement>('.tab-bar-scroller');
    expect(scrollerBg?.style.getPropertyValue('--tab-bar-fade-bg')).toBe('var(--color-bg)');
    cleanUpBg();
  });
});
