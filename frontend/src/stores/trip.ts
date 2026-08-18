import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';
import type { Trip } from '../api/types';
import { useAuthStore } from './auth';

export interface TripFormData {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  packing_category_required?: boolean;
}

export const useTripStore = defineStore('trip', () => {
  const auth = useAuthStore();
  const trips = ref<Trip[]>([]);
  // Kein synchrones Pre-Seeding aus localStorage mehr beim Store-Aufbau: der Schlüssel ist jetzt
  // pro Nutzer-Id (siehe storageKey() unten), die Nutzer-Id steht beim Store-Aufbau aber noch nicht
  // fest (auth.checkSession() ist zu dem Zeitpunkt noch nicht durchgelaufen). Unproblematisch, da
  // laut App.vue's Template ohnehin KEINE Domänen-Ansicht mountet, bevor tripStore.loaded (Ende von
  // loadTrips() unten) true ist - der frühere "null-Flash vermeiden"-Grund für das Pre-Seeding
  // entfällt dadurch.
  const currentTripId = ref<number | null>(null);
  const loaded = ref(false);
  // Zählt hoch, wenn aus einer einbettenden Sicht (z. B. Kalender) zur Urlaub-Bearbeitung
  // gesprungen werden soll. TripSwitcher beobachtet das und öffnet dafür sein Edit-Modal
  // (Architekturregel Batch 3: Fremdobjekte springen zur Ursprungssicht statt inline editierbar zu sein).
  const editTripRequestId = ref(0);

  const currentTrip = computed(() => trips.value.find((t) => t.id === currentTripId.value) ?? null);

  // Pro Nutzer-Id (nicht global): sonst würde reset() unten (bei JEDEM Logout, nicht nur bei einem
  // echten Nutzerwechsel) die zuletzt angesehene Auswahl löschen, weil ein einziger geteilter
  // Schlüssel keine Möglichkeit hat, "für wen" der Wert eigentlich galt.
  function storageKey(): string | null {
    return auth.user ? `reisotor-current-trip-id:${auth.user.id}` : null;
  }

  function persist() {
    const key = storageKey();
    if (!key) return;
    if (currentTripId.value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(currentTripId.value));
    }
  }

  async function loadTrips() {
    trips.value = await api.get<Trip[]>('/trips');

    const key = storageKey();
    const stored = key ? Number(localStorage.getItem(key)) : NaN;
    const storedIsValid = Number.isFinite(stored) && trips.value.some((t) => t.id === stored);

    if (storedIsValid) {
      currentTripId.value = stored;
    } else if (trips.value.length === 1) {
      // Einzige sinnvolle Wahl - keine Rätselraterei nötig.
      currentTripId.value = trips.value[0].id;
      persist();
    } else {
      // Keine gespeicherte Präferenz für DIESES Gerät (erster Login hier) und kein/mehr als ein
      // Urlaub - bewusst nicht "irgendeinen" (z. B. den ältesten) raten. App.vue leitet bei null auf
      // die Urlaubsübersicht (/trips) um, dort wählt der Nutzer bewusst.
      currentTripId.value = null;
    }

    loaded.value = true;
  }

  function selectTrip(id: number) {
    currentTripId.value = id;
    persist();
  }

  // Bei Login/Logout/Nutzerwechsel aufgerufen (siehe App.vue's Watcher auf auth.user?.id) - ohne
  // das würde currentTripId/trips eines vorherigen Nutzers für den gesamten SPA-Tab bestehen
  // bleiben, wenn sich jemand im selben Tab neu anmeldet, ohne dass die Seite hart neu geladen wird
  // (LoginView.vue navigiert per router.push). Nur In-Memory-State, bewusst OHNE persist(): die
  // pro-Nutzer localStorage-Präferenz (storageKey() oben) soll einen Logout überleben, damit
  // derselbe Nutzer beim nächsten Login auf diesem Gerät wieder seinen zuletzt angesehenen Urlaub
  // sieht, statt ihn bei jedem Ab-/Anmelden neu wählen zu müssen.
  function reset() {
    trips.value = [];
    currentTripId.value = null;
    loaded.value = false;
    editTripRequestId.value = 0;
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
    reset,
    selectTrip,
    requestEditTrip,
    createTrip,
    updateTrip,
    deleteTrip,
  };
});
