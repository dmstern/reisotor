// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import Modal from './Modal.vue';

function mountTestApp(
  rootComponent: Component,
  props: Record<string, unknown> = {},
  slots: Record<string, () => unknown> = {}
) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props, slots),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('Modal', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('renders title and slot content when open', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: true, title: 'Spot bearbeiten' },
      { default: () => h('div', { class: 'test-content' }, 'Formular-Inhalt') }
    );
    await nextTick();

    const titleEl = document.querySelector('h2');
    expect(titleEl?.textContent).toBe('Spot bearbeiten');
    expect(document.querySelector('.test-content')?.textContent).toBe('Formular-Inhalt');
    expect(document.querySelector('.modal-scroll-shadow--top')).toBeTruthy();
    expect(document.querySelector('.modal-scroll-shadow--bottom')).toBeTruthy();

    cleanUp();
  });

  it('does not render content when modelValue is false', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: false, title: 'Geschlossen' },
      { default: () => h('div', 'Geheimer Inhalt') }
    );
    await nextTick();

    expect(document.querySelector('.modal')).toBeNull();
    cleanUp();
  });

  it('detects when content is scrollable and updates scroll affordance classes', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: true, title: 'Scroll-Test', fullHeight: true },
      {
        default: () =>
          h('form', { class: 'edit-form' }, [
            h('div', { style: 'height: 1000px;' }, 'Langer Inhalt'),
            h('div', { class: 'actions-row' }, 'Buttons'),
          ]),
      }
    );
    await nextTick();

    const modalEl = document.querySelector('.modal') as HTMLElement;
    const formEl = document.querySelector('form') as HTMLElement;
    expect(modalEl).toBeTruthy();
    expect(formEl).toBeTruthy();
    expect(modalEl.classList.contains('has-actions-row')).toBe(true);

    // Mock scroll dimensions on formEl
    Object.defineProperty(formEl, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(formEl, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(formEl, 'scrollTop', { value: 0, writable: true, configurable: true });

    // Trigger scroll event at top (scrollTop: 0)
    formEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(false);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);

    const topShadow = document.querySelector('.modal-scroll-shadow--top') as HTMLElement;
    expect(topShadow.classList.contains('is-visible')).toBe(false);

    // Scroll down to middle (scrollTop: 200)
    formEl.scrollTop = 200;
    formEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(true);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);
    expect(topShadow.classList.contains('is-visible')).toBe(true);

    // Scroll all the way to bottom (scrollTop: 700 -> 700 + 300 = 1000)
    formEl.scrollTop = 700;
    formEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(true);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(false);

    cleanUp();
  });

  it('keeps both shadows inactive when content fits without scrolling', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: true, title: 'Kurzer Dialog', fullHeight: true },
      {
        default: () => h('form', { class: 'edit-form' }, [h('div', 'Kurzer Inhalt')]),
      }
    );
    await nextTick();

    const modalEl = document.querySelector('.modal') as HTMLElement;
    const formEl = document.querySelector('form') as HTMLElement;

    // Dimensions fit completely
    Object.defineProperty(formEl, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(formEl, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(formEl, 'scrollTop', { value: 0, writable: true, configurable: true });

    formEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(false);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(false);

    const topShadow = document.querySelector('.modal-scroll-shadow--top') as HTMLElement;
    const bottomShadow = document.querySelector('.modal-scroll-shadow--bottom') as HTMLElement;

    expect(topShadow.classList.contains('is-visible')).toBe(false);
    expect(bottomShadow.classList.contains('is-visible')).toBe(false);

    cleanUp();
  });
});
