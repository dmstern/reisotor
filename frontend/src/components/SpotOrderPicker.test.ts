// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SpotOrderPicker from './SpotOrderPicker.vue';
import type { Spot } from '../api/types';

describe('SpotOrderPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
  });

  function makeSpot(id: number, title: string, category = 'Aussichtspunkt'): Spot {
    return {
      id,
      trip_id: 1,
      title,
      category,
      created_by: 1,
      is_home: 0,
    } as unknown as Spot;
  }

  function mountComponent(options: {
    modelValue: number[];
    spots: Spot[];
    onUpdateModelValue?: (next: number[]) => void;
    onCreateSpot?: () => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(SpotOrderPicker, {
          modelValue: options.modelValue,
          spots: options.spots,
          'onUpdate:modelValue': options.onUpdateModelValue,
          'onCreate-spot': options.onCreateSpot,
        }),
    });
    app.use(createPinia());
    app.mount(container);

    return {
      container,
      app,
    };
  }

  it('renders create-spot button and emits create-spot on click', async () => {
    let created = false;
    const { container, app } = mountComponent({
      modelValue: [],
      spots: [makeSpot(1, 'Aussichtspunkt')],
      onCreateSpot: () => {
        created = true;
      },
    });

    const createBtn = container.querySelector('.spot-picker-create-btn') as HTMLButtonElement;
    expect(createBtn).not.toBeNull();
    expect(createBtn.textContent).toContain('Neuen Spot erstellen');

    createBtn.click();
    await nextTick();
    expect(created).toBe(true);
    app.unmount();
  });

  it('renders without nested fieldsets and shows empty hint when no spots exist', async () => {
    const { container, app } = mountComponent({
      modelValue: [],
      spots: [],
    });

    expect(container.querySelectorAll('fieldset').length).toBe(0);

    const emptyHint = container.querySelector('.spot-picker-empty');
    expect(emptyHint).not.toBeNull();
    expect(emptyHint?.textContent).toContain('Noch keine Spots angelegt.');

    const createBtn = container.querySelector('.spot-picker-create-btn');
    expect(createBtn).not.toBeNull();
    app.unmount();
  });

  it('sorts spots alphabetically A-Z, uses DropdownMenuItem, and shows usage badge', async () => {
    const spots = [makeSpot(1, 'Zentrum'), makeSpot(2, 'Altstadt'), makeSpot(3, 'Bergblick')];
    const { container, app } = mountComponent({
      modelValue: [1, 3, 1],
      spots,
    });

    const options = Array.from(container.querySelectorAll('.spot-picker-option'));
    expect(options.length).toBe(3);
    expect(options.every((el) => el.classList.contains('dropdown-item'))).toBe(true);

    const labels = options.map((el) =>
      el.querySelector('.dropdown-item-label')?.textContent?.trim()
    );
    expect(labels).toEqual(['Altstadt', 'Bergblick', 'Zentrum']);

    expect(options[0].querySelector('.spot-usage-badge')).toBeNull();
    expect(options[1].querySelector('.spot-usage-badge')?.textContent?.trim()).toBe('1×');
    expect(options[2].querySelector('.spot-usage-badge')?.textContent?.trim()).toBe('2×');
    app.unmount();
  });

  it('reorders planned stations via up/down buttons and disables boundary buttons', async () => {
    const spots = [makeSpot(1, 'Erster'), makeSpot(2, 'Zweiter')];
    const selected = ref<number[]>([1, 2]);
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(SpotOrderPicker, {
          modelValue: selected.value,
          spots,
          'onUpdate:modelValue': (next: number[]) => {
            selected.value = next;
          },
        }),
    });
    app.use(createPinia());
    app.mount(container);

    const upButtons = container.querySelectorAll('.move-up-btn') as NodeListOf<HTMLButtonElement>;
    const downButtons = container.querySelectorAll(
      '.move-down-btn'
    ) as NodeListOf<HTMLButtonElement>;
    expect(upButtons[0].disabled).toBe(true);
    expect(upButtons[1].disabled).toBe(false);
    expect(downButtons[0].disabled).toBe(false);
    expect(downButtons[1].disabled).toBe(true);

    downButtons[0].click();
    await nextTick();
    expect(selected.value).toEqual([2, 1]);

    const updatedTitles = Array.from(
      container.querySelectorAll('.planned-row .spot-title-text')
    ).map((el) => el.textContent?.trim());
    expect(updatedTitles).toEqual(['Zweiter', 'Erster']);
    app.unmount();
  });

  it('shows search input only when >= 8 spots exist and shows empty search message', async () => {
    const fewSpots = Array.from({ length: 7 }, (_, i) => makeSpot(i + 1, `Spot ${i + 1}`));
    const fewMount = mountComponent({ modelValue: [], spots: fewSpots });
    expect(fewMount.container.querySelector('.spot-picker-search')).toBeNull();
    fewMount.app.unmount();

    const manySpots = Array.from({ length: 8 }, (_, i) => makeSpot(i + 1, `Spot ${i + 1}`));
    const manyMount = mountComponent({ modelValue: [], spots: manySpots });
    const searchInput = manyMount.container.querySelector(
      '.spot-picker-search'
    ) as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();

    searchInput!.value = 'NichtVorhanden';
    searchInput!.dispatchEvent(new Event('input'));
    await nextTick();

    expect(manyMount.container.querySelectorAll('.spot-picker-option').length).toBe(0);
    expect(manyMount.container.querySelector('.spot-picker-empty')?.textContent).toContain(
      'Keine passenden Spots gefunden.'
    );
    manyMount.app.unmount();
  });
});
