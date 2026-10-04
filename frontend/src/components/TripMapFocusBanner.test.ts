// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
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
});
