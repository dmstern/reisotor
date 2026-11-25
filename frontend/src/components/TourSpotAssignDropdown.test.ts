// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TourSpotAssignDropdown from './TourSpotAssignDropdown.vue';
import type { Spot } from '../api/types';

describe('TourSpotAssignDropdown', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
  });

  const spots: Spot[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Zweiter Spot',
      category: 'Strand',
      created_by: 1,
      is_home: 0,
    } as unknown as Spot,
    {
      id: 2,
      trip_id: 1,
      title: 'Bester Spot',
      category: 'Aussichtspunkt',
      created_by: 1,
      is_home: 0,
    } as unknown as Spot,
  ];

  function mountComponent(props: {
    spots: Spot[];
    selectedSpotIds?: number[];
    compact?: boolean;
    closeOnSelect?: boolean;
    onSelectSpot?: (id: number) => void;
    onCreateSpot?: () => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TourSpotAssignDropdown, {
          spots: props.spots,
          selectedSpotIds: props.selectedSpotIds,
          compact: props.compact,
          closeOnSelect: props.closeOnSelect,
          'onSelect-spot': props.onSelectSpot,
          'onCreate-spot': props.onCreateSpot,
        }),
    });
    app.use(createPinia());
    app.mount(container);

    return {
      container,
      app,
    };
  }

  it('renders trigger button and opens popover sorted A-Z without like counts', async () => {
    const { container } = mountComponent({
      spots,
    });

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    expect(trigger.classList.contains('btn')).toBe(true);
    expect(trigger.classList.contains('btn--secondary')).toBe(true);
    expect(trigger.textContent).toContain('Spot hinzufügen');

    trigger.click();
    await nextTick();

    const popup = document.querySelector('.tour-spot-assign-popup');
    expect(popup).not.toBeNull();
    expect(popup?.classList.contains('picker-menu')).toBe(true);
    expect(popup?.textContent).toContain('Spot hinzufügen');
    expect(popup?.querySelector('.spot-assign-likes')).toBeNull();

    const options = document.querySelectorAll('.spot-assign-option');
    expect(options.length).toBe(2);
    expect(options[0].classList.contains('dropdown-item')).toBe(true);
    expect(options[0].textContent).toContain('Bester Spot');
    expect(options[1].textContent).toContain('Zweiter Spot');
  });

  it('emits select-spot when an existing spot is clicked', async () => {
    let selectedId: number | null = null;
    const { container } = mountComponent({
      spots,
      onSelectSpot: (id) => {
        selectedId = id;
      },
    });

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const firstOption = document.querySelector('.spot-assign-option') as HTMLButtonElement;
    expect(firstOption).not.toBeNull();
    firstOption.click();
    await nextTick();

    expect(selectedId).toBe(2);
  });

  it('emits create-spot when Neuen Spot erstellen button is clicked', async () => {
    let created = false;
    const { container } = mountComponent({
      spots,
      onCreateSpot: () => {
        created = true;
      },
    });

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const createBtn = document.querySelector('.create-spot-btn') as HTMLButtonElement;
    expect(createBtn).not.toBeNull();
    createBtn.click();
    await nextTick();

    expect(created).toBe(true);
  });

  it('highlights already selected spots with active class and usage badge', async () => {
    const { container } = mountComponent({
      spots,
      selectedSpotIds: [1, 1],
    });

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const options = document.querySelectorAll('.spot-assign-option');
    expect(options[0].classList.contains('is-active')).toBe(false);
    expect(options[0].querySelector('.spot-usage-badge')).toBeNull();
    expect(options[1].classList.contains('is-active')).toBe(true);
    expect(options[1].querySelector('.spot-usage-badge')?.textContent?.trim()).toBe('2×');
  });

  it('keeps popover open when closeOnSelect is false', async () => {
    let selectedId: number | null = null;
    const { container } = mountComponent({
      spots,
      closeOnSelect: false,
      onSelectSpot: (id) => {
        selectedId = id;
      },
    });

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const firstOption = document.querySelector('.spot-assign-option') as HTMLButtonElement;
    firstOption.click();
    await nextTick();

    expect(selectedId).toBe(2);
    expect(document.querySelector('.tour-spot-assign-popup')).not.toBeNull();
  });

  it('shows search input when >= 8 spots exist and shows empty search message', async () => {
    const manySpots = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      trip_id: 1,
      title: `Spot ${index + 1}`,
      category: 'Aussichtspunkt',
      created_by: 1,
      is_home: 0,
    })) as unknown as Spot[];

    const { container } = mountComponent({
      spots: manySpots,
    });

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const searchInput = document.querySelector('.spot-assign-search') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    searchInput!.value = 'NichtVorhanden';
    searchInput!.dispatchEvent(new Event('input'));
    await nextTick();

    expect(document.querySelectorAll('.spot-assign-option').length).toBe(0);
    expect(document.querySelector('.spot-assign-empty')?.textContent).toContain(
      'Keine passenden Spots gefunden.'
    );
  });
});
