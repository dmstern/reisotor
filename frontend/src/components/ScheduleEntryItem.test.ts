// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ScheduleEntryItem from './ScheduleEntryItem.vue';
import type { CalendarEntry } from '../api/types';

describe('ScheduleEntryItem', () => {
  const dummyScheduleEntry: CalendarEntry = {
    key: 'schedule:1',
    date: '2026-10-15',
    title: 'Museumsinsel Besuch',
    category: 'excursion',
    kind: 'schedule',
    time: '14:00',
    location: 'Berlin Mitte',
  } as CalendarEntry;

  const dummyTodoEntry: CalendarEntry = {
    key: 'todo:42',
    date: '2026-10-15',
    title: 'Kamera-Akkus laden',
    category: 'todo',
    kind: 'todo',
    todoId: 42,
  } as CalendarEntry;

  function mountItem(props: {
    entry: CalendarEntry;
    index?: number;
    isDone?: boolean;
    onClick?: () => void;
    onToggleTodo?: () => void;
  }) {
    const pinia = createPinia();
    setActivePinia(pinia);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render: () =>
        h(ScheduleEntryItem, {
          entry: props.entry,
          index: props.index,
          isDone: props.isDone,
          onClick: props.onClick,
          onToggleTodo: props.onToggleTodo,
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

  it('rendert normalen Termineintrag ohne Navigations-Pfeil', async () => {
    const { container, cleanUp } = mountItem({ entry: dummyScheduleEntry });
    await nextTick();

    expect(container.textContent).toContain('Museumsinsel Besuch');
    expect(container.textContent).toContain('Berlin Mitte');
    expect(container.textContent).toContain('14:00');
    expect(container.querySelector('.todo-nav-indicator')).toBeNull();
    expect(container.querySelector('.todo-checkbox')).toBeNull();

    cleanUp();
  });

  it('rendert To-do-Eintrag mit Checkbox und Navigations-Pfeil zur Liste (#761)', async () => {
    const { container, cleanUp } = mountItem({ entry: dummyTodoEntry, isDone: false });
    await nextTick();

    expect(container.textContent).toContain('Kamera-Akkus laden');
    expect(container.querySelector('.todo-checkbox')).not.toBeNull();

    const navIndicator = container.querySelector('.todo-nav-indicator');
    expect(navIndicator).not.toBeNull();
    expect(navIndicator?.getAttribute('title')).toBe('Zur To-do-Liste springen');

    const item = container.querySelector('.item');
    expect(item?.getAttribute('title')).toBe('Zur To-do-Liste springen');

    cleanUp();
  });

  it('durchstreicht den Titel bei erledigtem To-do', async () => {
    const { container, cleanUp } = mountItem({ entry: dummyTodoEntry, isDone: true });
    await nextTick();

    const titleEl = container.querySelector('.title');
    expect(titleEl?.classList.contains('todo-done')).toBe(true);

    cleanUp();
  });

  it('emittiert click beim Klick auf den To-do-Eintrag', async () => {
    const clickSpy = vi.fn();
    const { container, cleanUp } = mountItem({
      entry: dummyTodoEntry,
      onClick: clickSpy,
    });
    await nextTick();

    const item = container.querySelector('.item') as HTMLElement | null;
    item?.click();

    expect(clickSpy).toHaveBeenCalledTimes(1);

    cleanUp();
  });

  it('emittiert toggleTodo und stoppt Propagation beim Klick auf die Checkbox', async () => {
    const clickSpy = vi.fn();
    const toggleSpy = vi.fn();
    const { container, cleanUp } = mountItem({
      entry: dummyTodoEntry,
      onClick: clickSpy,
      onToggleTodo: toggleSpy,
    });
    await nextTick();

    const checkbox = container.querySelector('.todo-checkbox') as HTMLElement | null;
    expect(checkbox).not.toBeNull();
    checkbox?.click();

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).not.toHaveBeenCalled();

    cleanUp();
  });
});
