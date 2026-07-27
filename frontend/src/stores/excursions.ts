import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import type { Excursion } from '../api/types';
import { useTripStore } from './trip';

export interface ExcursionFormData {
  title: string;
  image_url?: string;
  note?: string;
  date?: string;
  station_keys?: string[];
}

// Eigener Store statt lokalem State in ExcursionsView: Ausflüge werden per Drag&Drop aus der
// Ausflüge-Sicht heraus in die (global gemountete) Kalender-Schublade gezogen, wo das Datum
// gesetzt wird. Beide Stellen müssen dieselbe reaktive Liste sehen, sonst zeigt die Ausflüge-Sicht
// nach dem Drop weiterhin das alte (fehlende) Datum an.
export const useExcursionsStore = defineStore('excursions', () => {
  const tripStore = useTripStore();
  const excursions = ref<Excursion[]>([]);
  const loaded = ref(false);

  async function load() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) {
      excursions.value = [];
      loaded.value = false;
      return;
    }
    excursions.value = await api.get<Excursion[]>(`/ideas?trip_id=${tripId}`);
    loaded.value = true;
  }

  watch(() => tripStore.currentTripId, load, { immediate: true });

  async function create(body: ExcursionFormData) {
    const created = await api.post<Excursion>('/ideas', { trip_id: tripStore.currentTripId, ...body });
    excursions.value.unshift(created);
    return created;
  }

  async function update(id: number, body: ExcursionFormData) {
    const updated = await api.put<Excursion>(`/ideas/${id}`, body);
    const idx = excursions.value.findIndex((e) => e.id === id);
    if (idx !== -1) excursions.value[idx] = updated;
    return updated;
  }

  async function remove(id: number) {
    await api.delete(`/ideas/${id}`);
    excursions.value = excursions.value.filter((e) => e.id !== id);
  }

  /** Setzt/ändert nur das Datum (Drag&Drop auf einen Kalendertag) – restliche Felder bleiben. */
  async function setDate(id: number, date: string | null) {
    const existing = excursions.value.find((e) => e.id === id);
    if (!existing) return;
    await update(id, {
      title: existing.title,
      image_url: existing.image_url ?? undefined,
      note: existing.note ?? undefined,
      date: date ?? undefined,
      station_keys: existing.station_keys,
    });
  }

  return { excursions, loaded, load, create, update, remove, setDate };
});
