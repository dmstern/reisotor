// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, type Component, nextTick } from 'vue';
import { createPinia } from 'pinia';
import LocationSearchBar from './LocationSearchBar.vue';
import type { PlaceSearchResult } from '../composables/usePlaceSearch';

function mountLocationSearchBar(
  props: Record<string, unknown> = {},
  emitListeners: Record<string, unknown> = {}
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const pinia = createPinia();

  const app = createApp({
    render: () =>
      h(LocationSearchBar as unknown as Component, {
        ...props,
        ...emitListeners,
      }),
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

describe('LocationSearchBar - solid glass feeling (#759)', () => {
  const defaultProps = {
    modelValue: '',
    isSearching: false,
    isOpen: false,
    results: [],
    activeIndex: -1,
    placeholder: 'Reiseziel, Stadt oder Maps-Link eingeben...',
    isDetailsVisible: false,
  };

  it('renders floating search wrap with glass bezel and flush inner input container', () => {
    const { container, cleanUp } = mountLocationSearchBar(defaultProps);

    const wrap = container.querySelector('.location-search-wrap');
    expect(wrap).not.toBeNull();

    const inner = wrap?.querySelector('.location-search-inner');
    expect(inner).not.toBeNull();

    const input = inner?.querySelector('[data-testid="location-search-input"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.placeholder).toBe('Reiseziel, Stadt oder Maps-Link eingeben...');

    const searchIcon = inner?.querySelector('.location-search-icon');
    expect(searchIcon).not.toBeNull();

    const infoPopover = inner?.querySelector('.search-info-popover');
    expect(infoPopover).not.toBeNull();

    cleanUp();
  });

  it('toggles is-focused only on search input focus and not when focusing the info popover button', async () => {
    const { container, cleanUp } = mountLocationSearchBar(defaultProps);

    const wrap = container.querySelector('.location-search-wrap');
    const input = container.querySelector(
      '[data-testid="location-search-input"]'
    ) as HTMLInputElement;
    const infoBtn = container.querySelector('.info-popover-btn') as HTMLButtonElement;

    expect(wrap?.classList.contains('is-focused')).toBe(false);

    infoBtn.dispatchEvent(new FocusEvent('focus'));
    await nextTick();
    expect(wrap?.classList.contains('is-focused')).toBe(false);

    input.dispatchEvent(new FocusEvent('focus'));
    await nextTick();
    expect(wrap?.classList.contains('is-focused')).toBe(true);

    input.dispatchEvent(new FocusEvent('blur'));
    await nextTick();
    expect(wrap?.classList.contains('is-focused')).toBe(false);

    cleanUp();
  });

  it('emits update:modelValue on text entry and updates input', async () => {
    let emittedValue = '';
    const { container, cleanUp } = mountLocationSearchBar(defaultProps, {
      'onUpdate:modelValue': (value: string) => {
        emittedValue = value;
      },
    });

    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'Lissabon';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();

    expect(emittedValue).toBe('Lissabon');
    cleanUp();
  });

  it('renders autocomplete results with glass dropdown when open', () => {
    const place: PlaceSearchResult = {
      id: '1',
      name: 'Lissabon',
      formatted_address: 'Lissabon, Portugal',
      address: 'Portugal',
      lat: 38.72,
      lng: -9.14,
    };

    const { container, cleanUp } = mountLocationSearchBar({
      ...defaultProps,
      isOpen: true,
      results: [place],
    });

    const dropdown = container.querySelector('.location-dropdown');
    expect(dropdown).not.toBeNull();

    const wrap = container.querySelector('.location-search-wrap');
    expect(wrap?.contains(dropdown)).toBe(false);

    const item = container.querySelector('.location-result-item');
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain('Lissabon');

    cleanUp();
  });

  it('emits select when clicking an autocomplete item', async () => {
    const place: PlaceSearchResult = {
      id: '1',
      name: 'Lissabon',
      formatted_address: 'Lissabon, Portugal',
      address: 'Portugal',
      lat: 38.72,
      lng: -9.14,
    };

    let selectedPlace: PlaceSearchResult | null = null;
    const { container, cleanUp } = mountLocationSearchBar(
      {
        ...defaultProps,
        isOpen: true,
        results: [place],
      },
      {
        onSelect: (selected: PlaceSearchResult) => {
          selectedPlace = selected;
        },
      }
    );

    const item = container.querySelector('.location-result-item') as HTMLElement;
    item.click();
    await nextTick();

    expect(selectedPlace).toEqual(place);
    cleanUp();
  });
});
