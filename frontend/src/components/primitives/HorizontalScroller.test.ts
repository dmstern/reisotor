// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import HorizontalScroller from './HorizontalScroller.vue';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('HorizontalScroller', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountScroller(
    props: {
      prevLabel?: string;
      nextLabel?: string;
      scrollRatio?: number;
      role?: string;
      ariaLabel?: string;
    } = {},
    slotContent: () => ReturnType<typeof h>[] = () => [
      h('div', { class: 'item' }, 'Tag 1'),
      h('div', { class: 'item' }, 'Tag 2'),
    ]
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () => h(HorizontalScroller, props, { default: slotContent }),
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

  it('renders slot content inside .horizontal-scroller-track', async () => {
    const { container, cleanUp } = mountScroller();
    await nextTick();

    const track = container.querySelector(
      '.horizontal-scroller-viewport .horizontal-scroller-track'
    );
    expect(track).not.toBeNull();

    const items = track?.querySelectorAll('.item');
    expect(items).toHaveLength(2);
    expect(items?.[0]?.textContent).toBe('Tag 1');
    expect(items?.[1]?.textContent).toBe('Tag 2');

    cleanUp();
  });

  it('hides pager buttons and fade overlays when content does not overflow', async () => {
    const { container, cleanUp } = mountScroller();
    await nextTick();

    const viewport = container.querySelector<HTMLElement>('.horizontal-scroller-viewport');
    expect(viewport).not.toBeNull();

    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: 0 });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 300 });

    viewport?.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(container.querySelector('.horizontal-scroller-arrow')).toBeNull();
    expect(viewport?.classList.contains('fade-left')).toBe(false);
    expect(viewport?.classList.contains('fade-right')).toBe(false);

    cleanUp();
  });

  it('applies fade classes and shows PagerButtons with custom labels when scrollable', async () => {
    const { container, cleanUp } = mountScroller({
      prevLabel: 'Urlaubswetter nach links scrollen',
      nextLabel: 'Urlaubswetter nach rechts scrollen',
    });
    await nextTick();

    const viewport = container.querySelector<HTMLElement>('.horizontal-scroller-viewport');
    expect(viewport).not.toBeNull();

    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: 50 });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 100 });
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 300 });

    viewport?.dispatchEvent(new Event('scroll'));
    await nextTick();

    const arrowLeft = container.querySelector<HTMLButtonElement>('.horizontal-scroller-arrow.left');
    const arrowRight = container.querySelector<HTMLButtonElement>(
      '.horizontal-scroller-arrow.right'
    );

    expect(viewport?.classList.contains('fade-left')).toBe(true);
    expect(viewport?.classList.contains('fade-right')).toBe(true);
    expect(arrowLeft).not.toBeNull();
    expect(arrowRight).not.toBeNull();
    expect(arrowLeft?.getAttribute('aria-label')).toBe('Urlaubswetter nach links scrollen');
    expect(arrowRight?.getAttribute('aria-label')).toBe('Urlaubswetter nach rechts scrollen');

    cleanUp();
  });

  it('triggers scrolling when clicking prev and next PagerButtons', async () => {
    const { container, cleanUp } = mountScroller({ scrollRatio: 0.5 });
    await nextTick();

    const viewport = container.querySelector<HTMLElement>('.horizontal-scroller-viewport');
    expect(viewport).not.toBeNull();

    const scrollByMock = vi.fn();
    Object.defineProperty(viewport, 'scrollLeft', { configurable: true, value: 50 });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(viewport, 'scrollWidth', { configurable: true, value: 500 });
    Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollByMock });

    viewport?.dispatchEvent(new Event('scroll'));
    await nextTick();

    const arrowLeft = container.querySelector<HTMLButtonElement>('.horizontal-scroller-arrow.left');
    const arrowRight = container.querySelector<HTMLButtonElement>(
      '.horizontal-scroller-arrow.right'
    );

    arrowRight?.click();
    expect(scrollByMock).toHaveBeenCalledWith({
      left: 100,
      behavior: 'smooth',
    });

    arrowLeft?.click();
    expect(scrollByMock).toHaveBeenCalledWith({
      left: -100,
      behavior: 'smooth',
    });

    cleanUp();
  });
});
