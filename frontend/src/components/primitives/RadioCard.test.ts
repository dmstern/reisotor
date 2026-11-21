// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import RadioCard from './RadioCard.vue';

describe('RadioCard primitive', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function mountGroup(initialValue = 'private') {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const selected = ref(initialValue);

    const app = createApp({
      render: () =>
        h('div', { role: 'radiogroup' }, [
          h(RadioCard, {
            modelValue: selected.value,
            name: 'vis',
            value: 'private',
            label: 'Privat',
            description: 'Nur für mich',
            'onUpdate:modelValue': (val: unknown) => {
              selected.value = String(val);
            },
          }),
          h(RadioCard, {
            modelValue: selected.value,
            name: 'vis',
            value: 'shared',
            label: 'Geteilt',
            description: 'Für alle',
            'onUpdate:modelValue': (val: unknown) => {
              selected.value = String(val);
            },
          }),
        ]),
    });

    app.mount(container);

    return {
      container,
      selected,
      cleanUp: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders cards with checked state reflecting modelValue', () => {
    const { container, cleanUp } = mountGroup('private');
    const cards = container.querySelectorAll('.radio-card');
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    expect(cards.length).toBe(2);
    expect(cards[0].classList.contains('is-checked')).toBe(true);
    expect(cards[1].classList.contains('is-checked')).toBe(false);
    expect(inputs[0].checked).toBe(true);
    expect(inputs[1].checked).toBe(false);

    cleanUp();
  });

  it('updates modelValue when selecting another card', async () => {
    const { container, selected, cleanUp } = mountGroup('private');
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    inputs[1].checked = true;
    inputs[1].dispatchEvent(new Event('change'));
    await nextTick();

    expect(selected.value).toBe('shared');
    const cards = container.querySelectorAll('.radio-card');
    expect(cards[0].classList.contains('is-checked')).toBe(false);
    expect(cards[1].classList.contains('is-checked')).toBe(true);

    cleanUp();
  });

  it('applies variant and radioPosition classes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(RadioCard, {
          variant: 'muted',
          radioPosition: 'right',
          label: 'Option',
          disabled: true,
        }),
    });
    app.mount(container);

    const card = container.querySelector('.radio-card');
    expect(card?.classList.contains('radio-card--muted')).toBe(true);
    expect(card?.classList.contains('radio-card--radio-right')).toBe(true);
    expect(card?.classList.contains('is-disabled')).toBe(true);

    app.unmount();
    container.remove();
  });
});
