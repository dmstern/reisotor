// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('TripForm Adversarial & Stress Testing', () => {
  let pinia: ReturnType<typeof createPinia>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
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

  const baseTrip: TripFormData = {
    name: 'Sommerurlaub Italien',
    destination: 'Toskana',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    maps_link: '',
    image_url: '',
    packing_category_required: true,
    weather_model: 'ecmwf_ifs025',
  };

  describe('1. Link Pasting Scenarios', () => {
    it('pasting Google Maps @lat,lng link populates coords and maps_link on submit', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      expect(input).not.toBeNull();
      input.value = 'https://www.google.com/maps/@41.9028,12.4964,14z';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.lat).toBeCloseTo(41.9028);
      expect(data.lng).toBeCloseTo(12.4964);
      expect(data.maps_link).toBe('https://www.google.com/maps/@41.9028,12.4964,14z');
      cleanUp();
    });

    it('pasting OpenStreetMap link populates coords and maps_link on submit', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      input.value = 'https://www.openstreetmap.org/#map=16/48.2082/16.3738';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.lat).toBeCloseTo(48.2082);
      expect(data.lng).toBeCloseTo(16.3738);
      expect(data.maps_link).toBe('https://www.openstreetmap.org/#map=16/48.2082/16.3738');
      cleanUp();
    });

    it('pasting Apple Maps link populates coords and maps_link on submit', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      input.value = 'https://maps.apple.com/?ll=48.2082,16.3738&q=Vienna';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.lat).toBeCloseTo(48.2082);
      expect(data.lng).toBeCloseTo(16.3738);
      cleanUp();
    });

    it('pasting shortlink (maps.app.goo.gl) submits maps_link for server resolution', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      input.value = 'https://maps.app.goo.gl/wXYZ12345';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.maps_link).toBe('https://maps.app.goo.gl/wXYZ12345');
      // Coords are undefined client-side for shortlinks before server resolution
      expect(data.lat).toBeUndefined();
      expect(data.lng).toBeUndefined();
      cleanUp();
    });
  });

  describe('2. Text Input & Autocomplete Scenarios', () => {
    it('typing text and selecting autocomplete item updates destination, coords, and maps_link', async () => {
      const mockResult = [
        {
          name: 'Florenz',
          formatted_address: 'Florenz, Toskana, Italien',
          lat: 43.7696,
          lng: 11.2558,
        },
      ];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      input.value = 'Florenz';
      input.dispatchEvent(new Event('input'));

      // Advance debounce
      vi.advanceTimersByTime(350);
      await vi.runAllTimersAsync();
      await nextTick();

      const option = container.querySelector('.location-result-item') as HTMLElement;
      expect(option).not.toBeNull();
      option.click();
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.destination).toBe('Florenz, Toskana, Italien');
      expect(data.lat).toBeCloseTo(43.7696);
      expect(data.lng).toBeCloseTo(11.2558);
      expect(data.maps_link).toContain('43.7696,11.2558');
      cleanUp();
    });

    it('adversarial check: typing free text WITHOUT clicking autocomplete suggestion', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      input.value = 'Sylt, Nordsee';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      // Check what TripForm submits when a user simply types a destination name
      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      // Notice: destination is undefined because LocationPicker never emitted update:address!
      expect(data.destination).toBeUndefined();
      cleanUp();
    });

    it('adversarial check: editing existing trip destination by typing retains OLD destination unless suggestion clicked', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'Test Trip', destination: 'Rom' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      expect(input.value).toBe('Rom');
      input.value = 'Venedig';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      // Because LocationPicker only updates address on selectPlace or clear,
      // form.destination is STILL 'Rom'!
      expect(data.destination).toBe('Rom');
      cleanUp();
    });
  });

  describe('3. Location Resetting & Clearing Scenarios', () => {
    it('clearing location properly resets coordinates, address, and maps link so entity is saved without coordinates', async () => {
      let submitted: TripFormData | null = null;
      const initialWithCoords: TripFormData = {
        ...baseTrip,
        destination: 'Rom, Italien',
        lat: 41.9028,
        lng: 12.4964,
        maps_link: 'https://maps.google.com/?q=41.9028,12.4964',
      };

      const { container, cleanUp } = mountForm(
        { initial: initialWithCoords },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      // 1. Verify status card is initially shown
      const statusCard = container.querySelector('[data-testid="location-status"]');
      expect(statusCard).not.toBeNull();

      // 2. Click "Entfernen"
      const clearBtn = container.querySelector('.location-picker .clear-btn') as HTMLButtonElement;
      expect(clearBtn).not.toBeNull();
      clearBtn.click();
      await nextTick();

      // 3. Status card must be gone
      expect(container.querySelector('[data-testid="location-status"]')).toBeNull();

      // 4. Input should be cleared
      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      expect(input.value).toBe('');

      // 5. Submit form
      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      // 6. Verify entity is saved without coordinates, destination or maps link
      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.lat).toBeUndefined();
      expect(data.lng).toBeUndefined();
      expect(data.destination).toBeUndefined();
      expect(data.maps_link).toBeUndefined();
      cleanUp();
    });

    it('after setting coordinates via link, clearing location resets all fields', async () => {
      let submitted: TripFormData | null = null;
      const { container, cleanUp } = mountForm(
        { initial: { name: 'New Trip' } },
        {
          onSubmit: (d: TripFormData) => {
            submitted = d;
          },
        }
      );
      await nextTick();

      // Paste link
      const input = container.querySelector('.location-picker input') as HTMLInputElement;
      input.value = 'https://www.google.com/maps/@48.2082,16.3738,15z';
      input.dispatchEvent(new Event('input'));
      await nextTick();

      // Status card should appear
      expect(container.querySelector('[data-testid="location-status"]')).not.toBeNull();

      // Click clear
      const clearBtn = container.querySelector('.location-picker .clear-btn') as HTMLButtonElement;
      expect(clearBtn).not.toBeNull();
      clearBtn.click();
      await nextTick();

      // Submit
      const form = container.querySelector('form');
      form?.dispatchEvent(new Event('submit', { cancelable: true }));
      await nextTick();

      const data = submitted as unknown as TripFormData;
      expect(data).not.toBeNull();
      expect(data.lat).toBeUndefined();
      expect(data.lng).toBeUndefined();
      expect(data.maps_link).toBeUndefined();
      cleanUp();
    });
  });
});
