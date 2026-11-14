import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { api } from '../api/client';
import type { DiaryEntry } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';

export const useDiaryStore = defineStore('diary', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const entries = shallowRef<DiaryEntry[]>([]);
  const loaded = ref(false);

  async function load() {
    const tripId = tripStore.currentTripId;

    if (tripId == null) {
      entries.value = [];
      loaded.value = false;
      return;
    }

    try {
      const res = await api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`);
      entries.value = (res || []).map((e) => ({
        ...e,
        images: Array.isArray(e.images) ? e.images.filter(Boolean) : [],
        excursion_ids: Array.isArray(e.excursion_ids) ? e.excursion_ids : [],
        spot_ids: Array.isArray(e.spot_ids) ? e.spot_ids : [],
        editor_ids: Array.isArray(e.editor_ids) ? e.editor_ids : [],
      }));
      loaded.value = true;
    } catch {
      // Offline und (noch) kein Cache-Eintrag
    }
  }

  function setEntries(newEntries: DiaryEntry[]) {
    entries.value = newEntries.map((e) => ({
      ...e,
      images: Array.isArray(e.images) ? e.images.filter(Boolean) : [],
      excursion_ids: Array.isArray(e.excursion_ids) ? e.excursion_ids : [],
      spot_ids: Array.isArray(e.spot_ids) ? e.spot_ids : [],
      editor_ids: Array.isArray(e.editor_ids) ? e.editor_ids : [],
    }));
    loaded.value = true;
  }

  watch(() => liveSync.domainVersion.diary, load);
  watch(
    () => tripStore.currentTripId,
    () => {
      loaded.value = false;
      void load();
    }
  );

  return {
    entries,
    loaded,
    load,
    setEntries,
  };
});
