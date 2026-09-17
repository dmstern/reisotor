// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ListSettingsMenu from './ListSettingsMenu.vue';

describe('ListSettingsMenu', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function mountMenu(props: Record<string, unknown> = {}, listeners: Record<string, unknown> = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(ListSettingsMenu, { ...props, ...listeners }),
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

  it('renders trigger button with icon and no badge when default', () => {
    const { container, cleanUp } = mountMenu({
      groupBy: 'assignee',
      defaultGroupBy: 'assignee',
      hideCompleted: false,
    });

    const trigger = container.querySelector('.list-settings-trigger');
    expect(trigger).toBeTruthy();
    expect(container.querySelector('.active-badge')).toBeNull();
    cleanUp();
  });

  it('shows badge and marks button active when settings are non-default', () => {
    const { container, cleanUp } = mountMenu({
      groupBy: 'period',
      defaultGroupBy: 'assignee',
      hideCompleted: true,
    });

    const trigger = container.querySelector('.list-settings-trigger');
    expect(trigger).toBeTruthy();
    const badge = container.querySelector('.active-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent?.trim()).toBe('2');
    cleanUp();
  });

  it('opens popover when trigger is clicked and displays sections', async () => {
    const { container, cleanUp } = mountMenu({
      groupBy: 'assignee',
      defaultGroupBy: 'assignee',
      groupByOptions: [
        { value: 'assignee', label: 'nach Bearbeiter:in' },
        { value: 'period', label: 'nach Zeitraum' },
      ],
      sortBy: 'priority',
      defaultSortBy: 'priority',
      sortByOptions: [
        { value: 'priority', label: 'nach Priorität' },
        { value: 'due_date', label: 'nach Datum' },
      ],
      hideCompleted: false,
      hideCompletedLabel: 'Erledigte ausblenden',
    });

    const trigger = container.querySelector('.list-settings-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const menu = document.body.querySelector('.list-settings-popover-menu');
    expect(menu).toBeTruthy();
    expect(menu?.textContent).toContain('Anzeige');
    expect(menu?.textContent).toContain('Erledigte ausblenden');
    expect(menu?.textContent).toContain('Gruppieren nach');
    expect(menu?.textContent).toContain('nach Bearbeiter:in');
    expect(menu?.textContent).toContain('nach Zeitraum');
    expect(menu?.textContent).toContain('Sortieren nach');
    expect(menu?.textContent).toContain('nach Priorität');
    expect(menu?.textContent).toContain('nach Datum');

    cleanUp();
  });

  it('emits update:groupBy when group option is clicked', async () => {
    const onUpdateGroupBy = vi.fn();
    const { container, cleanUp } = mountMenu(
      {
        groupBy: 'assignee',
        groupByOptions: [
          { value: 'assignee', label: 'nach Bearbeiter:in' },
          { value: 'period', label: 'nach Zeitraum' },
        ],
      },
      {
        'onUpdate:groupBy': onUpdateGroupBy,
      }
    );

    const trigger = container.querySelector('.list-settings-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const buttons = document.body.querySelectorAll(
      '.list-settings-popover-menu button.dropdown-item'
    );
    const periodBtn = Array.from(buttons).find((b) =>
      b.textContent?.includes('nach Zeitraum')
    ) as HTMLButtonElement;
    expect(periodBtn).toBeTruthy();
    periodBtn.click();

    expect(onUpdateGroupBy).toHaveBeenCalledWith('period');
    cleanUp();
  });

  it('emits update:hideCompleted when toggle checkbox is changed', async () => {
    const onUpdateHideCompleted = vi.fn();
    const { container, cleanUp } = mountMenu(
      {
        hideCompleted: false,
        hideCompletedLabel: 'Erledigte ausblenden',
      },
      {
        'onUpdate:hideCompleted': onUpdateHideCompleted,
      }
    );

    const trigger = container.querySelector('.list-settings-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const checkbox = document.body.querySelector(
      '.list-settings-popover-menu input[type="checkbox"]'
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.click();

    expect(onUpdateHideCompleted).toHaveBeenCalledWith(true);
    cleanUp();
  });

  it('resets to defaults when reset button is clicked', async () => {
    const onUpdateGroupBy = vi.fn();
    const onUpdateSortBy = vi.fn();
    const onUpdateHideCompleted = vi.fn();
    const onReset = vi.fn();

    const { container, cleanUp } = mountMenu(
      {
        groupBy: 'period',
        defaultGroupBy: 'assignee',
        groupByOptions: [
          { value: 'assignee', label: 'nach Bearbeiter:in' },
          { value: 'period', label: 'nach Zeitraum' },
        ],
        sortBy: 'due_date',
        defaultSortBy: 'priority',
        sortByOptions: [
          { value: 'priority', label: 'nach Priorität' },
          { value: 'due_date', label: 'nach Datum' },
        ],
        hideCompleted: true,
      },
      {
        'onUpdate:groupBy': onUpdateGroupBy,
        'onUpdate:sortBy': onUpdateSortBy,
        'onUpdate:hideCompleted': onUpdateHideCompleted,
        onReset: onReset,
      }
    );

    const trigger = container.querySelector('.list-settings-trigger') as HTMLButtonElement;
    trigger.click();
    await nextTick();

    const resetBtn = document.body.querySelector('.reset-settings-btn') as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    resetBtn.click();

    expect(onUpdateGroupBy).toHaveBeenCalledWith('assignee');
    expect(onUpdateSortBy).toHaveBeenCalledWith('priority');
    expect(onUpdateHideCompleted).toHaveBeenCalledWith(false);
    expect(onReset).toHaveBeenCalled();
    cleanUp();
  });
});
