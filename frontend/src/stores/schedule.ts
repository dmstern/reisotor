import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { api } from '../api/client';
import type { ScheduleItem } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';
import { useToast } from '../composables/useToast';
export interface ScheduleFormData {
  trip_id: number;
  date: string;
  end_date?: string | null;
  time?: string;
  end_time?: string;
  title: string;
  note?: string;
  location?: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
  spot_id?: number | null;
  idea_id?: number | null;
  auto_created?: number | boolean | null;
  user_modified?: number | boolean | null;
  done?: number | boolean | null;
}

// Store für manuell im Kalender (+ Termin) angelegte Termine. Spots, Touren, Tagebucheinträge
// und ToDos erscheinen per direkter Kalender-Projektion (calendarEntries.ts) ohne Schatten-Termine.
export const useScheduleStore = defineStore('schedule', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const items = shallowRef<ScheduleItem[]>([]);
  const loaded = ref(false);

  async function load() {
    const tripId = tripStore.currentTripId;

    if (tripId == null) {
      items.value = [];
      loaded.value = false;
      return;
    }

    items.value = await api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`);
    loaded.value = true;
  }

  watch(() => tripStore.currentTripId, load, { immediate: true });
  watch(() => liveSync.domainVersion.schedule, load);

  async function create(body: ScheduleFormData) {
    const created = await api.post<ScheduleItem>('/schedule', body);
    items.value = [...items.value, created];
    return created;
  }

  async function update(id: number, body: ScheduleFormData) {
    const updated = await api.put<ScheduleItem>(`/schedule/${id}`, body);
    const idx = items.value.findIndex((i) => i.id === id);

    if (idx !== -1) {
      const next = [...items.value];
      next[idx] = updated;
      items.value = next;
    }

    return updated;
  }

  async function setDone(id: number, done: boolean) {
    const result = await api.post<{ done: boolean }>(`/schedule/${id}/done`, { done });
    const idx = items.value.findIndex((i) => i.id === id);

    if (idx !== -1) {
      const next = [...items.value];
      next[idx] = { ...next[idx], done: result.done ? 1 : 0 };
      items.value = next;
    }

    return result;
  }

  async function remove(id: number) {
    await api.delete(`/schedule/${id}`);
    items.value = items.value.filter((i) => i.id !== id);
  }

  const selectedItemId = ref<number | null>(null);

  function openDetail(itemOrId: ScheduleItem | number) {
    const id = typeof itemOrId === 'number' ? itemOrId : itemOrId.id;
    selectedItemId.value = id;
  }

  function closeDetail() {
    selectedItemId.value = null;
  }

  function buildScheduleNotePayload(existing: ScheduleItem, note: string): ScheduleFormData {
    return {
      trip_id: existing.trip_id,
      date: existing.date,
      end_date: existing.end_date ?? null,
      time: existing.time ?? undefined,
      end_time: existing.end_time ?? undefined,
      title: existing.title,
      note,
      location: existing.location ?? undefined,
      maps_link: existing.maps_link ?? undefined,
      lat: existing.lat ?? undefined,
      lng: existing.lng ?? undefined,
      spot_id: existing.spot_id ?? null,
      idea_id: existing.idea_id ?? null,
      auto_created: existing.auto_created ?? null,
      user_modified: existing.user_modified ?? null,
      done: existing.done ?? null,
    };
  }

  async function updateNote(id: number, note: string) {
    const idx = items.value.findIndex((item) => item.id === id);

    if (idx === -1) {
      return;
    }

    const existing = items.value[idx];
    const next = [...items.value];
    next[idx] = { ...existing, note };
    items.value = next;

    try {
      await update(id, buildScheduleNotePayload(existing, note));
    } catch {
      const rollback = [...items.value];
      const rollbackIdx = rollback.findIndex((item) => item.id === id);

      if (rollbackIdx !== -1) {
        rollback[rollbackIdx] = existing;
        items.value = rollback;
      }

      const { showToast } = useToast();
      showToast({
        message: 'Checklisten-Status konnte nicht gespeichert werden.',
        type: 'error',
      });
    }
  }

  return {
    items,
    loaded,
    selectedItemId,
    load,
    create,
    update,
    remove,
    setDone,
    updateNote,
    openDetail,
    closeDetail,
  };
});
