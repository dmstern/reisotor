// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegTransportModeSelector from './LegTransportModeSelector.vue';
import { DEFAULT_TRANSIT_OPTIONS } from '../utils/legTransportConfig';

function mountTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
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

describe('LegTransportModeSelector', () => {
  it('renders 4 toggle options for transport categories', async () => {
    const { cleanUp } = mountTestApp(LegTransportModeSelector, {
      category: 'Auto',
      transitType: 'Zug',
      transitOptions: DEFAULT_TRANSIT_OPTIONS,
    });
    await nextTick();

    const toggleButtons = document.querySelectorAll('.segmented-option');
    expect(toggleButtons.length).toBe(4);

    const labels = Array.from(toggleButtons).map((btn) => btn.textContent?.trim());
    expect(labels).toContain('Auto');
    expect(labels).toContain('Fahrrad');
    expect(labels).toContain('Zu Fuß');
    expect(labels).toContain('ÖPNV');

    cleanUp();
  });

  it('emits selectCategory when a transport category is clicked', async () => {
    let selectedCat = '';
    const { cleanUp } = mountTestApp(LegTransportModeSelector, {
      category: 'Auto',
      transitType: 'Zug',
      transitOptions: DEFAULT_TRANSIT_OPTIONS,
      onSelectCategory: (cat: string) => {
        selectedCat = cat;
      },
    });
    await nextTick();

    const toggleButtons = Array.from(document.querySelectorAll('.segmented-option'));
    const opnvBtn = toggleButtons.find((btn) => btn.textContent?.includes('ÖPNV'));
    (opnvBtn as HTMLButtonElement)?.click();
    await nextTick();

    expect(selectedCat).toBe('ÖPNV');

    cleanUp();
  });

  it('expands transit dropdown and emits selectTransit when ÖPNV category is active', async () => {
    let selectedTransit = '';
    const { cleanUp } = mountTestApp(LegTransportModeSelector, {
      category: 'ÖPNV',
      transitType: 'Zug',
      transitOptions: DEFAULT_TRANSIT_OPTIONS,
      onSelectTransit: (type: string) => {
        selectedTransit = type;
      },
    });
    await nextTick();

    const transitDropdown = document.querySelector('.transit-dropdown-wrapper');
    expect(transitDropdown?.classList.contains('is-expanded')).toBe(true);

    const select = document.querySelector('.transit-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('Zug');

    select.value = 'Bus';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    expect(selectedTransit).toBe('Bus');

    cleanUp();
  });

  it('keeps transit dropdown collapsed when category is not ÖPNV', async () => {
    const { cleanUp } = mountTestApp(LegTransportModeSelector, {
      category: 'Auto',
      transitType: 'Zug',
      transitOptions: DEFAULT_TRANSIT_OPTIONS,
    });
    await nextTick();

    const transitDropdown = document.querySelector('.transit-dropdown-wrapper');
    expect(transitDropdown?.classList.contains('is-expanded')).toBe(false);

    cleanUp();
  });
});
