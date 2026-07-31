import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import type { ScheduleItem } from '../api/types';
import { useTripStore } from './trip';

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
}

// Eigener Store statt (wie zuvor) lokalem State in ScheduleView.vue: ein Spot/eine Tour auf einen
// Kalendertag ziehen (SpotCard.vue/ExcursionCard.vue) legt jetzt direkt einen Termin hier an – die
// Kalender-Schublade/-Seite muss denselben reaktiven Stand sehen, sonst taucht der frisch
// abgelegte Termin dort nicht sofort auf (analog zu stores/excursions.ts' Begründung).
export const useScheduleStore = defineStore('schedule', () => {
  const tripStore = useTripStore();
  const items = ref<ScheduleItem[]>([]);
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

  async function create(body: ScheduleFormData) {
    const created = await api.post<ScheduleItem>('/schedule', body);
    items.value.push(created);
    return created;
  }

  async function update(id: number, body: ScheduleFormData) {
    const updated = await api.put<ScheduleItem>(`/schedule/${id}`, body);
    const idx = items.value.findIndex((i) => i.id === id);
    if (idx !== -1) items.value[idx] = updated;
    return updated;
  }

  async function remove(id: number) {
    await api.delete(`/schedule/${id}`);
    items.value = items.value.filter((i) => i.id !== id);
  }

  return { items, loaded, load, create, update, remove };
});
