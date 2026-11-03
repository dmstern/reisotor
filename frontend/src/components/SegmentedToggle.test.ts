// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import SegmentedToggle from './SegmentedToggle.vue';

describe('SegmentedToggle', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp>;

  const options = [
    { value: 'off', label: 'Aus' },
    { value: 'essential', label: 'Nötigste' },
    { value: 'balanced', label: 'Ausgewogen' },
    { value: 'all', label: 'Alles' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function mountComponent(modelValue: string, onUpdate?: (val: string) => void) {
    app = createApp(
      defineComponent({
        render: () =>
          h(SegmentedToggle, {
            modelValue,
            options,
            'onUpdate:modelValue': onUpdate,
          }),
      })
    );
    app.mount(container);
  }

  it('markiert die aktive Option und rendert die Pille', async () => {
    mountComponent('balanced');
    await nextTick();

    const activeBtn = container.querySelector('.segmented-option.active');
    expect(activeBtn?.textContent).toContain('Ausgewogen');

    const thumb = container.querySelector('.segmented-thumb');
    expect(thumb).not.toBeNull();
  });

  it('löst update:modelValue bei Klick auf ein Segment aus', async () => {
    let selected = '';
    mountComponent('off', (val) => {
      selected = val;
    });
    await nextTick();

    const buttons = container.querySelectorAll<HTMLButtonElement>('.segmented-option');
    expect(buttons.length).toBe(4);

    buttons[2].click();
    await nextTick();

    expect(selected).toBe('balanced');
  });

  it('blendet die Pille aus, wenn modelValue keiner Option entspricht', async () => {
    mountComponent('custom');
    await nextTick();

    const thumb = container.querySelector('.segmented-thumb');
    expect(thumb).toBeNull();
  });
});
