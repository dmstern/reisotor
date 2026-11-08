import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import type { TodoItem, TodoPriority, User, Period } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { hashHighlightId } from '../utils/hashHighlight';
import { useToast } from './useToast';
import { restoreTrashItem } from '../api/trash';

export interface TodoFormInput {
  title: string;
  assigned_to_user_id?: string | number | null;
  due_date?: string | null;
  period?: Period | '' | null;
  priority: TodoPriority;
  note?: string | null;
}

export function useTodoList(tripIdOverride?: number) {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const { showToast } = useToast();

  const tripId = tripIdOverride ?? (tripStore.currentTripId as number);
  const items = ref<TodoItem[]>([]);
  const users = ref<User[]>([]);
  const loading = ref(true);
  const highlightedIds = ref<Set<number>>(new Set());
  const focusedTodoId = ref<number | null>(null);

  let route: ReturnType<typeof useRoute> | null = null;
  let router: ReturnType<typeof useRouter> | null = null;

  if (getCurrentInstance()) {
    try {
      route = useRoute();
      router = useRouter();
    } catch {
      // Falls außerhalb des Vue Router-Kontexts (z.B. in Tests) aufgerufen
    }
  }

  function clearFocusedTodo() {
    if (focusedTodoId.value != null) {
      focusedTodoId.value = null;

      if (route && router && route.hash.startsWith('#todo-')) {
        router.replace({ path: route.path, query: route.query, hash: '' });
      }
    }
  }

  async function load() {
    try {
      const [itemsRes, usersRes] = await Promise.all([
        api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
        api.get<User[]>(`/trips/${tripId}/members`),
      ]);
      items.value = itemsRes;
      users.value = usersRes;
    } catch {
      // Offline-Fallback: Seite rendert mit gecachten/vorherigen Daten
    } finally {
      loading.value = false;
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      highlightedIds.value = liveSync.markSeen('todos');

      if (route?.hash) {
        const hashId = hashHighlightId(route.hash, 'todo');

        if (hashId != null) {
          focusedTodoId.value = hashId;
        }
      }

      load();
    });
  }

  if (route) {
    watch(
      () => route.hash,
      (newHash) => {
        if (!newHash) {
          focusedTodoId.value = null;
          return;
        }

        const hashId = hashHighlightId(newHash, 'todo');

        if (hashId != null) {
          focusedTodoId.value = hashId;
        }
      }
    );
  }

  watch(() => liveSync.domainVersion.todos, load);

  const progress = computed(() => {
    const total = items.value.length;
    const done = items.value.filter((i) => i.done).length;
    return { total, done };
  });

  function toBody(form: TodoFormInput) {
    const isPeriodValid = !form.due_date;
    return {
      trip_id: tripId,
      title: form.title.trim(),
      assigned_to_user_id: form.assigned_to_user_id ? Number(form.assigned_to_user_id) : undefined,
      due_date: form.due_date || undefined,
      period: isPeriodValid && form.period ? form.period : undefined,
      priority: form.priority,
      note: form.note || undefined,
    };
  }

  async function addItem(input: TodoFormInput): Promise<TodoItem | null> {
    if (!input.title.trim()) {
      return null;
    }

    const created = await api.post<TodoItem>('/todos', toBody(input));
    items.value.push(created);
    return created;
  }

  async function quickAddToGroup(params: {
    groupKey: string;
    groupBy: 'assignee' | 'period';
    label: string;
    priority: TodoPriority;
    period?: Period | '';
    fallbackAssignee?: string;
  }): Promise<TodoItem | null> {
    if (!params.label.trim()) {
      return null;
    }

    const USER_PREFIX = 'user-';
    let assigned_to_user_id: number | undefined;

    if (params.groupBy === 'assignee') {
      if (params.groupKey.startsWith(USER_PREFIX)) {
        assigned_to_user_id = Number(params.groupKey.slice(USER_PREFIX.length));
      }
    } else if (params.fallbackAssignee) {
      assigned_to_user_id = Number(params.fallbackAssignee);
    }

    let period: Period | undefined = params.period || undefined;

    if (params.groupBy === 'period') {
      period =
        params.groupKey === 'before' || params.groupKey === 'during'
          ? (params.groupKey as Period)
          : undefined;
    }

    const created = await api.post<TodoItem>('/todos', {
      trip_id: tripId,
      title: params.label.trim(),
      assigned_to_user_id,
      period,
      priority: params.priority,
    });
    items.value.push(created);
    return created;
  }

  async function toggleDone(item: TodoItem) {
    clearFocusedTodo();
    const updated = await api.put<TodoItem>(`/todos/${item.id}`, {
      trip_id: tripId,
      title: item.title,
      assigned_to_user_id: item.assigned_to_user_id,
      due_date: item.due_date ?? undefined,
      period: item.period ?? undefined,
      priority: item.priority,
      note: item.note ?? undefined,
      done: !item.done,
    });
    const idx = items.value.findIndex((i) => i.id === item.id);

    if (idx !== -1) {
      items.value[idx] = updated;
    }

    return updated;
  }

  async function submitEdit(id: number, input: TodoFormInput, done: boolean): Promise<TodoItem> {
    const updated = await api.put<TodoItem>(`/todos/${id}`, {
      ...toBody(input),
      done,
    });
    const idx = items.value.findIndex((i) => i.id === updated.id);

    if (idx !== -1) {
      items.value[idx] = updated;
    }

    return updated;
  }

  async function remove(id: number) {
    await api.delete(`/todos/${id}`);
    items.value = items.value.filter((i) => i.id !== id);
    showToast({
      message: 'Aufgabe gelöscht. Sie befindet sich nun im Papierkorb.',
      type: 'info',
      onRestore: async () => {
        await restoreTrashItem('todo', id);
        await load();
      },
    });
  }

  return {
    tripId,
    items,
    users,
    loading,
    highlightedIds,
    focusedTodoId,
    progress,
    clearFocusedTodo,
    load,
    addItem,
    quickAddToGroup,
    toggleDone,
    submitEdit,
    remove,
    toBody,
  };
}
