// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, type Component, nextTick, ref } from 'vue';
import { createPinia } from 'pinia';
import SearchFilterBar from './SearchFilterBar.vue';

function mountBar(
  props: Record<string, unknown> = {},
  emitListeners: Record<string, unknown> = {}
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const pinia = createPinia();
  const compRef = ref<InstanceType<typeof SearchFilterBar> | null>(null);

  const app = createApp({
    render: () =>
      h(SearchFilterBar as unknown as Component, {
        ref: compRef,
        ...props,
        ...emitListeners,
      }),
  });
  app.use(pinia);
  app.mount(container);
  return {
    container,
    compRef,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('SearchFilterBar', () => {
  it('renders search input with placeholder and single combined filter button', () => {
    const { container, cleanUp } = mountBar({
      searchPlaceholder: 'Suche nach Test...',
    });
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.placeholder).toBe('Suche nach Test...');

    const buttons = container.querySelectorAll('.search-filter-bar button.bar-icon-btn');
    expect(buttons.length).toBe(1);
    expect(buttons[0].querySelector('.tabler-icon-adjustments')).not.toBeNull();
    cleanUp();
  });

  it('opens combined popover with collapsible sorting and filter sections', async () => {
    const { container, cleanUp } = mountBar({
      categoryOptions: ['Kultur', 'Natur'],
    });

    const filterBtn = container.querySelector<HTMLButtonElement>('.bar-icon-btn');
    expect(filterBtn).not.toBeNull();
    filterBtn?.click();
    await nextTick();

    const picker = document.querySelector('.filter-popover-menu');
    expect(picker).not.toBeNull();

    const headers = document.querySelectorAll<HTMLButtonElement>('.popover-section-toggle');
    const headerTitles = Array.from(headers).map(
      (header) => header.querySelector('.popover-section-title')?.textContent
    );
    expect(headerTitles).toEqual(['Sortieren nach', 'Spots', 'Status', 'Touren']);

    // Smart-Default: "Sortieren nach" startet offen, Filter-Sektionen ohne aktive Filter starten eingeklappt
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(headers[1].getAttribute('aria-expanded')).toBe('false');
    expect(headers[2].getAttribute('aria-expanded')).toBe('false');
    expect(headers[3].getAttribute('aria-expanded')).toBe('false');

    // Klick auf "Spots"-Header klappt die Sektion auf
    headers[1].click();
    await nextTick();
    expect(headers[1].getAttribute('aria-expanded')).toBe('true');

    // Sortier- und Kategorieoptionen im DOM vorhanden
    const items = Array.from(document.querySelectorAll('.dropdown-item')).map(
      (item) => item.textContent
    );
    expect(items.some((text) => text?.includes('Nach Datum'))).toBe(true);
    expect(items.some((text) => text?.includes('Alphabetisch'))).toBe(true);
    expect(items.some((text) => text?.includes('Kultur'))).toBe(true);
    cleanUp();
  });

  it('auto-expands filter sections that have active filters on open', async () => {
    const { container, cleanUp } = mountBar({
      categoryOptions: ['Kultur', 'Natur'],
      categoryFilter: ['Kultur'],
      statusFilter: ['done'],
    });

    const filterBtn = container.querySelector<HTMLButtonElement>('.bar-icon-btn');
    filterBtn?.click();
    await nextTick();

    const headers = document.querySelectorAll<HTMLButtonElement>('.popover-section-toggle');
    expect(headers[0].getAttribute('aria-expanded')).toBe('true'); // Sortieren nach
    expect(headers[1].getAttribute('aria-expanded')).toBe('true'); // Spots (1 aktiv)
    expect(headers[2].getAttribute('aria-expanded')).toBe('true'); // Status (1 aktiv)
    expect(headers[3].getAttribute('aria-expanded')).toBe('false'); // Touren (0 aktiv)
    cleanUp();
  });

  it('calculates totalActiveCount correctly including non-default sorting', async () => {
    const { container, cleanUp } = mountBar({
      categoryFilter: ['Kultur'],
      sortMode: 'alpha',
    });

    const badge = container.querySelector('.active-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('2'); // 1 Filter + 1 Sortierung

    const filterBtn = container.querySelector('.bar-icon-btn');
    expect(filterBtn?.getAttribute('aria-label')).toBe('Filtern & Sortieren (2 aktiv)');
    cleanUp();
  });

  it('exposes focusInput method to focus the search input', () => {
    const { compRef, container, cleanUp } = mountBar();
    const input = container.querySelector('input');
    const focusSpy = vi.spyOn(input!, 'focus');

    compRef.value?.focusInput();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    cleanUp();
  });
});
