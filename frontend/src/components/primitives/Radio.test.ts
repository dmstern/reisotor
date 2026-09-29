// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import Radio from './Radio.vue';

describe('Radio primitive', () => {
  function mountRadio(props: Record<string, unknown> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(Radio, props),
    });
    const vm = app.mount(container);
    return {
      container,
      app,
      vm,
      cleanUp: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('renders a native radio input by default with correct attributes', () => {
    const { container, cleanUp } = mountRadio({
      id: 'test-radio',
      name: 'options',
      value: 'opt1',
      ariaLabel: 'Option 1',
    });

    const input = container.querySelector<HTMLInputElement>('input[type="radio"]');
    expect(input).not.toBeNull();
    expect(input?.id).toBe('test-radio');
    expect(input?.name).toBe('options');
    expect(input?.value).toBe('opt1');
    expect(input?.getAttribute('aria-label')).toBe('Option 1');
    expect(input?.checked).toBe(false);

    cleanUp();
  });

  it('reflects checked state via checked prop', () => {
    const { container, cleanUp } = mountRadio({
      checked: true,
    });

    const input = container.querySelector<HTMLInputElement>('input[type="radio"]');
    expect(input?.checked).toBe(true);

    cleanUp();
  });

  it('reflects checked state via modelValue matching value', () => {
    const { container, cleanUp } = mountRadio({
      modelValue: 'fastest',
      value: 'fastest',
    });

    const input = container.querySelector<HTMLInputElement>('input[type="radio"]');
    expect(input?.checked).toBe(true);

    cleanUp();
  });

  it('emits update:modelValue on user change', async () => {
    let emittedVal: unknown = null;
    const { container, cleanUp } = mountRadio({
      modelValue: 'shortest',
      value: 'fastest',
      'onUpdate:modelValue': (val: unknown) => {
        emittedVal = val;
      },
    });

    const input = container.querySelector<HTMLInputElement>('input[type="radio"]');
    input!.checked = true;
    input!.dispatchEvent(new Event('change'));
    await nextTick();

    expect(emittedVal).toBe('fastest');
    cleanUp();
  });

  it('renders visual-only span element without input when visualOnly=true', () => {
    const { container, cleanUp } = mountRadio({
      visualOnly: true,
      checked: true,
      size: 'sm',
    });

    expect(container.querySelector('input')).toBeNull();
    const span = container.querySelector<HTMLElement>('span.radio');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('aria-hidden')).toBe('true');
    expect(span?.classList.contains('is-checked')).toBe(true);
    expect(span?.classList.contains('radio--sm')).toBe(true);

    cleanUp();
  });

  it('applies disabled state to native input and visual element', () => {
    const { container: c1, cleanUp: clean1 } = mountRadio({ disabled: true });
    expect(c1.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
    clean1();

    const { container: c2, cleanUp: clean2 } = mountRadio({ visualOnly: true, disabled: true });
    expect(c2.querySelector('span.radio')?.classList.contains('is-disabled')).toBe(true);
    clean2();
  });
});
