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
          homePointsCount: 1,
          accommodationPointsCount: 1,
          totalAccommodationsCount: 1,
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

  it('renders all 4 floating map buttons and merges location button into focus button', async () => {
    const { container, unmount } = mountComponent();
    await nextTick();

    expect(container.querySelector('.focus-btn')).not.toBeNull();
    expect(container.querySelector('.location-btn')).toBeNull();
    expect(container.querySelector('.offline-download-btn')).not.toBeNull();
    expect(container.querySelector('.share-location-btn')).not.toBeNull();
    expect(container.querySelector('.record-btn')).not.toBeNull();

    unmount();
  });

  it('keeps focus button enabled even when no filtered points exist so location and orientation remain accessible', async () => {
    const { container, unmount } = mountComponent({
      filteredPointsCount: 0,
    });
    await nextTick();

    const focusBtn = container.querySelector<HTMLButtonElement>('.focus-btn');
    expect(focusBtn?.disabled).toBe(false);

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

  it('opens focus menu and emits fit-all and fit-home when selecting corresponding items', async () => {
    const onFitAll = vi.fn();
    const onFitHome = vi.fn();
    const onOpenFocusMenu = vi.fn();
    const { container, unmount } = mountComponent(
      {},
      {
        onFitAll,
        onFitHome,
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

    focusBtn?.click();
    await nextTick();

    const fitHomeItem = document.body.querySelector<HTMLButtonElement>(
      '.picker-menu [title="Auf die Heimatorte fokussieren"]'
    );
    expect(fitHomeItem).not.toBeNull();
    fitHomeItem?.click();
    await nextTick();

    expect(onFitHome).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('shows jump-my-location, only members sharing a position, and orientation controls in the merged focus menu', async () => {
    const onJumpMyLocation = vi.fn();
    const onJumpMemberLocation = vi.fn();
    const onSetOrientationMode = vi.fn();
    const { container, unmount } = mountComponent(
      {
        otherMembers: [
          { id: 2, username: 'Amari', avatar: '🐼' },
          { id: 3, username: 'Alex', avatar: '🐱' },
        ],
        hasMemberPosition: (id: number) => id === 2,
      },
      {
        onJumpMyLocation,
        onJumpMemberLocation,
        onSetOrientationMode,
      }
    );
    await nextTick();

    const focusBtn = container.querySelector<HTMLButtonElement>('.focus-btn');
    focusBtn?.click();
    await nextTick();

    const menuText = document.body.querySelector('.picker-menu')?.textContent ?? '';
    expect(menuText).toContain('Zu meinem Standort springen');
    expect(menuText).toContain('Zu Standort von Amari springen');
    expect(menuText).not.toContain('Zu Standort von Alex springen');
    expect(menuText).not.toContain('Nur Tourziele');

    const myLocBtn = document.body.querySelector<HTMLButtonElement>(
      '.picker-menu [title="Auf meinen aktuellen Standort zentrieren"]'
    );
    myLocBtn?.click();
    await nextTick();
    expect(onJumpMyLocation).toHaveBeenCalledTimes(1);

    focusBtn?.click();
    await nextTick();
    const memberBtn = document.body.querySelector<HTMLButtonElement>(
      '.picker-menu [title="Amari teilt gerade den Standort"]'
    );
    memberBtn?.click();
    await nextTick();
    expect(onJumpMemberLocation).toHaveBeenCalledWith(2);

    unmount();
  });
});
