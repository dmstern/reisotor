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

  it('reorders planned stations via drag and drop on the list dropzone', async () => {
    const spots = [makeSpot(1, 'Erster'), makeSpot(2, 'Zweiter'), makeSpot(3, 'Dritter')];
    const selected = ref<number[]>([1, 2, 3]);
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

    const rows = Array.from(container.querySelectorAll('.planned-row')) as HTMLElement[];
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () =>
        ({
          top: index * 50,
          height: 44,
          bottom: index * 50 + 44,
          left: 0,
          right: 300,
          width: 300,
          x: 0,
          y: index * 50,
          toJSON: () => ({}),
        }) as DOMRect;
    });

    const dropzone = container.querySelector('.planned-list-dropzone') as HTMLElement;
    expect(dropzone).not.toBeNull();

    rows[0].dispatchEvent(new Event('dragstart', { bubbles: true }));
    await nextTick();

    const dragOverEvent = Object.assign(
      new Event('dragover', { bubbles: true, cancelable: true }),
      {
        clientY: 140,
      }
    );
    dropzone.dispatchEvent(dragOverEvent);
    await nextTick();

    expect(rows[2].classList.contains('drop-after')).toBe(true);

    dropzone.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(selected.value).toEqual([2, 3, 1]);
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

    // Drag & drop visible row 2 back to index 0
    const rows = Array.from(container.querySelectorAll('.planned-row')) as HTMLElement[];
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () =>
        ({
          top: index * 50,
          height: 44,
          bottom: index * 50 + 44,
          left: 0,
          right: 300,
          width: 300,
          x: 0,
          y: index * 50,
          toJSON: () => ({}),
        }) as DOMRect;
    });

    const dropzone = container.querySelector('.planned-list-dropzone') as HTMLElement;
    rows[2].dispatchEvent(new Event('dragstart', { bubbles: true }));
    await nextTick();

    dropzone.dispatchEvent(
      Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), {
        clientY: 10,
      })
    );
    await nextTick();

    dropzone.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
    await nextTick();

    expect(visibleTitles()).toEqual(['Erster', 'Zweiter', 'Dritter']);

    // Remove visible row 1 ('Zweiter')
    (container.querySelectorAll('.remove-btn')[1] as HTMLButtonElement).click();
    await nextTick();
    expect(selected.value).toEqual([999, 1, 3]);

    app.unmount();
  });
});
