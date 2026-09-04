import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { api } from '../api/client';
import type { ScheduleItem } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';
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
}

// Eigener Store statt (wie zuvor) lokalem State in ScheduleView.vue: ein Spot/eine Tour auf einen
// Kalendertag ziehen (SpotCard.vue/ExcursionCard.vue) legt jetzt direkt einen Termin hier an – die
// Kalender-Schublade/-Seite muss denselben reaktiven Stand sehen, sonst taucht der frisch
// abgelegte Termin dort nicht sofort auf (analog zu stores/excursions.ts' Begründung).
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
  // Lädt automatisch neu, wenn ein anderes Mitglied etwas am Kalender ändert (Echtzeit-Sync, siehe
  // stores/liveSync.ts) – unabhängig davon, ob die Kalender-Schublade gerade offen ist oder nicht,
  // da dieser Store (anders als eine einzelne View) permanent existiert.
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

  /** Setzt/aktualisiert das (früheste) Datum, an dem ein Spot eingeplant ist (#106: Kalender-
   *  Bestätigungs-Flow beim Markieren als "gemacht", SpotCard.vue/ScheduleView.vue) -
   *  überschreibt einen bereits bestehenden Termin statt einen zweiten anzulegen, damit ein
   *  erneutes Datum-Bestätigen nicht ungewollt einen zusätzlichen Kalendereintrag erzeugt. */
  async function setSpotDate(spotId: number, tripId: number, title: string, date: string) {
    const existing = items.value
      .filter((i) => i.spot_id === spotId)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (existing) {
      await update(existing.id, {
        trip_id: existing.trip_id,
        date,
        end_date: existing.end_date,
        time: existing.time ?? undefined,
        end_time: existing.end_time ?? undefined,
        title: existing.title,
        note: existing.note ?? undefined,
        location: existing.location ?? undefined,
        maps_link: existing.maps_link ?? undefined,
        lat: existing.lat ?? undefined,
        lng: existing.lng ?? undefined,
        spot_id: existing.spot_id,
        idea_id: existing.idea_id,
      });
    } else {
      await create({
        trip_id: tripId,
        date,
        title,
        spot_id: spotId,
        auto_created: 1,
        user_modified: 0,
      });
    }
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

  return {
    items,
    loaded,
    selectedItemId,
    load,
    create,
    update,
    remove,
    setSpotDate,
    openDetail,
    closeDetail,
  };
});
