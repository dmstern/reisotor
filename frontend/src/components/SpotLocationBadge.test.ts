// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file */
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
});
