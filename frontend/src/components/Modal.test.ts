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
    expect(document.querySelector('.modal-scroll-fade--top')).toBeTruthy();
    expect(document.querySelector('.modal-scroll-fade--bottom')).toBeTruthy();

    cleanUp();
  });

  it('renders custom title via slot when provided', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: true },
      {
        title: () => h('span', { class: 'custom-title' }, 'Eigener Titel mit Icon'),
        default: () => h('div', 'Formular-Inhalt'),
      }
    );
    await nextTick();

    const titleEl = document.querySelector('h2');
    expect(titleEl?.querySelector('.custom-title')?.textContent).toBe('Eigener Titel mit Icon');

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
    const bodyEl = document.querySelector('.modal-body') as HTMLElement;
    const formEl = document.querySelector('form') as HTMLElement;
    expect(modalEl).toBeTruthy();
    expect(bodyEl).toBeTruthy();
    expect(formEl).toBeTruthy();
    expect(modalEl.classList.contains('has-actions-row')).toBe(true);

    // Mock scroll dimensions on bodyEl (the scroll container with overflow-y: auto)
    Object.defineProperty(bodyEl, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(bodyEl, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(bodyEl, 'scrollTop', { value: 0, writable: true, configurable: true });

    // Trigger scroll event at top (scrollTop: 0)
    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(false);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);

    const topFade = document.querySelector('.modal-scroll-fade--top') as HTMLElement;
    expect(topFade.classList.contains('is-visible')).toBe(false);

    // Scroll down to middle (scrollTop: 200)
    bodyEl.scrollTop = 200;
    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(true);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);
    expect(topFade.classList.contains('is-visible')).toBe(true);

    // Scroll all the way to bottom (scrollTop: 700 -> 700 + 300 = 1000)
    bodyEl.scrollTop = 700;
    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(true);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(false);

    // Scroll back to top (scrollTop: 0)
    bodyEl.scrollTop = 0;
    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(false);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);
    expect(topFade.classList.contains('is-visible')).toBe(false);

    cleanUp();
  });

  it('keeps both fades inactive when content fits without scrolling', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: true, title: 'Kurzer Dialog', fullHeight: true },
      {
        default: () => h('form', { class: 'edit-form' }, [h('div', 'Kurzer Inhalt')]),
      }
    );
    await nextTick();

    const modalEl = document.querySelector('.modal') as HTMLElement;
    const bodyEl = document.querySelector('.modal-body') as HTMLElement;

    // Dimensions fit completely
    Object.defineProperty(bodyEl, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(bodyEl, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(bodyEl, 'scrollTop', { value: 0, writable: true, configurable: true });

    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(false);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(false);

    const topFade = document.querySelector('.modal-scroll-fade--top') as HTMLElement;
    const bottomFade = document.querySelector('.modal-scroll-fade--bottom') as HTMLElement;

    expect(topFade.classList.contains('is-visible')).toBe(false);
    expect(bottomFade.classList.contains('is-visible')).toBe(false);

    cleanUp();
  });

  it('shows fade-out indicators on standard (non-fullHeight) dialogs when content overflows', async () => {
    const { cleanUp } = mountTestApp(
      Modal,
      { modelValue: true, title: 'Standard-Dialog ohne full-height' },
      {
        default: () => h('div', { class: 'dialog-content' }, 'Langer Dialoginhalt ohne Formular'),
      }
    );
    await nextTick();

    const modalEl = document.querySelector('.modal') as HTMLElement;
    const bodyEl = document.querySelector('.modal-body') as HTMLElement;
    expect(modalEl).toBeTruthy();
    expect(bodyEl).toBeTruthy();
    expect(modalEl.classList.contains('has-actions-row')).toBe(false);

    // Mock scroll dimensions on bodyEl
    Object.defineProperty(bodyEl, 'clientHeight', { value: 250, configurable: true });
    Object.defineProperty(bodyEl, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(bodyEl, 'scrollTop', { value: 0, writable: true, configurable: true });

    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(false);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);

    const topFade = document.querySelector('.modal-scroll-fade--top') as HTMLElement;
    const bottomFade = document.querySelector('.modal-scroll-fade--bottom') as HTMLElement;

    expect(topFade.classList.contains('is-visible')).toBe(false);
    expect(bottomFade.classList.contains('is-visible')).toBe(true);

    // Scroll to middle
    bodyEl.scrollTop = 200;
    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(true);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(true);
    expect(topFade.classList.contains('is-visible')).toBe(true);
    expect(bottomFade.classList.contains('is-visible')).toBe(true);

    // Scroll to bottom (550 + 250 = 800)
    bodyEl.scrollTop = 550;
    bodyEl.dispatchEvent(new Event('scroll'));
    await nextTick();

    expect(modalEl.classList.contains('can-scroll-up')).toBe(true);
    expect(modalEl.classList.contains('can-scroll-down')).toBe(false);
    expect(topFade.classList.contains('is-visible')).toBe(true);
    expect(bottomFade.classList.contains('is-visible')).toBe(false);

    cleanUp();
  });

  it('closes immediately on close button click when confirmClose is false', async () => {
    let closed = false;
    const { cleanUp } = mountTestApp(Modal, {
      modelValue: true,
      title: 'Test',
      confirmClose: false,
      'onUpdate:modelValue': (v: boolean) => {
        if (!v) closed = true;
      },
    });
    await nextTick();

    const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    expect(closed).toBe(true);
    expect(document.querySelector('.confirm-close-dialog')).toBeNull();
    cleanUp();
  });

  it('shows confirmation dialog on close button click when confirmClose is true', async () => {
    let closed = false;
    const { cleanUp } = mountTestApp(Modal, {
      modelValue: true,
      title: 'Test',
      confirmClose: true,
      confirmCloseTitle: 'Ungespeicherte Änderungen verwerfen?',
      'onUpdate:modelValue': (v: boolean) => {
        if (!v) closed = true;
      },
    });
    await nextTick();

    const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    expect(closed).toBe(false);
    const confirmDialog = document.querySelector('.confirm-close-dialog');
    expect(confirmDialog).not.toBeNull();
    expect(confirmDialog?.textContent).toContain('Ungespeicherte Änderungen verwerfen?');
    const actionBtns = confirmDialog?.querySelectorAll('.confirm-close-actions button');
    expect(actionBtns?.length).toBe(2);
    expect(actionBtns?.[0].textContent).toContain('Weiter bearbeiten');
    expect(actionBtns?.[1].textContent).toContain('Änderungen verwerfen');
    cleanUp();
  });

  it('cancels close confirmation when clicking cancel button', async () => {
    let closed = false;
    const { cleanUp } = mountTestApp(Modal, {
      modelValue: true,
      title: 'Test',
      confirmClose: true,
      'onUpdate:modelValue': (v: boolean) => {
        if (!v) closed = true;
      },
    });
    await nextTick();

    const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    const cancelBtn = Array.from(document.querySelectorAll('.confirm-close-actions button')).find(
      (b) => b.textContent?.includes('Weiter bearbeiten')
    ) as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();
    await nextTick();

    expect(closed).toBe(false);
    expect(document.querySelector('.confirm-close-dialog')).toBeNull();
    cleanUp();
  });

  it('confirms close when clicking discard button and emits discard event', async () => {
    let closed = false;
    let discarded = false;
    const { cleanUp } = mountTestApp(Modal, {
      modelValue: true,
      title: 'Test',
      confirmClose: true,
      'onUpdate:modelValue': (v: boolean) => {
        if (!v) closed = true;
      },
      onDiscard: () => {
        discarded = true;
      },
    });
    await nextTick();

    const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    const discardBtn = Array.from(document.querySelectorAll('.confirm-close-actions button')).find(
      (b) => b.textContent?.includes('Änderungen verwerfen')
    ) as HTMLButtonElement;
    expect(discardBtn).not.toBeNull();
    discardBtn.click();
    await nextTick();

    expect(discarded).toBe(true);
    expect(closed).toBe(true);
    cleanUp();
  });

  it('formats draft mode confirmation texts with entity correctly', async () => {
    const { cleanUp } = mountTestApp(Modal, {
      modelValue: true,
      title: 'Test',
      confirmClose: true,
      confirmCloseMode: 'draft',
      confirmCloseEntity: 'Termin',
    });
    await nextTick();

    const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    const titleEl = document.querySelector('.confirm-close-dialog h2');
    const messageEl = document.querySelector('.confirm-close-message');
    const discardBtn = Array.from(document.querySelectorAll('.confirm-close-actions button')).find(
      (b) => b.textContent?.includes('Entwurf verwerfen')
    );

    expect(titleEl?.textContent?.trim()).toBe('Entwurf verwerfen?');
    expect(messageEl?.textContent?.trim()).toBe(
      'Du hast bereits Eingaben für diesen Termin gemacht. Möchtest du den Entwurf verwerfen?'
    );
    expect(discardBtn).not.toBeNull();
    cleanUp();
  });

  it('formats unsaved mode confirmation texts with entity correctly', async () => {
    const { cleanUp } = mountTestApp(Modal, {
      modelValue: true,
      title: 'Test',
      confirmClose: true,
      confirmCloseMode: 'unsaved',
      confirmCloseEntity: 'Tour',
    });
    await nextTick();

    const closeBtn = document.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();
    await nextTick();

    const titleEl = document.querySelector('.confirm-close-dialog h2');
    const messageEl = document.querySelector('.confirm-close-message');
    const discardBtn = Array.from(document.querySelectorAll('.confirm-close-actions button')).find(
      (b) => b.textContent?.includes('Änderungen verwerfen')
    );

    expect(titleEl?.textContent?.trim()).toBe('Ungespeicherte Änderungen verwerfen?');
    expect(messageEl?.textContent?.trim()).toBe(
      'Du hast ungespeicherte Änderungen an dieser Tour vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?'
    );
    expect(discardBtn).not.toBeNull();
    cleanUp();
  });
});
