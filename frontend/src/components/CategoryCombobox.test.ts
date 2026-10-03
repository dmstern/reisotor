// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CategoryCombobox from './CategoryCombobox.vue';
import { useTripStore } from '../stores/trip';
import { api } from '../api/client';
import type { Trip } from '../api/types';

class MockEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}
vi.stubGlobal('EventSource', MockEventSource);

const mockTrip: Trip = {
  id: 42,
  name: 'Kreta',
  destination: 'Kreta',
  start_date: '2026-08-01',
  end_date: '2026-08-10',
  maps_link: null,
  image_url: null,
  packing_category_required: 1,
  weather_model: 'ecmwf_ifs025',
  lat: 35.24,
  lng: 24.8,
  owner_restricted: false,
};

describe('CategoryCombobox', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.spyOn(api, 'get').mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function render(props: Record<string, unknown>) {
    const app = createApp({
      render: () => h(CategoryCombobox, props as any),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('renders with expense defaults and leading icon when value matches', async () => {
    const html = await render({
      modelValue: 'Unterkunft',
      type: 'expense',
    });
    expect(html).toContain('has-leading-icon');
    expect(html).toContain('combobox-leading-icon');
    expect(html).toContain('placeholder="Kategorie (z. B. Essen &amp; Trinken, Unterkunft)"');
  });

  it('renders spot category defaults when type="spot"', async () => {
    const html = await render({
      modelValue: 'Restaurant',
      type: 'spot',
    });
    expect(html).toContain('has-leading-icon');
    expect(html).toContain('placeholder="Kategorie (z. B. Restaurant – oder eigene erstellen)"');
  });

  describe('Manage categories footer action', () => {
    function mountCategoryCombobox(props: Record<string, unknown> = {}) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = createApp({
        render: () => h(CategoryCombobox, props as any),
      });
      app.use(pinia);
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

    it('rendert den "Kategorien verwalten"-Button bei aktuellem Urlaub und ruft requestEditTrip auf', async () => {
      const tripStore = useTripStore();
      tripStore.trips = [mockTrip];
      tripStore.currentTripId = 42;
      const requestEditTripSpy = vi.spyOn(tripStore, 'requestEditTrip');

      const { container, cleanUp } = mountCategoryCombobox({
        modelValue: '',
        type: 'expense',
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      const manageBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="category-combobox-manage-btn"]'
      );
      expect(manageBtn).not.toBeNull();
      expect(manageBtn?.textContent).toContain('Kategorien verwalten');

      // Klick auf den Verwalten-Button
      manageBtn?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      manageBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await nextTick();

      expect(requestEditTripSpy).toHaveBeenCalledWith('categories', 'expense');

      cleanUp();
    });

    it('öffnet bei type="spot" die Kategorieverwaltung mit Spot-Fokus', async () => {
      const tripStore = useTripStore();
      tripStore.trips = [mockTrip];
      tripStore.currentTripId = 42;
      const requestEditTripSpy = vi.spyOn(tripStore, 'requestEditTrip');

      const { container, cleanUp } = mountCategoryCombobox({
        modelValue: '',
        type: 'spot',
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      const manageBtn = container.querySelector<HTMLButtonElement>(
        '[data-testid="category-combobox-manage-btn"]'
      );
      manageBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await nextTick();

      expect(requestEditTripSpy).toHaveBeenCalledWith('categories', 'spot');

      cleanUp();
    });

    it('blendet den Link aus, wenn showManageLink=false ist', async () => {
      const tripStore = useTripStore();
      tripStore.trips = [mockTrip];
      tripStore.currentTripId = 42;

      const { container, cleanUp } = mountCategoryCombobox({
        modelValue: '',
        type: 'expense',
        showManageLink: false,
      });

      const input = container.querySelector<HTMLInputElement>('input')!;
      input.dispatchEvent(new FocusEvent('focus'));
      await nextTick();

      const manageBtn = container.querySelector('[data-testid="category-combobox-manage-btn"]');
      expect(manageBtn).toBeNull();

      cleanUp();
    });
  });
});
