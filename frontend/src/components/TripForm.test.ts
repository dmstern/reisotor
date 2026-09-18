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
});
