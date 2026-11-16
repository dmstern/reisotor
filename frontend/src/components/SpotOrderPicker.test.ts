// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import SpotOrderPicker from './SpotOrderPicker.vue';
import type { Spot } from '../api/types';

describe('SpotOrderPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    document.body.innerHTML = '';
  });

  const spots: Spot[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Aussichtspunkt',
      category: 'Aussichtspunkt',
      created_by: 1,
      is_home: 0,
    } as unknown as Spot,
  ];

  const likeCount = (_id: number) => 0;

  function mountComponent(props: {
    modelValue: number[];
    spots: Spot[];
    likeCount: (id: number) => number;
    onCreateSpot?: () => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(SpotOrderPicker, {
          modelValue: props.modelValue,
          spots: props.spots,
          likeCount: props.likeCount,
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

  it('renders create-spot button and emits create-spot on click', async () => {
    let created = false;
    const { container } = mountComponent({
      modelValue: [],
      spots,
      likeCount,
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
  });

  it('renders fieldset and empty hint even when no spots exist', async () => {
    const { container } = mountComponent({
      modelValue: [],
      spots: [],
      likeCount,
    });

    const picker = container.querySelector('fieldset.spot-picker');
    expect(picker).not.toBeNull();

    const emptyHint = container.querySelector('.spot-picker-empty');
    expect(emptyHint).not.toBeNull();
    expect(emptyHint?.textContent).toContain('Noch keine Spots angelegt.');

    const createBtn = container.querySelector('.spot-picker-create-btn');
    expect(createBtn).not.toBeNull();
  });
});
