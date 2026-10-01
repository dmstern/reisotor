// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import TripForm from './TripForm.vue';
import type { TripFormData } from '../stores/trip';

describe('TripForm', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountForm(props: Record<string, unknown> = {}, listeners: Record<string, unknown> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(TripForm, { ...props, ...listeners }),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  const sampleInitial: TripFormData = {
    name: 'Sommerurlaub Italien',
    destination: 'Toskana',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    maps_link: '',
    image_url: '',
    packing_category_required: true,
    weather_model: 'ecmwf_ifs025',
  };

  it('does not render the delete button when creating a new trip (no initial data)', () => {
    const { container, cleanUp } = mountForm();
    const deleteBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Löschen')
    );
    expect(deleteBtn).toBeUndefined();
    cleanUp();
  });

  it('renders the delete button when editing an existing trip (with initial data)', () => {
    const { container, cleanUp } = mountForm({ initial: sampleInitial });
    const deleteBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Löschen')
    );
    expect(deleteBtn).toBeDefined();
    expect(deleteBtn?.classList.contains('btn--danger')).toBe(true);
    expect(deleteBtn?.classList.contains('btn--secondary')).toBe(true);
    expect(deleteBtn?.classList.contains('btn--sm')).toBe(false);
    cleanUp();
  });

  it('emits delete event when delete button is clicked', async () => {
    let deleted = false;
    const { container, cleanUp } = mountForm(
      { initial: sampleInitial },
      {
        onDelete: () => {
          deleted = true;
        },
      }
    );

    const deleteBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Löschen')
    );
    expect(deleteBtn).toBeDefined();
    deleteBtn?.click();
    await nextTick();

    expect(deleted).toBe(true);
    cleanUp();
  });

  it('renders vacation beach fallback icon instead of home icon in the cover picker placeholder', () => {
    const { container, cleanUp } = mountForm();
    const placeholder = container.querySelector('.form-image-banner .placeholder');
    const hasBeachIcon =
      placeholder?.classList.contains('tabler-icon-beach') ||
      placeholder?.querySelector('.tabler-icon-beach') !== null ||
      placeholder?.textContent?.includes('🏖️');
    const hasHomeIcon =
      placeholder?.classList.contains('tabler-icon-home') ||
      placeholder?.querySelector('.tabler-icon-home') !== null ||
      placeholder?.textContent?.includes('🏠');
    expect(hasBeachIcon).toBe(true);
    expect(hasHomeIcon).toBe(false);
    cleanUp();
  });

  it('renders the unified LocationPicker inside the location box', () => {
    const { container, cleanUp } = mountForm();
    const locationPicker = container.querySelector('.location-picker');
    expect(locationPicker).not.toBeNull();
    const input = locationPicker?.querySelector('input');
    expect(input?.getAttribute('placeholder')).toContain('Reiseziel');
    cleanUp();
  });

  it('initializes coordinates from initial prop and submits them', async () => {
    let submittedData: TripFormData | null = null;
    const initialWithCoords: TripFormData = {
      ...sampleInitial,
      lat: 43.7696,
      lng: 11.2558,
      destination: 'Florenz',
      maps_link: 'https://maps.google.com/?q=43.7696,11.2558',
    };

    const { container, cleanUp } = mountForm(
      { initial: initialWithCoords },
      {
        onSubmit: (data: TripFormData) => {
          submittedData = data;
        },
      }
    );

    const formEl = container.querySelector('form');
    formEl?.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();

    expect(submittedData).toBeDefined();
    const data1 = submittedData as unknown as TripFormData;
    expect(data1.destination).toBe('Florenz');
    expect(data1.lat).toBe(43.7696);
    expect(data1.lng).toBe(11.2558);
    cleanUp();
  });

  it('clears coordinates, destination, and maps_link when clear button is clicked', async () => {
    let submittedData: TripFormData | null = null;
    const initialWithCoords: TripFormData = {
      ...sampleInitial,
      lat: 43.7696,
      lng: 11.2558,
      destination: 'Florenz',
      maps_link: 'https://maps.google.com/?q=43.7696,11.2558',
    };

    const { container, cleanUp } = mountForm(
      { initial: initialWithCoords },
      {
        onSubmit: (data: TripFormData) => {
          submittedData = data;
        },
      }
    );

    await nextTick();

    const clearBtn = container.querySelector(
      '.location-picker .clear-btn'
    ) as HTMLButtonElement | null;
    expect(clearBtn).not.toBeNull();
    clearBtn?.click();
    await nextTick();

    const formEl = container.querySelector('form');
    formEl?.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();

    expect(submittedData).toBeDefined();
    const data2 = submittedData as unknown as TripFormData;
    expect(data2.destination).toBeUndefined();
    expect(data2.maps_link).toBeUndefined();
    expect(data2.lat).toBeUndefined();
    expect(data2.lng).toBeUndefined();
    cleanUp();
  });

  it('recognizes pasted Google Maps link in unified input and submits coordinates', async () => {
    let submittedData: TripFormData | null = null;
    const { container, cleanUp } = mountForm(
      { initial: sampleInitial },
      {
        onSubmit: (data: TripFormData) => {
          submittedData = data;
        },
      }
    );

    const input = container.querySelector('.location-picker input') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (input) {
      input.value = 'https://www.google.com/maps/place/48.2082,16.3738/@48.2082,16.3738,15z';
      input.dispatchEvent(new Event('input'));
    }
    await nextTick();

    const formEl = container.querySelector('form');
    formEl?.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();

    expect(submittedData).toBeDefined();
    const data3 = submittedData as unknown as TripFormData;
    expect(data3.lat).toBeCloseTo(48.2082);
    expect(data3.lng).toBeCloseTo(16.3738);
    cleanUp();
  });

  it('renders all four tabs (including Zugriffsberechtigungen) when editing an existing trip', () => {
    const { container, cleanUp } = mountForm({ initial: sampleInitial, tripId: 1 });
    const tabTexts = Array.from(container.querySelectorAll('.trip-tab-bar .tab')).map((el) =>
      el.textContent?.trim()
    );
    expect(tabTexts).toContain('Allgemein');
    expect(tabTexts).toContain('Einstellungen');
    expect(tabTexts).toContain('Kategorien');
    expect(tabTexts).toContain('Zugriffsberechtigungen');
    cleanUp();
  });

  it('hides the actions row (save and delete buttons) when initialTab is permissions', () => {
    const { container, cleanUp } = mountForm({
      initial: sampleInitial,
      initialTab: 'permissions',
      tripId: 1,
    });
    const actionsRow = container.querySelector('.actions-row');
    expect(actionsRow).toBeNull();
    cleanUp();
  });
});
