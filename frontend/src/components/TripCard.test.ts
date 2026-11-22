// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TripCard from './TripCard.vue';
import type { Trip } from '../api/types';

describe('TripCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const fullTrip: Trip = {
    id: 1,
    name: 'Sommer in Sizilien',
    destination: 'Palermo, Italien',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    maps_link: null,
    image_url: '/api/uploads/sicily.jpg',
    packing_category_required: 0,
    weather_model: 'ecmwf_ifs025',
    lat: 38.11,
    lng: 13.36,
    members: [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
      { id: 3, username: 'Charlie', avatar: '🦊' },
      { id: 4, username: 'Dana', avatar: '🧭' },
    ],
    stats: {
      spots: 5,
      tours: 2,
      diary: 3,
      packing_packed: 4,
      packing_total: 4,
    },
  };

  function mountCard(trip: Trip, active = false) {
    const pinia = createPinia();
    setActivePinia(pinia);

    const onSelect = [] as number[];
    const onEdit = [] as Trip[];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(TripCard, {
          trip,
          active,
          onSelect: (id: number) => onSelect.push(id),
          onEdit: (editedTrip: Trip) => onEdit.push(editedTrip),
        }),
    });
    app.use(pinia);
    app.mount(container);

    return {
      container,
      onSelect,
      onEdit,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders trip title, cover image, date range with days, destination, co-travelers with overflow, and stats', async () => {
    const { container, cleanUp } = mountCard(fullTrip, true);
    await nextTick();

    expect(container.textContent).toContain('Sommer in Sizilien');
    expect(container.textContent).toContain('Aktiv');
    expect(container.textContent).toContain('Palermo, Italien');
    expect(container.textContent).toContain('10 Tage');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
    expect(container.textContent).toContain('Charlie');
    expect(container.textContent).not.toContain('Dana');
    expect(container.textContent).toContain('+1');

    expect(container.textContent).toContain('5 Spots');
    expect(container.textContent).toContain('2 Touren');
    expect(container.textContent).toContain('3 Einträge');
    expect(container.textContent).toContain('4/4 gepackt');

    const img = container.querySelector<HTMLImageElement>('img.trip-cover-img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/api/uploads/sicily.jpg');

    const packingStat = container.querySelector('.trip-stat.is-complete');
    expect(packingStat).not.toBeNull();

    cleanUp();
  });

  it('renders fallback cover icon and open placeholders when image, destination, and dates are missing', async () => {
    const minimalTrip: Trip = {
      id: 2,
      name: 'Spontantrip',
      destination: null,
      start_date: null,
      end_date: null,
      maps_link: null,
      image_url: null,
      packing_category_required: 0,
      weather_model: 'ecmwf_ifs025',
      lat: null,
      lng: null,
    };

    const { container, cleanUp } = mountCard(minimalTrip);
    await nextTick();

    expect(container.querySelector('img.trip-cover-img')).toBeNull();
    expect(container.querySelector('.trip-cover-placeholder')).not.toBeNull();
    expect(container.textContent).toContain('Datum noch offen');
    expect(container.textContent).toContain('Reiseziel noch offen');
    expect(container.querySelector('.trip-stats')).toBeNull();

    cleanUp();
  });

  it('uses a ghost IconButton for editing and emits edit without triggering select', async () => {
    const { container, onSelect, onEdit, cleanUp } = mountCard(fullTrip);
    await nextTick();

    const editBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Bearbeiten"]');
    expect(editBtn).not.toBeNull();
    expect(editBtn?.classList.contains('btn--ghost')).toBe(true);
    expect(editBtn?.classList.contains('icon-btn')).toBe(true);

    editBtn?.click();
    expect(onEdit).toHaveLength(1);
    expect(onEdit[0].id).toBe(1);
    expect(onSelect).toHaveLength(0);

    const selectBtn = container.querySelector<HTMLButtonElement>('button.trip-select');
    selectBtn?.click();
    expect(onSelect).toEqual([1]);

    cleanUp();
  });
});
