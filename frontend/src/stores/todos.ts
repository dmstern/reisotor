import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { api } from '../api/client';
import type { TodoItem } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';

export const useTodosStore = defineStore('todos', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const items = shallowRef<TodoItem[]>([]);
  const loaded = ref(false);

  async function load(tripIdOverride?: number) {
    const tripId = tripIdOverride ?? tripStore.currentTripId;

    if (tripId == null) {
      items.value = [];
      loaded.value = false;
      return;
    }

    items.value = await api.get<TodoItem[]>(`/todos?trip_id=${tripId}`);
    loaded.value = true;
  }

  watch(
    () => tripStore.currentTripId,
    () => {
      void load();
    },
    { immediate: true }
  );

  watch(
    () => liveSync.domainVersion.todos,
    () => {
      void load();
    }
  );

  async function create(body: Record<string, unknown>) {
    const created = await api.post<TodoItem>('/todos', body);
    items.value = [...items.value, created];
    return created;
  }

  async function update(id: number, body: Record<string, unknown>) {
    const updated = await api.put<TodoItem>(`/todos/${id}`, body);
    const idx = items.value.findIndex((item) => item.id === id);

    if (idx !== -1) {
      const next = [...items.value];
      next[idx] = updated;
      items.value = next;
    }

    return updated;
  }

  async function toggleDone(item: TodoItem, tripIdOverride?: number) {
    const tripId = tripIdOverride ?? tripStore.currentTripId ?? item.trip_id;
    return update(item.id, {
      trip_id: tripId,
      title: item.title,
      assigned_to_user_id: item.assigned_to_user_id,
      due_date: item.due_date ?? undefined,
      period: item.period ?? undefined,
      priority: item.priority,
      note: item.note ?? undefined,
      done: !item.done,
    });
  }

  async function remove(id: number) {
    await api.delete(`/todos/${id}`);
    items.value = items.value.filter((item) => item.id !== id);
  }

  return {
    items,
    loaded,
    load,
    create,
    update,
    toggleDone,
    remove,
  };
});
