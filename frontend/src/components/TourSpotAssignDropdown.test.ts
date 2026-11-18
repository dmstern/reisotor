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

  const likeCount = (id: number) => (id === 2 ? 5 : 1);

  function mountComponent(props: {
    spots: Spot[];
    likeCount: (id: number) => number;
    compact?: boolean;
    onSelectSpot?: (id: number) => void;
    onCreateSpot?: () => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(TourSpotAssignDropdown, {
          spots: props.spots,
          likeCount: props.likeCount,
          compact: props.compact,
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

  it('renders trigger button and opens popover on click', async () => {
    const { container } = mountComponent({
      spots,
      likeCount,
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
      likeCount,
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
      likeCount,
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
});
