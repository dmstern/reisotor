import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import type { Trip } from '../api/types';

const STORAGE_KEY = 'reisotor-current-trip-id';

export interface TripFormData {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
}

export const useTripStore = defineStore('trip', () => {
  const trips = ref<Trip[]>([]);
  const currentTripId = ref<number | null>(null);
  const loaded = ref(false);
  // Zählt hoch, wenn aus einer einbettenden Sicht (z. B. Kalender) zur Reise-Bearbeitung
  // gesprungen werden soll. TripSwitcher beobachtet das und öffnet dafür sein Edit-Modal
  // (Architekturregel Batch 3: Fremdobjekte springen zur Ursprungssicht statt inline editierbar zu sein).
  const editTripRequestId = ref(0);

  const currentTrip = computed(() => trips.value.find((t) => t.id === currentTripId.value) ?? null);

  function persist() {
    if (currentTripId.value == null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(currentTripId.value));
    }
  }

  async function loadTrips() {
    trips.value = await api.get<Trip[]>('/trips');

    const stored = Number(localStorage.getItem(STORAGE_KEY));
    const storedIsValid = Number.isFinite(stored) && trips.value.some((t) => t.id === stored);

    if (storedIsValid) {
      currentTripId.value = stored;
    } else {
      currentTripId.value = trips.value[0]?.id ?? null;
      persist();
    }

    loaded.value = true;
  }

  function selectTrip(id: number) {
    currentTripId.value = id;
    persist();
  }

  function requestEditTrip() {
    editTripRequestId.value++;
  }

  async function createTrip(body: TripFormData) {
    const created = await api.post<Trip>('/trips', body);
    trips.value.push(created);
    selectTrip(created.id);
    return created;
  }

  async function updateTrip(id: number, body: TripFormData) {
    const updated = await api.put<Trip>(`/trips/${id}`, body);
    const idx = trips.value.findIndex((t) => t.id === id);
    if (idx !== -1) trips.value[idx] = updated;
    return updated;
  }

  async function deleteTrip(id: number) {
    await api.delete(`/trips/${id}`);
    trips.value = trips.value.filter((t) => t.id !== id);
    if (currentTripId.value === id) {
      currentTripId.value = trips.value[0]?.id ?? null;
      persist();
    }
  }

  return {
    trips,
    currentTripId,
    currentTrip,
    loaded,
    editTripRequestId,
    loadTrips,
    selectTrip,
    requestEditTrip,
    createTrip,
    updateTrip,
    deleteTrip,
  };
});
