// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TripMapFocusBanner from './TripMapFocusBanner.vue';

describe('TripMapFocusBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(props: Record<string, unknown>, emitListeners = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TripMapFocusBanner, {
          ...props,
          ...emitListeners,
        }),
    });
    app.use(createPinia());
    app.mount(container);
    return {
      container,
      unmount: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders nothing when no item is focused', async () => {
    const { container, unmount } = mountComponent({});
    await nextTick();

    expect(container.querySelector('.focus-banner')).toBeNull();
    unmount();
  });

  it('renders excursion title and emits clear when leaving focus', async () => {
    const onClear = vi.fn();
    const { container, unmount } = mountComponent(
      {
        focusedExcursion: { id: 1, title: 'Wanderung zum Wasserfall', trip_id: 1 },
      },
      {
        onClear,
      }
    );
    await nextTick();

    const banner = container.querySelector('.focus-banner');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Wanderung zum Wasserfall');

    const clearBtn = container.querySelector<HTMLButtonElement>('.btn');
    expect(clearBtn?.textContent).toContain('Fokus verlassen');
    clearBtn?.click();
    await nextTick();

    expect(onClear).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('renders photo location and emits open-photo-preview on title click', async () => {
    const onOpenPhoto = vi.fn();
    const { container, unmount } = mountComponent(
      {
        focusedLocation: { title: 'Strandpanorama', imageUrl: 'https://example.com/pic.jpg' },
      },
      {
        onOpenPhotoPreview: onOpenPhoto,
      }
    );
    await nextTick();

    const banner = container.querySelector('.focus-banner');
    expect(banner).not.toBeNull();

    const titleBtn = container.querySelector<HTMLButtonElement>('.focus-title-btn');
    expect(titleBtn?.textContent).toContain('Strandpanorama');
    titleBtn?.click();
    await nextTick();

    expect(onOpenPhoto).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('toggles expansion on mobile toggle click for non-photo items', async () => {
    const { container, unmount } = mountComponent({
      focusedDate: '2026-09-01',
      formatDate: (d: string) => `Tag: ${d}`,
    });
    await nextTick();

    const banner = container.querySelector('.focus-banner');
    expect(banner?.classList.contains('is-expanded')).toBe(false);

    const toggleBtn = container.querySelector<HTMLButtonElement>('.focus-banner-toggle-btn');
    toggleBtn?.click();
    await nextTick();

    expect(banner?.classList.contains('is-expanded')).toBe(true);

    toggleBtn?.click();
    await nextTick();

    expect(banner?.classList.contains('is-expanded')).toBe(false);
    unmount();
  });

  it('renders date navigation buttons and emits change-date on prev/next click', async () => {
    const onChangeDate = vi.fn();
    const vacationDays = ['2026-09-01', '2026-09-02', '2026-09-03'];
    const { container, unmount } = mountComponent(
      {
        focusedDate: '2026-09-02',
        vacationDays,
        formatDate: (d: string) => `Tag: ${d}`,
      },
      {
        onChangeDate,
      }
    );
    await nextTick();

    const banner = container.querySelector('.focus-banner');
    expect(banner).not.toBeNull();

    const navBtns = container.querySelectorAll<HTMLButtonElement>('.focus-nav-btn');
    expect(navBtns).toHaveLength(2);

    const prevBtn = navBtns[0];
    const nextBtn = navBtns[1];

    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(false);

    prevBtn.click();
    await nextTick();
    expect(onChangeDate).toHaveBeenCalledWith('2026-09-01');

    nextBtn.click();
    await nextTick();
    expect(onChangeDate).toHaveBeenCalledWith('2026-09-03');

    unmount();
  });

  it('disables prev button on first day and next button on last day', async () => {
    const vacationDays = ['2026-09-01', '2026-09-02'];

    // First day
    const { container: c1, unmount: u1 } = mountComponent({
      focusedDate: '2026-09-01',
      vacationDays,
    });
    await nextTick();

    const btns1 = c1.querySelectorAll<HTMLButtonElement>('.focus-nav-btn');
    expect(btns1[0].disabled).toBe(true);
    expect(btns1[1].disabled).toBe(false);
    u1();

    // Last day
    const { container: c2, unmount: u2 } = mountComponent({
      focusedDate: '2026-09-02',
      vacationDays,
    });
    await nextTick();

    const btns2 = c2.querySelectorAll<HTMLButtonElement>('.focus-nav-btn');
    expect(btns2[0].disabled).toBe(false);
    expect(btns2[1].disabled).toBe(true);
    u2();
  });

  it('does not render date nav buttons when only 1 day or no vacation days', async () => {
    const { container, unmount } = mountComponent({
      focusedDate: '2026-09-01',
      vacationDays: ['2026-09-01'],
    });
    await nextTick();

    expect(container.querySelectorAll('.focus-nav-btn')).toHaveLength(0);
    expect(container.querySelector('.focus-date-label')?.textContent).toBe('2026-09-01');
    unmount();
  });

  it('keeps focus banner expanded on mobile when date changes', async () => {
    const vacationDays = ['2026-09-01', '2026-09-02'];
    const appContainer = document.createElement('div');
    document.body.appendChild(appContainer);

    const focusedDate = ref('2026-09-01');
    const app = createApp({
      render: () =>
        h(TripMapFocusBanner, {
          focusedDate: focusedDate.value,
          vacationDays,
        }),
    });
    app.use(createPinia());
    app.mount(appContainer);
    await nextTick();

    const banner = appContainer.querySelector('.focus-banner');
    expect(banner?.classList.contains('is-expanded')).toBe(false);

    // Expand banner on mobile
    const toggleBtn = appContainer.querySelector<HTMLButtonElement>('.focus-banner-toggle-btn');
    toggleBtn?.click();
    await nextTick();
    expect(banner?.classList.contains('is-expanded')).toBe(true);

    // Switch date: banner should remain expanded
    focusedDate.value = '2026-09-02';
    await nextTick();

    expect(banner?.classList.contains('is-expanded')).toBe(true);

    app.unmount();
    appContainer.remove();
  });
});
