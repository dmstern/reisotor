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

  it('positioniert die Pille bei gemessener Button-Größe exakt ohne doppelten Padding-Versatz', async () => {
    const state = { val: 'off' };
    app = createApp(
      defineComponent({
        render: () =>
          h(SegmentedToggle, {
            modelValue: state.val,
            options,
            'onUpdate:modelValue': (v: string) => {
              state.val = v;
            },
          }),
      })
    );
    app.mount(container);
    await nextTick();

    const buttons = container.querySelectorAll<HTMLButtonElement>('.segmented-option');
    Object.defineProperty(buttons[2], 'offsetLeft', { value: 124, configurable: true });
    Object.defineProperty(buttons[2], 'offsetTop', { value: 4, configurable: true });
    Object.defineProperty(buttons[2], 'offsetWidth', { value: 96, configurable: true });
    Object.defineProperty(buttons[2], 'offsetHeight', { value: 28, configurable: true });

    buttons[2].click();
    app.unmount();

    // Re-mount with mocked HTMLElement prototype metrics to verify initial mount measurement
    const origOffsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft');
    const origOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
    const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      get: () => 124,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetTop', { get: () => 4, configurable: true });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      get: () => 96,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      get: () => 28,
      configurable: true,
    });

    try {
      mountComponent('balanced');
      await nextTick();

      const thumb = container.querySelector('.segmented-thumb') as HTMLElement;
      expect(thumb).not.toBeNull();
      expect(thumb.style.top).toBe('0px');
      expect(thumb.style.left).toBe('0px');
      expect(thumb.style.transform).toBe('translate(124px, 4px)');
      expect(thumb.style.width).toBe('96px');
      expect(thumb.style.height).toBe('28px');
    } finally {
      if (origOffsetLeft) {
        Object.defineProperty(HTMLElement.prototype, 'offsetLeft', origOffsetLeft);
      }

      if (origOffsetTop) {
        Object.defineProperty(HTMLElement.prototype, 'offsetTop', origOffsetTop);
      }

      if (origOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidth);
      }

      if (origOffsetHeight) {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight);
      }
    }
  });
});
