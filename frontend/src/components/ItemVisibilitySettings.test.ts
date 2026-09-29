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

  it('renders radio group with private and shared cards', () => {
    const { container, cleanUp } = mountComponent('private');
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).toBeTruthy();

    const cards = container.querySelectorAll('.visibility-card');
    expect(cards.length).toBe(2);

    expect(cards[0].textContent).toContain('Nur für mich sichtbar');
    expect(cards[0].textContent).toContain('Privat');
    expect(cards[0].classList.contains('is-active')).toBe(true);
    expect(cards[0].getAttribute('aria-checked')).toBe('true');

    expect(cards[1].textContent).toContain('Für alle Mitreisenden sichtbar');
    expect(cards[1].textContent).toContain('Geteilt');
    expect(cards[1].classList.contains('is-active')).toBe(false);
    expect(cards[1].getAttribute('aria-checked')).toBe('false');

    cleanUp();
  });

  it('emits update:modelValue and switches active card on click', async () => {
    const { container, selected, cleanUp } = mountComponent('private');
    const cards = container.querySelectorAll<HTMLElement>('.visibility-card');

    cards[1].click();
    await nextTick();

    expect(selected.value).toBe('shared');
    expect(cards[1].classList.contains('is-active')).toBe(true);
    expect(cards[1].getAttribute('aria-checked')).toBe('true');
    expect(cards[0].classList.contains('is-active')).toBe(false);

    cleanUp();
  });

  it('navigates with keyboard arrow keys', async () => {
    const { container, selected, cleanUp } = mountComponent('private');
    const cards = container.querySelectorAll<HTMLElement>('.visibility-card');

    cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await nextTick();

    expect(selected.value).toBe('shared');

    cards[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await nextTick();

    expect(selected.value).toBe('private');

    cleanUp();
  });

  it('supports custom itemLabel prop', () => {
    const { container, cleanUp } = mountComponent('private', { itemLabel: 'Wanderroute' });
    expect(container.textContent).toContain('Wanderroute');
    cleanUp();
  });
});
