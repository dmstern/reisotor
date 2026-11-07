// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ToggleSwitch from './ToggleSwitch.vue';

describe('ToggleSwitch primitive', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders with role="switch" and aria-checked="false" by default', async () => {
    const app = createApp({
      render: () => h(ToggleSwitch),
    });
    const html = await renderToString(app);
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('is-active');
  });

  it('renders active state when modelValue is true', async () => {
    const app = createApp({
      render: () => h(ToggleSwitch, { modelValue: true }),
    });
    const html = await renderToString(app);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('is-active');
  });

  it('supports size classes (sm, md, lg)', async () => {
    const appSm = createApp({ render: () => h(ToggleSwitch, { size: 'sm' }) });
    expect(await renderToString(appSm)).toContain('toggle-switch--sm');

    const appMd = createApp({ render: () => h(ToggleSwitch, { size: 'md' }) });
    expect(await renderToString(appMd)).toContain('toggle-switch--md');

    const appLg = createApp({ render: () => h(ToggleSwitch, { size: 'lg' }) });
    expect(await renderToString(appLg)).toContain('toggle-switch--lg');
  });

  it('applies aria-label and id correctly', async () => {
    const app = createApp({
      render: () => h(ToggleSwitch, { id: 'custom-switch', ariaLabel: 'Urlaubsregion' }),
    });
    const html = await renderToString(app);
    expect(html).toContain('id="custom-switch"');
    expect(html).toContain('aria-label="Urlaubsregion"');
  });

  it('toggles value when clicked and emits update:modelValue', async () => {
    let emittedVal: boolean | null = null;
    const model = ref(false);

    const app = createApp({
      render: () =>
        h(ToggleSwitch, {
          modelValue: model.value,
          'onUpdate:modelValue': (val: boolean) => {
            emittedVal = val;
            model.value = val;
          },
        }),
    });
    app.mount(container);
    await nextTick();

    const btn = container.querySelector<HTMLButtonElement>('button')!;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-checked')).toBe('false');

    btn.click();
    await nextTick();

    expect(emittedVal).toBe(true);
    expect(model.value).toBe(true);
    expect(btn.getAttribute('aria-checked')).toBe('true');
    app.unmount();
  });

  it('does not toggle when disabled', async () => {
    let emitted = false;
    const app = createApp({
      render: () =>
        h(ToggleSwitch, {
          modelValue: false,
          disabled: true,
          'onUpdate:modelValue': () => {
            emitted = true;
          },
        }),
    });
    app.mount(container);
    await nextTick();

    const btn = container.querySelector<HTMLButtonElement>('button')!;
    expect(btn.disabled).toBe(true);
    btn.click();
    await nextTick();

    expect(emitted).toBe(false);
    app.unmount();
  });
});
