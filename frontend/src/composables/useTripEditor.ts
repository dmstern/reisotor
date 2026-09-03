import { ref, computed } from 'vue';
import { useTripStore, type TripFormData } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useDraftAutosave } from './useDraftAutosave';
import type { Trip } from '../api/types';

/** Bündelt die Anlegen-/Bearbeiten-/Löschen-Logik für Urlaube, die TripSwitcher.vue (Header-
 *  Dropdown) und TripsView.vue (Urlaubsübersicht, siehe Issue #75) beide brauchen - vorher nur in
 *  TripSwitcher.vue, dort per Copy-Paste zu duplizieren hätte ~90 Zeilen identischer Logik ergeben. */
export function useTripEditor() {
  const tripStore = useTripStore();
  const drawers = useDrawersStore();
  const showForm = ref(false);
  const editingTrip = ref<Trip | null>(null);

  const emptyTripForm = (): TripFormData => ({
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    maps_link: '',
    image_url: '',
    packing_category_required: true,
  });

  const tripForm = ref<TripFormData>(emptyTripForm());
  const editTripForm = ref<TripFormData>(emptyTripForm());

  const newDraft = useDraftAutosave(
    'trips:new',
    tripForm,
    computed(() => showForm.value && editingTrip.value === null)
  );

  const editDraft = useDraftAutosave(
    () => `trips:edit:${editingTrip.value?.id}`,
    editTripForm,
    computed(() => showForm.value && editingTrip.value !== null)
  );

  // Bleibt gesetzt, solange nach dem Anlegen eines neuen Urlaubs die Standort-Auflösung fehlschlägt
  // (siehe onSubmit) – ein erneuter Speicherversuch (z. B. mit manuell gesetztem Pin) muss dann den
  // bereits angelegten Urlaub AKTUALISIEREN statt einen zweiten anzulegen.
  const pendingFixTripId = ref<number | null>(null);
  const tripFormLocationError = ref(false);

  function openCreate() {
    editingTrip.value = null;
    pendingFixTripId.value = null;
    tripFormLocationError.value = false;
    showForm.value = true;
  }

  function openEdit(trip: Trip) {
    editingTrip.value = trip;
    editTripForm.value = {
      name: trip.name,
      destination: trip.destination ?? '',
      start_date: trip.start_date ?? '',
      end_date: trip.end_date ?? '',
      maps_link: trip.maps_link ?? '',
      image_url: trip.image_url ?? '',
      packing_category_required: trip.packing_category_required !== 0,
    };
    pendingFixTripId.value = null;
    tripFormLocationError.value = false;
    showForm.value = true;
  }

  function closeForm() {
    showForm.value = false;
    if (editingTrip.value) {
      editDraft.clear();
    } else {
      newDraft.clear();
    }
    editingTrip.value = null;
    pendingFixTripId.value = null;
    tripFormLocationError.value = false;
  }

  async function onSubmit(data: TripFormData) {
    const result =
      pendingFixTripId.value != null
        ? await tripStore.updateTrip(pendingFixTripId.value, data)
        : editingTrip.value
          ? await tripStore.updateTrip(editingTrip.value.id, data)
          : await tripStore.createTrip(data);

    // Serverseitige Auflösung (backend/src/utils/mapsLink.ts) ebenfalls fehlgeschlagen, z. B. weil
    // Google einen Maps-Kurzlink per Bot-Erkennung blockt – Dialog offen lassen, TripForm zeigt einen
    // Fehler-Hinweis und öffnet automatisch den manuellen Karten-Picker (LocationPicker.vue).
    if (data.maps_link && result.lat == null && data.lat == null) {
      pendingFixTripId.value = result.id;
      tripFormLocationError.value = true;
      return;
    }
    // Analog zu Unterkunft-/Reise-/Ausflüge-Sicht: signalisiert TripMap.vue (Marker-Refresh) und
    // ScheduleView.vue (Kalender-Wetter-Refresh), dass sich ein Ort geändert haben könnte.
    drawers.touchLocations();
    closeForm();
  }

  async function onDelete(trip: Trip) {
    const confirmed = window.confirm(
      `Urlaub "${trip.name}" wirklich löschen? Alle zugehörigen Daten (Kalender, Packliste, Touren, Unterkunft, Budget, ...) werden unwiderruflich gelöscht.`
    );
    if (!confirmed) return;
    await tripStore.deleteTrip(trip.id);
  }

  return {
    showForm,
    editingTrip,
    pendingFixTripId,
    tripFormLocationError,
    openCreate,
    openEdit,
    closeForm,
    onSubmit,
    onDelete,
  };
}
