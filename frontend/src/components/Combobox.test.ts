// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import Combobox from './Combobox.vue';
import { expenseCategoryMeta } from '../utils/expenseCategory';

describe('Combobox', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function render(props: any) {
    const app = createApp({
      render: () => h(Combobox, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders input without leading icon when modelValue is empty', async () => {
    const html = await render({
      modelValue: '',
      options: ['Unterkunft', 'Transport'],
      iconDefFor: (c: string) => expenseCategoryMeta(c).tabler,
      colorFor: (c: string) => expenseCategoryMeta(c).color,
      placeholder: 'Kategorie auswählen',
    });
    expect(html).toContain('placeholder="Kategorie auswählen"');
    expect(html).not.toContain('has-leading-icon');
    expect(html).not.toContain('combobox-leading-icon');
  });

  it('renders leading icon when modelValue is present and matched', async () => {
    const html = await render({
      modelValue: 'Unterkunft',
      options: ['Unterkunft', 'Transport'],
      iconDefFor: (c: string) => expenseCategoryMeta(c).tabler,
      colorFor: (c: string) => expenseCategoryMeta(c).color,
      placeholder: 'Kategorie auswählen',
    });
    expect(html).toContain('has-leading-icon');
    expect(html).toContain('combobox-leading-icon');
    expect(html).toContain('app-icon');
  });

  it('renders icon with custom color if provided', async () => {
    const html = await render({
      modelValue: 'Unterkunft',
      options: ['Unterkunft'],
      iconDefFor: (c: string) => expenseCategoryMeta(c).tabler,
      colorFor: () => '#1baf7a',
    });
    expect(html).toMatch(/color:\s*#1baf7a/);
  });

  it('renders combobox ARIA attributes and footer slot when provided', async () => {
    const app = createApp({
      render: () =>
        h(
          Combobox,
          {
            modelValue: '',
            options: ['Option 1'],
            id: 'category-select',
          },
          {
            footer: () => h('button', { class: 'custom-footer-btn' }, 'Kategorien verwalten'),
          }
        ),
    });
    app.use(createPinia());
    const html = await renderToString(app);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('id="category-select"');
  });

  describe('Keyboard navigation & selection (DOM)', () => {
    function mountCombobox(props: any = {}, slots: any = {}) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = createApp({
        render: () => h(Combobox, props, slots),
      });
      app.use(createPinia());
      const vm = app.mount(container);
      return {
        container,
        app,
        vm,
        cleanUp: () => {
          app.unmount();
          container.remove();
          document.body.innerHTML = '';
        },
      };
    }

    it('wählt bei einzelnem Treffer (Teilstring) bei Enter direkt die gefundene Option', async () => {
      let selectedValue = '';
      let updatedValue = '';

      const { container, cleanUp } = mountCombobox({
        modelValue: 'FLUG',
        options: ['Flughafen', 'Unterkunft', 'Restaurant'],
        'onUpdate:modelValue': (val: string) => {
          updatedValue = val;
        },
        onSelect: (val: string) => {
          selectedValue = val;
        },
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      // Bei "FLUG" bleibt nur "Flughafen" übrig -> wird automatisch hervorgehoben
      const listbox = document.body.querySelector('.options');
      expect(listbox).not.toBeNull();
      const optionItems = document.body.querySelectorAll('.options li');
      expect(optionItems).toHaveLength(1);
      expect(optionItems[0].textContent).toContain('Flughafen');
      expect(optionItems[0].classList.contains('is-highlighted')).toBe(true);

      // Enter drücken
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(enterEvent);
      await nextTick();

      expect(enterEvent.defaultPrevented).toBe(true);
      expect(selectedValue).toBe('Flughafen');
      expect(updatedValue).toBe('Flughafen');

      cleanUp();
    });

    it('navigiert mit Pfeiltasten bei mehreren Treffern und bestätigt mit Enter', async () => {
      let selectedValue = '';

      const { container, cleanUp } = mountCombobox({
        modelValue: '',
        options: ['Flughafen', 'Flugplatz', 'Flugreise'],
        onSelect: (val: string) => {
          selectedValue = val;
        },
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      // Pfeil nach unten: 1. Option ("Flughafen")
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextTick();
      let items = document.body.querySelectorAll('.options li');
      expect(items[0].classList.contains('is-highlighted')).toBe(true);
      expect(items[1].classList.contains('is-highlighted')).toBe(false);

      // Pfeil nach unten: 2. Option ("Flugplatz")
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextTick();
      items = document.body.querySelectorAll('.options li');
      expect(items[0].classList.contains('is-highlighted')).toBe(false);
      expect(items[1].classList.contains('is-highlighted')).toBe(true);

      // Enter drücken -> wählt "Flugplatz"
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(enterEvent);
      await nextTick();

      expect(selectedValue).toBe('Flugplatz');

      cleanUp();
    });

    it('wrappt mit Pfeil nach oben von der ersten zur letzten Option', async () => {
      const { container, cleanUp } = mountCombobox({
        modelValue: '',
        options: ['Erste', 'Zweite', 'Dritte'],
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      // ArrowUp bei initial -1 oder 0 wrappt zum letzten Element ("Dritte")
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await nextTick();

      const items = document.body.querySelectorAll('.options li');
      expect(items[2].classList.contains('is-highlighted')).toBe(true);

      // Escape schließt das Menü
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      await nextTick();
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(container.querySelector('.combobox')?.classList.contains('open')).toBe(false);

      cleanUp();
    });

    it('rendert den Footer-Slot und hält Dropdown bei Fokus auf Footer-Element offen', async () => {
      const { container, cleanUp } = mountCombobox(
        {
          modelValue: '',
          options: ['Option A'],
        },
        {
          footer: () => h('button', { class: 'footer-manage-btn' }, 'Verwalten'),
        }
      );

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      const footerBtn = document.body.querySelector('.footer-manage-btn');
      expect(footerBtn).not.toBeNull();
      expect(footerBtn?.textContent).toBe('Verwalten');

      cleanUp();
    });

    it('zeigt alle Optionen an, wenn der bestehende Wert einer Option entspricht, und filtert erst beim Tippen', async () => {
      const options = ['Unterkunft', 'Restaurant', 'Café', 'Aktivität'];
      let currentValue = 'Café';

      const { container, cleanUp } = mountCombobox({
        modelValue: currentValue,
        options,
        'onUpdate:modelValue': (val: string) => {
          currentValue = val;
        },
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      // Dropdown ist offen und zeigt ALLE 4 Optionen (trotz "Café" als aktuellem Wert)
      const listbox = document.body.querySelector('.options');
      expect(listbox).not.toBeNull();
      let optionItems = document.body.querySelectorAll('.options li');
      expect(optionItems).toHaveLength(4);

      // "Café" ist vorselektiert / hervorgehoben (Index 2)
      expect(optionItems[2].textContent).toContain('Café');
      expect(optionItems[2].classList.contains('is-selected')).toBe(true);
      expect(optionItems[2].classList.contains('is-highlighted')).toBe(true);

      // Nutzer tippt Teilstring "res" -> nun wird aktiv gefiltert
      input.value = 'res';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();

      optionItems = document.body.querySelectorAll('.options li');
      expect(optionItems).toHaveLength(1);
      expect(optionItems[0].textContent).toContain('Restaurant');

      cleanUp();
    });

    it('erlaubt das direkte Auswählen einer anderen Option mit Pfeiltasten bei bestehender Auswahl', async () => {
      const options = ['Unterkunft', 'Restaurant', 'Café', 'Aktivität'];
      let selected = '';

      const { container, cleanUp } = mountCombobox({
        modelValue: 'Café',
        options,
        onSelect: (val: string) => {
          selected = val;
        },
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      // Café ist an Index 2. Einmal ArrowDown bewegt die Hervorhebung auf Index 3 ("Aktivität")
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await nextTick();

      const optionItems = document.body.querySelectorAll('.options li');
      expect(optionItems[3].classList.contains('is-highlighted')).toBe(true);
      expect(optionItems[3].textContent).toContain('Aktivität');

      // Enter drücken -> wählt "Aktivität"
      input.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
      await nextTick();

      expect(selected).toBe('Aktivität');

      cleanUp();
    });

    it('teleports the dropdown menu to document.body on top level (issue #722)', async () => {
      const { container, cleanUp } = mountCombobox({
        modelValue: '',
        options: ['Erste Option', 'Zweite Option'],
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      const menuInContainer = container.querySelector('.combobox-menu');
      const menuInBody = document.body.querySelector('.combobox-menu');

      expect(menuInContainer).toBeNull();
      expect(menuInBody).not.toBeNull();
      expect(menuInBody?.classList.contains('is-teleported')).toBe(true);

      cleanUp();
    });
  });
});
