import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import type { Spot, SpotComment, SpotLike } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';
import { useToast } from '../composables/useToast';
export interface SpotFormData {
  trip_id: number;
  title: string;
  image_url?: string;
  category?: string;
  note?: string;
  note_format?: 'html' | 'legacy';
  maps_link?: string;
  lat?: number;
  lng?: number;
  /** Heimat-Seite (Flughafen/Bahnhof/Zuhause/…), unabhängig von der Kategorie – siehe Spot.is_home
   *  in api/types.ts. Nur für als Reise-Etappen-Ort verwendete Spots relevant. */
  is_home?: boolean;
  // Zusatzfelder für Spots der Kategorie "Unterkunft" (siehe Spot.address/… in api/types.ts).
  address?: string;
  start_date?: string;
  end_date?: string;
  checkin?: string;
  checkout?: string;
  contact?: string;
  amount?: number;
  paid_by_user_id?: number | null;
}

// Eigener Store statt lokalem State in ExcursionsView (analog zu stores/excursions.ts): Spots
// werden jetzt auch außerhalb der Ausflüge-Sicht gebraucht (TripMap.vue's Stationsliste), die
// dabei denselben Like-/Kommentar-Stand sehen soll wie die Spots-Übersicht, ohne eigene
// Parallel-Fetches.
export const useSpotsStore = defineStore('spots', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const spots = ref<Spot[]>([]);
  const spotLikes = ref<SpotLike[]>([]);
  const spotComments = ref<SpotComment[]>([]);
  const loaded = ref(false);

  async function load() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) {
      spots.value = [];
      spotLikes.value = [];
      spotComments.value = [];
      loaded.value = false;
      return;
    }
    const [spotsRes, likesRes, commentsRes] = await Promise.all([
      api.get<Spot[]>(`/spots?trip_id=${tripId}`),
      api.get<SpotLike[]>(`/spots/likes?trip_id=${tripId}`),
      api.get<SpotComment[]>(`/spots/comments?trip_id=${tripId}`),
    ]);
    spots.value = spotsRes;
    spotLikes.value = likesRes;
    spotComments.value = commentsRes;
    loaded.value = true;
  }

  watch(() => tripStore.currentTripId, load, { immediate: true });
  // Echtzeit-Sync (siehe stores/liveSync.ts): lädt neu, sobald ein anderes Mitglied etwas an den
  // Spots ändert.
  watch(() => liveSync.domainVersion.spots, load);

  function likesFor(spotId: number) {
    return spotLikes.value.filter((l) => l.spot_id === spotId);
  }
  function likeCountFor(spotId: number) {
    return likesFor(spotId).length;
  }
  function likedByMe(spotId: number, userId: number | undefined) {
    return userId != null && likesFor(spotId).some((l) => l.user_id === userId);
  }
  function commentsFor(spotId: number) {
    return spotComments.value
      .filter((c) => c.spot_id === spotId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async function create(body: SpotFormData) {
    const created = await api.post<Spot>('/spots', body);
    spots.value.unshift(created);
    return created;
  }

  async function update(id: number, body: SpotFormData) {
    const updated = await api.put<Spot>(`/spots/${id}`, body);
    const idx = spots.value.findIndex((s) => s.id === id);
    if (idx !== -1) spots.value[idx] = updated;
    return updated;
  }

  async function remove(id: number) {
    const { showToast } = useToast();
    await api.delete(`/spots/${id}`);
    spots.value = spots.value.filter((s) => s.id !== id);
    showToast({ message: 'Ort gelöscht. Er befindet sich nun im Papierkorb.', type: 'info' });
  }

  async function toggleLike(spotId: number, userId: number) {
    const result = await api.post<{ liked: boolean }>(`/spots/${spotId}/like`);
    if (result.liked) {
      spotLikes.value.push({ id: Date.now(), spot_id: spotId, user_id: userId });
    } else {
      spotLikes.value = spotLikes.value.filter(
        (l) => !(l.spot_id === spotId && l.user_id === userId)
      );
    }
  }

  async function submitComment(spotId: number, content: string) {
    const created = await api.post<SpotComment>(`/spots/${spotId}/comments`, { content });
    spotComments.value.push(created);
    return created;
  }

  async function removeComment(id: number) {
    await api.delete(`/spots/comments/${id}`);
    spotComments.value = spotComments.value.filter((c) => c.id !== id);
  }

  /** Setzt/entfernt den "gemacht"-Status, unabhängig von geplant/ungeplant (siehe
   *  ExcursionsView.vue's clientseitig aus schedule_items abgeleitetem Status) - eigener Endpunkt
   *  statt eines vollen update(), damit ein Toggle nicht alle anderen Felder erneut mitschicken muss. */
  async function setDone(id: number, done: boolean) {
    const result = await api.post<{ done: boolean }>(`/spots/${id}/done`, { done });
    const existing = spots.value.find((s) => s.id === id);
    if (existing) existing.done = result.done ? 1 : 0;
  }

  return {
    spots,
    spotLikes,
    spotComments,
    loaded,
    load,
    likesFor,
    likeCountFor,
    likedByMe,
    commentsFor,
    create,
    update,
    remove,
    toggleLike,
    submitComment,
    removeComment,
    setDone,
  };
});
