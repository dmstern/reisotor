// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import CategoryIconPickerModal from './CategoryIconPickerModal.vue';
import { CATEGORY_ICON_PALETTE, type CategoryIconOption } from '../utils/categoryIcons';

function mountComponent(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props),
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

describe('CategoryIconPickerModal', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('rendert alle Icons, die Suche und den Symbol/Emoji-Toggle', async () => {
    const { cleanUp } = mountComponent(CategoryIconPickerModal, {
      modelValue: true,
      selectedIconId: 'bed',
    });

    await nextTick();

    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    expect(document.body.textContent).toContain('Symbol');
    expect(document.body.textContent).toContain('Emoji');
    expect(document.body.textContent).toContain('Unterkunft & Hotel');

    // Mindestens 100 Icons im Grid
    const items = document.querySelectorAll('.icon-grid-item');
    expect(items.length).toBe(CATEGORY_ICON_PALETTE.length);
    expect(items.length).toBeGreaterThanOrEqual(100);

    // Ausgewähltes Icon besitzt .is-selected
    const selected = document.querySelector('.icon-grid-item.is-selected');
    expect(selected).toBeTruthy();
    expect(selected?.textContent).toContain('Unterkunft');

    cleanUp();
  });

  it('filtert die Icons nach Suchbegriff', async () => {
    const { cleanUp } = mountComponent(CategoryIconPickerModal, {
      modelValue: true,
    });

    await nextTick();

    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'Pizza';
    searchInput.dispatchEvent(new Event('input'));

    await nextTick();

    const items = document.querySelectorAll('.icon-grid-item');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(document.body.textContent).toContain('Pizza & Pasta');

    cleanUp();
  });

  it('zeigt den Leer-Zustand, wenn kein Icon gefunden wird', async () => {
    const { cleanUp } = mountComponent(CategoryIconPickerModal, {
      modelValue: true,
    });

    await nextTick();

    const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
    searchInput.value = 'UnbekanntesIconXYZ123';
    searchInput.dispatchEvent(new Event('input'));

    await nextTick();

    const items = document.querySelectorAll('.icon-grid-item');
    expect(items.length).toBe(0);
    expect(document.body.textContent).toContain('Keine Icons für „UnbekanntesIconXYZ123“ gefunden');

    // Klick auf "Filter zurücksetzen" leert das Suchfeld
    const resetBtn = document.querySelector('.empty-state button') as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    resetBtn.click();

    await nextTick();

    const resetItems = document.querySelectorAll('.icon-grid-item');
    expect(resetItems.length).toBe(CATEGORY_ICON_PALETTE.length);

    cleanUp();
  });

  it('emittiert select und schließt beim Klick auf ein Icon', async () => {
    let selectedOption: CategoryIconOption | null = null;
    let closed = false;

    const { cleanUp } = mountComponent(CategoryIconPickerModal, {
      modelValue: true,
      'onUpdate:modelValue': (val: boolean) => {
        if (!val) closed = true;
      },
      onSelect: (opt: CategoryIconOption) => {
        selectedOption = opt;
      },
    });

    await nextTick();

    const items = Array.from(document.querySelectorAll('.icon-grid-item')) as HTMLButtonElement[];
    const coffeeBtn = items.find((btn) => btn.textContent?.includes('Café'));
    expect(coffeeBtn).toBeTruthy();

    coffeeBtn?.click();
    await nextTick();

    expect(selectedOption).toMatchObject({
      id: 'coffee',
      defaultEmoji: '☕',
    });
    expect(closed).toBe(true);

    cleanUp();
  });
});
