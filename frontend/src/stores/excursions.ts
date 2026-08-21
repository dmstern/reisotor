import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import type { Excursion, IdeaRole } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';
import { useUndoableDelete } from '../composables/useUndoableDelete';

export interface ExcursionFormData {
  title: string;
  image_url?: string;
  note?: string;
  note_format?: 'html' | 'legacy';
  date?: string;
  spot_ids?: number[];
  // Transportmittel-Kontext (#176) - macht aus einer normalen Tour eine ehemalige Reise-Etappe.
  role?: IdeaRole | null;
  transport_type?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  checkin_info?: string | null;
  amount?: number | null;
  paid_by_user_id?: number | null;
  luggage?: string | null;
  seat?: string | null;
  ticket_link?: string | null;
}

// Eigener Store statt lokalem State in ExcursionsView: Ausflüge werden per Drag&Drop aus der
// Ausflüge-Sicht heraus in die (global gemountete) Kalender-Schublade gezogen, wo das Datum
// gesetzt wird. Beide Stellen müssen dieselbe reaktive Liste sehen, sonst zeigt die Ausflüge-Sicht
// nach dem Drop weiterhin das alte (fehlende) Datum an.
export const useExcursionsStore = defineStore('excursions', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();
  const excursions = ref<Excursion[]>([]);
  const loaded = ref(false);
  const { isPending, markPendingDelete, clearPending } = useUndoableDelete();

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
  // Echtzeit-Sync (siehe stores/liveSync.ts): lädt neu, sobald ein anderes Mitglied etwas an den
  // Touren/Ausflügen ändert.
  watch(() => liveSync.domainVersion.ideas, load);

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

  // Weicher Löschvorgang serverseitig (siehe routes/ideas.ts) + 60s Rückgängig-Fenster clientseitig
  // (useUndoableDelete.ts) – siehe gleiches Muster in stores/schedule.ts.
  async function remove(id: number) {
    await api.delete(`/ideas/${id}`);
    markPendingDelete(id, () => {
      excursions.value = excursions.value.filter((e) => e.id !== id);
    });
  }

  async function restore(id: number) {
    clearPending(id);
    await api.post(`/trash/excursion/${id}/restore`);
  }

  /** Setzt/ändert nur das Datum (Drag&Drop auf einen Kalendertag) – restliche Felder bleiben,
   *  inklusive Transportmittel-Kontext (role/...) einer ehemaligen Reise-Etappe: update() ersetzt
   *  bei PUT /ideas immer alle Felder, ein Weglassen hier würde sie sonst stillschweigend löschen. */
  async function setDate(id: number, date: string | null) {
    const existing = excursions.value.find((e) => e.id === id);
    if (!existing) return;
    await update(id, {
      title: existing.title,
      image_url: existing.image_url ?? undefined,
      note: existing.note ?? undefined,
      date: date ?? undefined,
      spot_ids: existing.spot_ids,
      role: existing.role,
      transport_type: existing.transport_type,
      departure_time: existing.departure_time,
      arrival_time: existing.arrival_time,
      checkin_info: existing.checkin_info,
      amount: existing.amount,
      paid_by_user_id: existing.paid_by_user_id,
      luggage: existing.luggage,
      seat: existing.seat,
      ticket_link: existing.ticket_link,
    });
  }

  /** NICHT für das Einplanen eines Spots im Kalender (das legt einen direkt mit dem Spot
   *  verknüpften Termin an, siehe stores/schedule.ts/SpotCard.vue) – nur noch für DiaryView.vue's
   *  Spot-Picker, der einen Ausflug zum Verknüpfen braucht (diary_excursions referenziert
   *  ausschließlich idea_id). Legt dafür im Hintergrund einen Ein-Spot-Ausflug an oder gibt einen
   *  bereits dafür bestehenden zurück (dedupliziert über trip_id+Termin-Datum+Station, siehe
   *  POST /ideas/plan-spot). */
  async function planSpotOnDate(spotId: number, date: string) {
    const excursion = await api.post<Excursion>('/ideas/plan-spot', {
      trip_id: tripStore.currentTripId,
      spot_id: spotId,
      date,
    });
    const idx = excursions.value.findIndex((e) => e.id === excursion.id);
    if (idx !== -1) excursions.value[idx] = excursion;
    else excursions.value.unshift(excursion);
    return excursion;
  }

  /** Setzt/entfernt den "gemacht"-Status, unabhängig von geplant/ungeplant (siehe date oben) -
   *  eigener Endpunkt statt eines vollen update(), damit ein Toggle nicht alle anderen Felder
   *  (Titel/Notiz/Spots/Datum) erneut mitschicken muss. */
  async function setDone(id: number, done: boolean) {
    const result = await api.post<{ done: boolean }>(`/ideas/${id}/done`, { done });
    const existing = excursions.value.find((e) => e.id === id);
    if (existing) existing.done = result.done ? 1 : 0;
  }

  return { excursions, loaded, load, create, update, remove, restore, isPending, setDate, planSpotOnDate, setDone };
});
