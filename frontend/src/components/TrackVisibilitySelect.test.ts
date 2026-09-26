// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TrackVisibilitySelect from './TrackVisibilitySelect.vue';

describe('TrackVisibilitySelect', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountSelect(initialValue: 'private' | 'shared' = 'private') {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const selected = ref(initialValue);
    const app = createApp({
      render: () =>
        h(TrackVisibilitySelect, {
          modelValue: selected.value,
          'onUpdate:modelValue': (val: 'private' | 'shared') => {
            selected.value = val;
          },
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

  it('renders trigger button with Tabler icon and label without emoji', () => {
    const { container, cleanUp } = mountSelect('private');
    const trigger = container.querySelector('.track-visibility-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger?.textContent).toContain('Nur für mich sichtbar (privat)');
    // Ensures no emojis in text
    expect(trigger?.textContent).not.toContain('🔒');
    expect(trigger?.textContent).not.toContain('👥');
    // Tabler SVG icon is rendered
    expect(trigger?.querySelector('svg')).toBeTruthy();

    cleanUp();
  });

  it('switches to shared view when modelValue is shared', () => {
    const { container, cleanUp } = mountSelect('shared');
    const trigger = container.querySelector('.track-visibility-trigger');
    expect(trigger?.textContent).toContain('Für alle Mitreisenden sichtbar');
    expect(trigger?.textContent).not.toContain('👥');
    expect(trigger?.textContent).not.toContain('🔒');

    cleanUp();
  });

  it('opens menu on click and emits update:modelValue on option selection', async () => {
    const { container, selected, cleanUp } = mountSelect('private');
    const trigger = container.querySelector('.track-visibility-trigger') as HTMLButtonElement;
    expect(document.querySelector('.track-visibility-menu')).toBeNull();

    trigger.click();
    await nextTick();

    const menu = document.querySelector('.track-visibility-menu');
    expect(menu).toBeTruthy();

    const items = menu?.querySelectorAll('.dropdown-item');
    expect(items?.length).toBe(2);
    expect(items?.[0].textContent).toContain('Nur für mich sichtbar (privat)');
    expect(items?.[1].textContent).toContain('Für alle Mitreisenden sichtbar');

    // Click on shared option
    (items?.[1] as HTMLElement).click();
    await nextTick();

    expect(selected.value).toBe('shared');
    expect(document.querySelector('.track-visibility-menu')).toBeNull();

    cleanUp();
  });

  it('updates via native hidden select for accessibility', async () => {
    const { container, selected, cleanUp } = mountSelect('private');
    const hiddenSelect = container.querySelector(
      '.track-visibility-hidden-select'
    ) as HTMLSelectElement;
    expect(hiddenSelect).toBeTruthy();

    hiddenSelect.value = 'shared';
    hiddenSelect.dispatchEvent(new Event('change'));
    await nextTick();

    expect(selected.value).toBe('shared');

    cleanUp();
  });
});
