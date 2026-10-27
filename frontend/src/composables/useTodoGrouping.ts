import { computed, watch, type Ref } from 'vue';
import type { TodoItem, TodoPriority, User, Trip } from '../api/types';
import { usePersistedRef } from './usePersistedRef';
import { useUiSettingsStore } from '../stores/uiSettings';
import { PERIOD_META, computePeriod } from '../utils/period';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import { sortWithDoneLast } from './useCheckedSort';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { IconDef } from '../utils/icon';

export type TodoGroupBy = 'assignee' | 'period';
export type TodoSortBy = 'due_date' | 'priority' | 'assignee';

export interface TodoGroup {
  key: string;
  label: string;
  items: TodoItem[];
}

export const TODO_PRIORITY_META: Record<
  TodoPriority,
  { label: string; icon: string; color: string }
> = {
  low: { label: 'Niedrig', icon: '🟢', color: 'var(--color-success)' },
  medium: { label: 'Mittel', icon: '🟡', color: 'var(--color-accent)' },
  high: { label: 'Hoch', icon: '🔴', color: 'var(--color-danger)' },
};

export const TODO_PRIORITY_ORDER: Record<TodoPriority, number> = { high: 0, medium: 1, low: 2 };

export function useTodoGrouping(
  items: Ref<TodoItem[]>,
  users: Ref<User[]>,
  currentTrip: Ref<Trip | null | undefined>
) {
  const uiSettings = useUiSettingsStore();

  const groupBy = usePersistedRef<TodoGroupBy>('reisotor-todo-group-by', 'assignee');
  const sortBy = usePersistedRef<TodoSortBy>('reisotor-todo-sort-by', 'priority');

  const defaultGroupBy = computed<TodoGroupBy>(() =>
    users.value.length > 1 ? 'assignee' : 'period'
  );
  const defaultSortBy: TodoSortBy = 'priority';

  const groupByOptions = computed<Array<{ value: TodoGroupBy; label: string; icon: IconDef }>>(
    () => {
      const opts = [];
      if (users.value.length > 1) {
        opts.push({
          value: 'assignee' as const,
          label: 'nach Bearbeiter:in',
          icon: FORM_FIELD_ICONS.person,
        });
      }
      opts.push({
        value: 'period' as const,
        label: 'nach Zeitraum',
        icon: FORM_FIELD_ICONS.period,
      });
      return opts;
    }
  );

  const sortByOptions = computed<Array<{ value: TodoSortBy; label: string; icon: IconDef }>>(() => {
    const opts: Array<{ value: TodoSortBy; label: string; icon: IconDef }> = [
      { value: 'priority', label: 'nach Priorität', icon: FORM_FIELD_ICONS.priority },
      { value: 'due_date', label: 'nach Datum', icon: FORM_FIELD_ICONS.date },
    ];
    if (users.value.length > 1) {
      opts.push({ value: 'assignee', label: 'nach Bearbeiter:in', icon: FORM_FIELD_ICONS.person });
    }
    return opts;
  });

  watch(
    () => users.value.length,
    (len) => {
      if (len <= 1) {
        if (groupBy.value === 'assignee') groupBy.value = 'period';
        if (sortBy.value === 'assignee') sortBy.value = 'priority';
      }
    },
    { immediate: true }
  );

  function periodFor(item: TodoItem) {
    if (item.due_date) {
      return computePeriod(item.due_date, currentTrip.value ?? null);
    }
    return item.period || null;
  }

  function userLabel(id: number | null) {
    if (id == null) return null;
    const u = users.value.find((u) => u.id === id);
    return u ? `${u.avatar} ${u.username}` : '👤 Ehemaliges Mitglied';
  }

  function userAvatar(id: number | null | undefined) {
    if (id == null) return null;
    const u = users.value.find((u) => u.id === id);
    return u ? u.avatar : '👤';
  }

  function userName(id: number | null | undefined) {
    if (id == null) return null;
    const u = users.value.find((u) => u.id === id);
    return u ? u.username : 'Ehemaliges Mitglied';
  }

  function sortItems(list: TodoItem[]) {
    const visible = uiSettings.hideCompletedTodos ? list.filter((i) => !i.done) : list;
    return sortWithDoneLast(
      visible,
      (i) => !!i.done,
      (a, b) => {
        if (sortBy.value === 'due_date') {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        if (sortBy.value === 'assignee') {
          return (userLabel(a.assigned_to_user_id) ?? '').localeCompare(
            userLabel(b.assigned_to_user_id) ?? '',
            'de'
          );
        }
        return TODO_PRIORITY_ORDER[a.priority] - TODO_PRIORITY_ORDER[b.priority];
      }
    );
  }

  const groupedItems = computed<TodoGroup[]>(() => {
    if (groupBy.value === 'period') {
      return [
        {
          key: 'before',
          label: `⏳ ${PERIOD_META.before}`,
          items: sortItems(items.value.filter((i) => periodFor(i) === 'before')),
        },
        {
          key: 'during',
          label: `🌴 ${PERIOD_META.during}`,
          items: sortItems(items.value.filter((i) => periodFor(i) === 'during')),
        },
        {
          key: 'none',
          label: '📋 Ohne Zeitraum',
          items: sortItems(items.value.filter((i) => !periodFor(i))),
        },
      ];
    }
    const memberIds = new Set(users.value.map((u) => u.id));
    const perUser: TodoGroup[] = users.value.map((u) => ({
      key: `user-${u.id}`,
      label: `${u.avatar} ${u.username}`,
      items: sortItems(items.value.filter((i) => i.assigned_to_user_id === u.id)),
    }));
    const unassigned: TodoGroup = {
      key: 'unassigned',
      label: 'Nicht zugewiesen',
      items: sortItems(
        items.value.filter(
          (i) => i.assigned_to_user_id == null || !memberIds.has(i.assigned_to_user_id)
        )
      ),
    };
    return [...perUser, unassigned];
  });

  function formatDate(d: string | null) {
    if (!d) return null;
    return formatDateShared(d);
  }

  function isOverdue(item: TodoItem) {
    if (!item.due_date || item.done) return false;
    return item.due_date < toLocalDateString(new Date());
  }

  function hasTodoMeta(item: TodoItem): boolean {
    return Boolean(
      item._pending || item.due_date || (groupBy.value !== 'period' && periodFor(item)) || item.note
    );
  }

  return {
    groupBy,
    sortBy,
    defaultGroupBy,
    defaultSortBy,
    groupByOptions,
    sortByOptions,
    groupedItems,
    sortItems,
    periodFor,
    userLabel,
    userAvatar,
    userName,
    formatDate,
    isOverdue,
    hasTodoMeta,
  };
}
