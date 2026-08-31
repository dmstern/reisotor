import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';
import { api } from '../api/client';
import type { LocationTrack, TrackPoint, TrackVisibility } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';

export interface TrackUpdateData {
  title?: string | null;
  visibility?: TrackVisibility;
  excursion_id?: number | null;
}

// Vergangene Standort-Aufzeichnungen (im Gegensatz zu stores/trackRecording.ts, das die aktuell
// LAUFENDE Sitzung verwaltet) - eigene, geteilte und geteilte fremde Tracks, siehe
// backend/src/routes/tracks.ts's Sichtbarkeitsregel. Punkte werden pro Track erst on-demand
// geladen (ExcursionsView.vue's Aufzeichnungen-Liste/TripMap.vue zeigen zunächst nur Titel/Dauer),
// nicht direkt mit der Liste - eine mehrstündige Aufzeichnung kann tausende Punkte haben.
export const useTracksStore = defineStore('tracks', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();

  const tracks = ref<LocationTrack[]>([]);
  const loaded = ref(false);
  const pointsByTrack = ref<Record<number, TrackPoint[]>>({});

  async function load() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) {
      tracks.value = [];
      loaded.value = false;
      return;
    }
    tracks.value = await api.get<LocationTrack[]>(`/tracks?trip_id=${tripId}`);
    loaded.value = true;
  }

  watch(() => tripStore.currentTripId, load, { immediate: true });
  // Track-Aktivität (Teilen/Anlegen) wird über die 'ideas'-Domäne mit-broadcastet (siehe
  // routes/tracks.ts's PUT /tracks/:id) - Aufzeichnungen leben visuell/organisatorisch ohnehin in
  // ExcursionsView.vue, kein eigenes Nav-Item nötig.
  watch(() => liveSync.domainVersion.ideas, load);

  async function loadPoints(trackId: number): Promise<TrackPoint[]> {
    try {
      const points = await api.get<TrackPoint[]>(`/tracks/${trackId}/points`);
      pointsByTrack.value = { ...pointsByTrack.value, [trackId]: points };
      return points;
    } catch {
      return pointsByTrack.value[trackId] ?? [];
    }
  }

  async function update(id: number, body: TrackUpdateData) {
    const updated = await api.put<LocationTrack>(`/tracks/${id}`, body);
    const idx = tracks.value.findIndex((t) => t.id === id);
    if (idx !== -1) tracks.value[idx] = updated;
    return updated;
  }

  async function remove(id: number) {
    await api.delete(`/tracks/${id}`);
    tracks.value = tracks.value.filter((t) => t.id !== id);
    const nextPoints = { ...pointsByTrack.value };
    delete nextPoints[id];
    pointsByTrack.value = nextPoints;
  }

  function getPointsForTrack(trackId: number): TrackPoint[] {
    return pointsByTrack.value[trackId] ?? [];
  }

  return { tracks, loaded, pointsByTrack, getPointsForTrack, load, loadPoints, update, remove };
});
