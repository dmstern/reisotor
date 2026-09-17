/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DayStrip from './DayStrip.vue';

describe('DayStrip', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const sampleDays = ['2026-08-30', '2026-08-31', '2026-09-01'];

  function createTestContainer() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
  }

  it('renders days correctly', async () => {
    const container = createTestContainer();
    const app = createApp({
      render: () =>
        h(DayStrip, {
          days: sampleDays,
          activeDate: '2026-08-31',
        }),
    });
    app.mount(container);
    await nextTick();

    const chips = container.querySelectorAll('.day-chip');
    expect(chips.length).toBe(3);
    expect(chips[1].classList.contains('active')).toBe(true);
    expect(chips[0].classList.contains('active')).toBe(false);

    app.unmount();
    container.remove();
  });

  it('emits select when a day is clicked', async () => {
    const container = createTestContainer();
    const onSelect = vi.fn();
    const app = createApp({
      render: () =>
        h(DayStrip, {
          days: sampleDays,
          activeDate: '2026-08-31',
          onSelect,
        }),
    });
    app.mount(container);
    await nextTick();

    const chips = container.querySelectorAll<HTMLButtonElement>('.day-chip');
    chips[0].click();
    expect(onSelect).toHaveBeenCalledWith('2026-08-30');

    app.unmount();
    container.remove();
  });

  it('shows scroll buttons when content overflows', async () => {
    const container = createTestContainer();
    const app = createApp({
      render: () =>
        h(DayStrip, {
          days: sampleDays,
        }),
    });
    app.mount(container);
    await nextTick();

    const scrollEl = container.querySelector('.day-strip-scroll') as HTMLElement;
    expect(scrollEl).not.toBeNull();

    // Mock overflow
    Object.defineProperty(scrollEl, 'clientWidth', { value: 100, configurable: true });
    Object.defineProperty(scrollEl, 'scrollWidth', { value: 300, configurable: true });
    Object.defineProperty(scrollEl, 'scrollLeft', { value: 0, configurable: true, writable: true });

    // Trigger scroll event to update arrows
    scrollEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    const rightArrow = container.querySelector('.day-strip-arrow.right');
    const leftArrow = container.querySelector('.day-strip-arrow.left');
    expect(rightArrow).not.toBeNull();
    expect(leftArrow).toBeNull();

    // Scroll right
    scrollEl.scrollLeft = 50;
    scrollEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(container.querySelector('.day-strip-arrow.left')).not.toBeNull();
    expect(container.querySelector('.day-strip-arrow.right')).not.toBeNull();

    // Scroll to end
    scrollEl.scrollLeft = 200; // 200 + 100 = 300
    scrollEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(container.querySelector('.day-strip-arrow.left')).not.toBeNull();
    expect(container.querySelector('.day-strip-arrow.right')).toBeNull();

    // Clicking left arrow
    scrollEl.scrollBy = vi.fn();
    const leftBtn = container.querySelector<HTMLButtonElement>('.day-strip-arrow.left');
    leftBtn?.click();
    expect(scrollEl.scrollBy).toHaveBeenCalledWith({
      left: -70,
      behavior: 'smooth',
    });

    app.unmount();
    container.remove();
  });
});
