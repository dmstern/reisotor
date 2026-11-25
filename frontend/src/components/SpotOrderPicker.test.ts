// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SpotOrderPicker from './SpotOrderPicker.vue';
import type { Spot } from '../api/types';

describe('SpotOrderPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  function mockRowMetrics(container: HTMLElement, rowHeight = 44, gap = 6) {
    const rows = Array.from(
      container.querySelectorAll('.planned-row:not(.list-leave-active)')
    ) as HTMLElement[];

    rows.forEach((row, index) => {
      Object.defineProperty(row, 'offsetTop', {
        configurable: true,
        value: index * (rowHeight + gap),
      });
      Object.defineProperty(row, 'offsetHeight', {
        configurable: true,
        value: rowHeight,
      });
    });

    return rows;
  }

  async function dragRowByPointer(
    container: HTMLElement,
    fromIndex: number,
    deltaY: number,
    options: { pointerId?: number } = {}
  ) {
    const rows = mockRowMetrics(container);
    const row = rows[fromIndex];
    const pointerId = options.pointerId ?? 1;
    const startClientY = 100;

    row.dispatchEvent(
      Object.assign(new Event('pointerdown', { bubbles: true, cancelable: true }), {
        button: 0,
        pointerId,
        pointerType: 'mouse',
        clientY: startClientY,
      })
    );
    await nextTick();

    window.dispatchEvent(
      Object.assign(new Event('pointermove', { bubbles: true, cancelable: true }), {
        pointerId,
        clientY: startClientY + deltaY,
      })
    );
    await nextTick();

    window.dispatchEvent(
      Object.assign(new Event('pointerup', { bubbles: true, cancelable: true }), {
        pointerId,
        clientY: startClientY + deltaY,
      })
    );
    await nextTick();

    vi.advanceTimersByTime(200);
    await nextTick();
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

  it('renders without nested fieldsets, shows empty hint, and emits create-spot from popover', async () => {
    let created = false;
    const { container, app } = mountComponent({
      modelValue: [],
      spots: [],
      onCreateSpot: () => {
        created = true;
      },
    });

    expect(container.querySelectorAll('fieldset').length).toBe(0);

    const emptyHint = container.querySelector('.spot-picker-empty');
    expect(emptyHint).not.toBeNull();
    expect(emptyHint?.textContent).toContain('Noch keine Stationen zugeordnet.');

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    trigger.click();
    await nextTick();

    const createBtn = document.querySelector('.create-spot-btn') as HTMLButtonElement;
    expect(createBtn).not.toBeNull();
    createBtn.click();
    await nextTick();

    expect(created).toBe(true);
    app.unmount();
  });

  it('opens unified popover sorted A-Z with highlight + usage badge and keeps popover open on select', async () => {
    const spots = [makeSpot(1, 'Zentrum'), makeSpot(2, 'Altstadt'), makeSpot(3, 'Bergblick')];
    const selected = ref<number[]>([1, 3, 1]);
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

    const trigger = container.querySelector('.tour-add-spot-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const options = Array.from(document.querySelectorAll('.spot-assign-option'));
    expect(options.length).toBe(3);

    const labels = options.map((el) =>
      el.querySelector('.dropdown-item-label')?.textContent?.trim()
    );
    expect(labels).toEqual(['Altstadt', 'Bergblick', 'Zentrum']);

    expect(options[0].classList.contains('is-active')).toBe(false);
    expect(options[0].querySelector('.spot-usage-badge')).toBeNull();
    expect(options[1].classList.contains('is-active')).toBe(true);
    expect(options[1].querySelector('.spot-usage-badge')?.textContent?.trim()).toBe('1×');
    expect(options[2].classList.contains('is-active')).toBe(true);
    expect(options[2].querySelector('.spot-usage-badge')?.textContent?.trim()).toBe('2×');

    (options[0] as HTMLButtonElement).click();
    await nextTick();

    expect(selected.value).toEqual([1, 3, 1, 2]);
    expect(document.querySelector('.tour-spot-assign-popup')).not.toBeNull();
    expect(container.querySelectorAll('.planned-row').length).toBe(4);
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

  it('reorders first-to-last, last-to-first, and duplicate spots reliably via pointer drag', async () => {
    const spots = [makeSpot(1, 'Erster'), makeSpot(2, 'Zweiter')];
    const selected = ref<number[]>([1, 2, 1]);
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

    // Drag first station past the last station (even with overshoot beyond list end)
    await dragRowByPointer(container, 0, 140);
    expect(selected.value).toEqual([2, 1, 1]);

    // Drag last station back to the top (even with overshoot above row 0)
    await dragRowByPointer(container, 2, -140);
    expect(selected.value).toEqual([1, 2, 1]);

    // Drag middle station down to last
    await dragRowByPointer(container, 1, 60);
    expect(selected.value).toEqual([1, 1, 2]);

    app.unmount();
  });

  it('reorders and removes visible stations accurately when modelValue contains unresolvable spot IDs', async () => {
    const spots = [makeSpot(1, 'Erster'), makeSpot(2, 'Zweiter'), makeSpot(3, 'Dritter')];
    const selected = ref<number[]>([999, 1, 2, 3]);
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

    const visibleTitles = () =>
      Array.from(container.querySelectorAll('.planned-row .spot-title-text')).map((el) =>
        el.textContent?.trim()
      );

    expect(visibleTitles()).toEqual(['Erster', 'Zweiter', 'Dritter']);

    // Click move-down on visible row 0 twice in a row
    (container.querySelectorAll('.move-down-btn')[0] as HTMLButtonElement).click();
    await nextTick();
    expect(visibleTitles()).toEqual(['Zweiter', 'Erster', 'Dritter']);

    (container.querySelectorAll('.move-down-btn')[1] as HTMLButtonElement).click();
    await nextTick();
    expect(visibleTitles()).toEqual(['Zweiter', 'Dritter', 'Erster']);

    // Drag visible row 2 back to index 0
    await dragRowByPointer(container, 2, -120);
    expect(visibleTitles()).toEqual(['Erster', 'Zweiter', 'Dritter']);

    // Remove visible row 1 ('Zweiter')
    (container.querySelectorAll('.remove-btn')[1] as HTMLButtonElement).click();
    await nextTick();
    expect(selected.value).toEqual([999, 1, 3]);

    app.unmount();
  });
});
