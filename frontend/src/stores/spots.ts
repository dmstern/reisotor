import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import type { Spot, SpotComment, SpotLike } from '../api/types';
import { useTripStore } from './trip';
import { useUndoableDelete } from '../composables/useUndoableDelete';

export interface SpotFormData {
  trip_id: number;
  title: string;
  image_url?: string;
  category?: string;
  note?: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
}

// Eigener Store statt lokalem State in ExcursionsView (analog zu stores/excursions.ts): Spots
// werden jetzt auch außerhalb der Ausflüge-Sicht gebraucht (TripMap.vue's Stationsliste,
// ExcursionDetailDialog.vue's Stationen-Klick), beide sollen dabei denselben Like-/Kommentar-Stand
// sehen wie die Spots-Übersicht, ohne eigene Parallel-Fetches.
export const useSpotsStore = defineStore('spots', () => {
  const tripStore = useTripStore();
  const spots = ref<Spot[]>([]);
  const spotLikes = ref<SpotLike[]>([]);
  const spotComments = ref<SpotComment[]>([]);
  const loaded = ref(false);
  const { isPending, markPendingDelete, clearPending } = useUndoableDelete();

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
    return spotComments.value.filter((c) => c.spot_id === spotId).sort((a, b) => a.created_at.localeCompare(b.created_at));
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

  // Weicher Löschvorgang serverseitig (siehe routes/spots.ts) + 60s Rückgängig-Fenster clientseitig
  // (useUndoableDelete.ts) – siehe gleiches Muster in stores/schedule.ts.
  async function remove(id: number) {
    await api.delete(`/spots/${id}`);
    markPendingDelete(id, () => {
      spots.value = spots.value.filter((s) => s.id !== id);
    });
  }

  async function restore(id: number) {
    clearPending(id);
    await api.post(`/trash/spot/${id}/restore`);
  }

  async function toggleLike(spotId: number, userId: number) {
    const result = await api.post<{ liked: boolean }>(`/spots/${spotId}/like`);
    if (result.liked) {
      spotLikes.value.push({ id: Date.now(), spot_id: spotId, user_id: userId });
    } else {
      spotLikes.value = spotLikes.value.filter((l) => !(l.spot_id === spotId && l.user_id === userId));
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
    restore,
    isPending,
    toggleLike,
    submitComment,
    removeComment,
  };
});
