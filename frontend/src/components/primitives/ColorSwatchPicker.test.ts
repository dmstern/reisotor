// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import ColorSwatchPicker from './ColorSwatchPicker.vue';

describe('ColorSwatchPicker', () => {
  it('rendert alle Farb-Swatches und markiert die aktive Farbe', async () => {
    const colors = ['#e34948', '#1baf7a', '#0ea5e9'];
    let selectedColor = '#1baf7a';

    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(ColorSwatchPicker, {
          modelValue: selectedColor,
          colors,
          'onUpdate:modelValue': (val: string) => {
            selectedColor = val;
          },
        }),
    });
    app.mount(container);

    await nextTick();

    const buttons = container.querySelectorAll<HTMLButtonElement>('button.swatch-btn');
    expect(buttons.length).toBe(3);

    expect(buttons[1].classList.contains('selected')).toBe(true);
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[0].classList.contains('selected')).toBe(false);
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');

    buttons[2].click();
    expect(selectedColor).toBe('#0ea5e9');

    app.unmount();
    container.remove();
  });
});
