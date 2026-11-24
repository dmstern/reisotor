// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotLocationBadge from './SpotLocationBadge.vue';
import type { Spot } from '../api/types';

describe('SpotLocationBadge', () => {
  const spotWithLocation: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Lissabon (LIS)',
    category: 'Flughafen',
    lat: 38.7742,
    lng: -9.1342,
    image_url: null,
    address: null,
    note: null,
    note_format: 'text',
    created_by: 1,
    is_home: 0,
  } as Spot;

  const spotWithoutLocation: Spot = {
    id: 2,
    trip_id: 1,
    title: 'Berlin (BER)',
    category: 'Flughafen',
    lat: null,
    lng: null,
    image_url: null,
    address: null,
    note: null,
    note_format: 'text',
    created_by: 1,
    is_home: 0,
  } as Spot;

  it('renders nothing when spot has valid coordinates', async () => {
    const pinia = createPinia();
    const app = createApp({
      render: () => h(SpotLocationBadge, { spot: spotWithLocation }),
    });
    app.use(pinia);

    const html = await renderToString(app);
    expect(html).not.toContain('spot-location-badge');
    expect(html).not.toContain('Standort fehlt');
  });

  it('renders badge with warning icon and "Standort fehlt" when coordinates are missing', async () => {
    const pinia = createPinia();
    const app = createApp({
      render: () => h(SpotLocationBadge, { spot: spotWithoutLocation }),
    });
    app.use(pinia);

    const html = await renderToString(app);
    expect(html).toContain('spot-location-badge');
    expect(html).toContain('Standort fehlt');
    expect(html).toContain('spot-location-warning-icon');
    expect(html).toContain('tabler-icon-map-pin-exclamation');
    expect(html).toContain('info-popover-btn');
  });

  it('opens popover on click and emits edit event on clicking "Standort jetzt festlegen"', async () => {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onEdit = vi.fn();

    const app = createApp({
      render: () =>
        h(SpotLocationBadge, {
          spot: spotWithoutLocation,
          onEdit,
        }),
    });
    app.use(pinia);
    app.mount(container);

    const badge = container.querySelector('.spot-location-badge') as HTMLElement;
    expect(badge).not.toBeNull();

    const infoBtn = container.querySelector('.info-popover-btn') as HTMLButtonElement;
    expect(infoBtn).not.toBeNull();

    // Klick auf den Info-Button öffnet das InfoPopover
    infoBtn.click();
    await nextTick();

    const popoverContent = document.body.querySelector('.spot-location-popover-content');
    expect(popoverContent).not.toBeNull();
    expect(popoverContent?.textContent).toContain('Warum ist der Standort wichtig?');
    expect(popoverContent?.textContent).toContain('Karten-Ansicht');
    expect(popoverContent?.textContent).toContain('Wege & Zeiten');
    expect(popoverContent?.textContent).toContain('Wetterdaten');
    expect(popoverContent?.textContent).toContain('Navigation');

    // Klick auf den Aktionsbutton "Standort jetzt festlegen"
    const editBtn = popoverContent?.querySelector('.popover-edit-btn') as HTMLButtonElement;
    expect(editBtn).not.toBeNull();
    expect(editBtn.textContent).toContain('Standort jetzt festlegen');

    editBtn.click();
    await nextTick();

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(spotWithoutLocation);

    app.unmount();
    container.remove();
  });

  it('clicking the badge button directly emits edit event', async () => {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onEdit = vi.fn();

    const app = createApp({
      render: () =>
        h(SpotLocationBadge, {
          spot: spotWithoutLocation,
          onEdit,
        }),
    });
    app.use(pinia);
    app.mount(container);

    const actionBtn = container.querySelector(
      '.spot-location-badge-action-btn'
    ) as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();

    actionBtn.click();
    await nextTick();

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(spotWithoutLocation);

    app.unmount();
    container.remove();
  });

  it('renders dialog context with instructions for setting location', async () => {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(SpotLocationBadge, {
          context: 'dialog',
        }),
    });
    app.use(pinia);
    app.mount(container);

    expect(container.querySelector('.spot-location-badge-display')).not.toBeNull();
    expect(container.querySelector('.spot-location-badge-action-btn')).toBeNull();

    const infoBtn = container.querySelector('.info-popover-btn') as HTMLButtonElement;
    expect(infoBtn).not.toBeNull();
    infoBtn.click();
    await nextTick();

    const popoverContent = document.body.querySelector('.spot-location-popover-content');
    expect(popoverContent).not.toBeNull();
    expect(popoverContent?.textContent).toContain('Standort festlegen');
    expect(popoverContent?.textContent).toContain('Ortssuche');
    expect(popoverContent?.textContent).toContain('Karten-Link');
    expect(popoverContent?.textContent).not.toContain('Standort jetzt festlegen');

    app.unmount();
    container.remove();
  });

  it('aligns InfoPopover to the left by default and supports popoverAlign="right"', async () => {
    const TRIGGER_LEFT = 400;
    const TRIGGER_RIGHT = 420;
    const TRIGGER_TOP = 100;
    const TRIGGER_BOTTOM = 120;
    const TRIGGER_SIZE = 20;
    const CARD_POPOVER_WIDTH = 290;

    const mockRect = () =>
      ({
        left: TRIGGER_LEFT,
        right: TRIGGER_RIGHT,
        top: TRIGGER_TOP,
        bottom: TRIGGER_BOTTOM,
        width: TRIGGER_SIZE,
        height: TRIGGER_SIZE,
        x: TRIGGER_LEFT,
        y: TRIGGER_TOP,
        toJSON: () => ({}),
      }) as DOMRect;

    const defaultContainer = document.createElement('div');
    document.body.appendChild(defaultContainer);
    const defaultApp = createApp({
      render: () => h(SpotLocationBadge, { spot: spotWithoutLocation }),
    });
    defaultApp.use(createPinia());
    defaultApp.mount(defaultContainer);

    const defaultInfoBtn = defaultContainer.querySelector('.info-popover-btn') as HTMLButtonElement;
    defaultInfoBtn.getBoundingClientRect = mockRect;
    defaultInfoBtn.click();
    await nextTick();
    await nextTick();

    const defaultMenu = document.body.querySelector('.info-popover-menu') as HTMLElement;
    expect(defaultMenu).not.toBeNull();
    expect(defaultMenu.style.left).toBe(`${TRIGGER_LEFT}px`);

    defaultApp.unmount();
    defaultContainer.remove();

    const rightContainer = document.createElement('div');
    document.body.appendChild(rightContainer);
    const rightApp = createApp({
      render: () =>
        h(SpotLocationBadge, {
          spot: spotWithoutLocation,
          popoverAlign: 'right',
        }),
    });
    rightApp.use(createPinia());
    rightApp.mount(rightContainer);

    const rightInfoBtn = rightContainer.querySelector('.info-popover-btn') as HTMLButtonElement;
    rightInfoBtn.getBoundingClientRect = mockRect;
    rightInfoBtn.click();
    await nextTick();
    await nextTick();

    const rightMenu = document.body.querySelector('.info-popover-menu') as HTMLElement;
    expect(rightMenu).not.toBeNull();
    expect(rightMenu.style.left).toBe(`${TRIGGER_RIGHT - CARD_POPOVER_WIDTH}px`);

    rightApp.unmount();
    rightContainer.remove();
  });
});
