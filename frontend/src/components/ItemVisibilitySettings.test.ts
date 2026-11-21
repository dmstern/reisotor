// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ItemVisibilitySettings from './ItemVisibilitySettings.vue';

describe('ItemVisibilitySettings', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountComponent(
    initialValue: 'private' | 'shared' = 'private',
    props: Record<string, unknown> = {}
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const selected = ref(initialValue);
    const app = createApp({
      render: () =>
        h(ItemVisibilitySettings, {
          modelValue: selected.value,
          'onUpdate:modelValue': (val: 'private' | 'shared') => {
            selected.value = val;
          },
          ...props,
        }),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      selected,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders radio group with private and shared RadioCard items', () => {
    const { container, cleanUp } = mountComponent('private');
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).toBeTruthy();

    const cards = container.querySelectorAll('.visibility-card');
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(cards.length).toBe(2);
    expect(inputs.length).toBe(2);

    expect(cards[0].textContent).toContain('Nur für mich sichtbar');
    expect(cards[0].textContent).toContain('Privat');
    expect(cards[0].classList.contains('is-checked')).toBe(true);
    expect(inputs[0].checked).toBe(true);

    expect(cards[1].textContent).toContain('Für alle Mitreisenden sichtbar');
    expect(cards[1].textContent).toContain('Geteilt');
    expect(cards[1].classList.contains('is-checked')).toBe(false);
    expect(inputs[1].checked).toBe(false);

    cleanUp();
  });

  it('emits update:modelValue and switches active card on radio change', async () => {
    const { container, selected, cleanUp } = mountComponent('private');
    const cards = container.querySelectorAll<HTMLElement>('.visibility-card');
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');

    inputs[1].checked = true;
    inputs[1].dispatchEvent(new Event('change'));
    await nextTick();

    expect(selected.value).toBe('shared');
    expect(cards[1].classList.contains('is-checked')).toBe(true);
    expect(inputs[1].checked).toBe(true);
    expect(cards[0].classList.contains('is-checked')).toBe(false);

    cleanUp();
  });

  it('renders info Alert primitive for hint by default and hides it when showHint=false', () => {
    const { container: withHint, cleanUp: cleanWithHint } = mountComponent('private');
    const alert = withHint.querySelector('.alert.alert--info');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain('Private Aufzeichnungen können jederzeit');
    cleanWithHint();

    const { container: withoutHint, cleanUp: cleanWithoutHint } = mountComponent('private', {
      showHint: false,
    });
    expect(withoutHint.querySelector('.alert')).toBeNull();
    cleanWithoutHint();
  });

  it('supports custom itemLabel prop', () => {
    const { container, cleanUp } = mountComponent('private', { itemLabel: 'Wanderroute' });
    expect(container.textContent).toContain('Wanderroute');
    cleanUp();
  });
});
