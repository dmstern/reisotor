// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TripMapTools from './TripMapTools.vue';

describe('TripMapTools', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(props: Record<string, unknown> = {}, emitListeners = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TripMapTools, {
          filteredPointsCount: 5,
          vacationPointsCount: 1,
          accommodationPointsCount: 1,
          totalAccommodationsCount: 1,
          hasExcursions: true,
          excursionPointsCount: 2,
          allTripPhotosLoaded: true,
          allTripPhotoPointsCount: 3,
          hasOwnPosition: true,
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

  it('renders all 5 floating map buttons', async () => {
    const { container, unmount } = mountComponent();
    await nextTick();

    expect(container.querySelector('.focus-btn')).not.toBeNull();
    expect(container.querySelector('.location-btn')).not.toBeNull();
    expect(container.querySelector('.offline-download-btn')).not.toBeNull();
    expect(container.querySelector('.share-location-btn')).not.toBeNull();
    expect(container.querySelector('.record-btn')).not.toBeNull();

    unmount();
  });

  it('disables focus button when no filtered points exist', async () => {
    const { container, unmount } = mountComponent({
      filteredPointsCount: 0,
    });
    await nextTick();

    const focusBtn = container.querySelector<HTMLButtonElement>('.focus-btn');
    expect(focusBtn?.disabled).toBe(true);

    unmount();
  });

  it('emits download-offline-map when clicking download button', async () => {
    const onDownload = vi.fn();
    const { container, unmount } = mountComponent({}, { onDownloadOfflineMap: onDownload });
    await nextTick();

    const downloadBtn = container.querySelector<HTMLButtonElement>('.offline-download-btn');
    downloadBtn?.click();
    await nextTick();

    expect(onDownload).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('opens focus menu and emits fit-all when selecting fit-all item', async () => {
    const onFitAll = vi.fn();
    const onOpenFocusMenu = vi.fn();
    const { container, unmount } = mountComponent(
      {},
      {
        onFitAll,
        onOpenFocusMenu,
      }
    );
    await nextTick();

    const focusBtn = container.querySelector<HTMLButtonElement>('.focus-btn');
    focusBtn?.click();
    await nextTick();

    expect(onOpenFocusMenu).toHaveBeenCalledTimes(1);

    const fitAllItem = document.body.querySelector<HTMLButtonElement>(
      '.picker-menu [title="Alle eingetragenen Orte auf der Karte anzeigen"]'
    );
    expect(fitAllItem).not.toBeNull();
    fitAllItem?.click();
    await nextTick();

    expect(onFitAll).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('opens location menu and emits jump-my-location', async () => {
    const onJumpMyLocation = vi.fn();
    const { container, unmount } = mountComponent({}, { onJumpMyLocation });
    await nextTick();

    const locationBtn = container.querySelector<HTMLButtonElement>('.location-btn');
    locationBtn?.click();
    await nextTick();

    const items = document.body.querySelectorAll<HTMLButtonElement>('.picker-menu button');
    expect(items.length).toBeGreaterThan(0);
    // The first item is "Zu meinem Standort springen"
    items[0].click();
    await nextTick();

    expect(onJumpMyLocation).toHaveBeenCalledTimes(1);

    unmount();
  });
});
