import { computed, ref, watch, type Ref } from 'vue';
import type { ScheduleItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import { useDraftAutosave } from './useDraftAutosave';
import { useToast } from './useToast';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

export interface UseScheduleItemFormOptions {
  selectedDate?: Ref<string | null>;
}

export function parseLinkKey(key: string): { spot_id: number | null; idea_id: number | null } {
  if (key.startsWith('spot:')) return { spot_id: Number(key.slice('spot:'.length)), idea_id: null };
  if (key.startsWith('idea:')) return { spot_id: null, idea_id: Number(key.slice('idea:'.length)) };
  return { spot_id: null, idea_id: null };
}

export function linkKeyFor(item: Pick<ScheduleItem, 'spot_id' | 'idea_id'>): string {
  if (item.spot_id != null) return `spot:${item.spot_id}`;
  if (item.idea_id != null) return `idea:${item.idea_id}`;
  return '';
}

/**
 * Bündelt die State- und Formularlogik zum Anlegen und Bearbeiten von Terminen,
 * inklusive Entwurfs-Autosave, Validierung, Verknüpfungen (Spot/Tour) und Löschung.
 */
export function useScheduleItemForm(options: UseScheduleItemFormOptions = {}) {
  const tripStore = useTripStore();
  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();
  const scheduleStore = useScheduleStore();
  const { showToast } = useToast();

  const placeNames = computed(() => spotsStore.spots.map((s) => s.title));

  // --- Add Form State ---
  const newStartDate = ref('');
  const newTime = ref('');
  const newEndTime = ref('');
  const newTitle = ref('');
  const newNote = ref('');
  const newEndDate = ref('');
  const newLocation = ref('');
  const newMapsLink = ref('');
  const newLinkKey = ref('');
  const showAddForm = ref(false);
  const showAddLocationSection = ref(false);

  const newTitleTouched = ref(false);
  const newStartDateTouched = ref(false);
  const showNewTitleError = computed(() => newTitleTouched.value && !newTitle.value.trim());
  const showNewStartDateError = computed(() => newStartDateTouched.value && !newStartDate.value);

  const canAddScheduleItem = computed(() => !!newTitle.value.trim() && !!newStartDate.value);
  const addScheduleItemTooltip = computed(() => {
    if (!newTitle.value.trim()) return 'Bitte gib zuerst einen Titel für den Termin ein';
    if (!newStartDate.value) return 'Bitte wähle ein Startdatum aus';
    return undefined;
  });

  const newFormBundle = computed<Record<string, unknown>>({
    get: () => ({
      newStartDate: newStartDate.value,
      newTime: newTime.value,
      newEndTime: newEndTime.value,
      newTitle: newTitle.value,
      newNote: newNote.value,
      newEndDate: newEndDate.value,
      newLocation: newLocation.value,
      newMapsLink: newMapsLink.value,
      newLinkKey: newLinkKey.value,
    }),
    set: (v) => {
      newStartDate.value = (v.newStartDate as string) ?? '';
      newTime.value = (v.newTime as string) ?? '';
      newEndTime.value = (v.newEndTime as string) ?? '';
      newTitle.value = (v.newTitle as string) ?? '';
      newNote.value = (v.newNote as string) ?? '';
      newEndDate.value = (v.newEndDate as string) ?? '';
      newLocation.value = (v.newLocation as string) ?? '';
      newMapsLink.value = (v.newMapsLink as string) ?? '';
      newLinkKey.value = (v.newLinkKey as string) ?? '';
    },
  });
  const newDraft = useDraftAutosave('schedule:new', newFormBundle, showAddForm);

  // --- Edit Form State ---
  const editingItem = ref<ScheduleItem | null>(null);
  const isItemUploadingAttachments = ref(false);
  const showEditLocationSection = ref(false);
  const editTitleTouched = ref(false);

  const editForm = ref({
    time: '',
    endTime: '',
    title: '',
    note: '',
    endDate: '',
    location: '',
    mapsLink: '',
    linkKey: '',
  });

  const showEditTitleError = computed(() => editTitleTouched.value && !editForm.value.title.trim());

  const canSaveEditScheduleItem = computed(
    () => !!editForm.value.title.trim() && !isItemUploadingAttachments.value
  );
  const editScheduleItemTooltip = computed(() => {
    if (isItemUploadingAttachments.value) return 'Dateianhänge werden noch hochgeladen…';
    if (!editForm.value.title.trim()) return 'Bitte gib zuerst einen Titel für den Termin ein';
    return undefined;
  });

  const editDraft = useDraftAutosave(
    () => `schedule:edit:${editingItem.value?.id}`,
    editForm,
    computed(() => editingItem.value !== null)
  );

  // --- Link Key & Location resolution ---
  function titleForLinkKey(key: string): string | null {
    const { spot_id, idea_id } = parseLinkKey(key);
    if (spot_id != null) return spotsStore.spots.find((s) => s.id === spot_id)?.title ?? null;
    if (idea_id != null)
      return excursionsStore.excursions.find((e) => e.id === idea_id)?.title ?? null;
    return null;
  }

  watch(newLinkKey, (key) => {
    const t = key && titleForLinkKey(key);
    if (t && !newTitle.value.trim()) newTitle.value = t;
  });

  watch(
    () => editForm.value.linkKey,
    (key) => {
      const t = key && titleForLinkKey(key);
      if (t && !editForm.value.title.trim()) editForm.value.title = t;
    }
  );

  function placeMapsLinkFor(name: string): string | null {
    return spotsStore.spots.find((s) => s.title === name)?.maps_link ?? null;
  }

  watch(newLocation, (name) => {
    const mapsLink = placeMapsLinkFor(name);
    if (mapsLink) newMapsLink.value = mapsLink;
  });

  watch(
    () => editForm.value.location,
    (name) => {
      const mapsLink = placeMapsLinkFor(name);
      if (mapsLink) editForm.value.mapsLink = mapsLink;
    }
  );

  async function syncExcursionsIfLinked(...ideaIds: (number | null | undefined)[]) {
    if (ideaIds.some((id) => id != null)) await excursionsStore.load();
  }

  // --- Add Form Actions ---
  function openAddForm(defaultDate?: string | Event) {
    newTitleTouched.value = false;
    newStartDateTouched.value = false;
    newStartDate.value =
      typeof defaultDate === 'string' ? defaultDate : (options.selectedDate?.value ?? '');
    showAddLocationSection.value = !!(newLinkKey.value || newLocation.value || newMapsLink.value);
    showAddForm.value = true;
  }

  function closeAddForm() {
    newTitleTouched.value = false;
    newStartDateTouched.value = false;
    showAddForm.value = false;
    showAddLocationSection.value = false;
    newStartDate.value = '';
    newTime.value = '';
    newEndTime.value = '';
    newTitle.value = '';
    newNote.value = '';
    newEndDate.value = '';
    newLocation.value = '';
    newMapsLink.value = '';
    newLinkKey.value = '';
    newDraft.clear();
  }

  function discardNewDraft() {
    newTitleTouched.value = false;
    newStartDateTouched.value = false;
    showAddLocationSection.value = false;
    newStartDate.value = '';
    newTime.value = '';
    newEndTime.value = '';
    newTitle.value = '';
    newNote.value = '';
    newEndDate.value = '';
    newLocation.value = '';
    newMapsLink.value = '';
    newLinkKey.value = '';
    newDraft.clear();
    showToast({ message: 'Entwurf verworfen.', type: 'info' });
  }

  async function addItem() {
    if (!newStartDate.value || !newTitle.value.trim() || tripStore.currentTripId == null) {
      if (!newTitle.value.trim()) newTitleTouched.value = true;
      if (!newStartDate.value) newStartDateTouched.value = true;
      return;
    }
    const parsed = parseLatLngFromMapsLink(newMapsLink.value);
    const { spot_id, idea_id } = parseLinkKey(newLinkKey.value);
    const linked = spot_id != null || idea_id != null;
    await scheduleStore.create({
      trip_id: tripStore.currentTripId,
      date: newStartDate.value,
      end_date: newEndDate.value || undefined,
      time: newTime.value || undefined,
      end_time: newEndTime.value || undefined,
      title: newTitle.value.trim(),
      note: newNote.value || undefined,
      location: linked ? undefined : newLocation.value || undefined,
      maps_link: linked ? undefined : newMapsLink.value || undefined,
      lat: linked ? undefined : parsed?.lat,
      lng: linked ? undefined : parsed?.lng,
      spot_id,
      idea_id,
    });
    await syncExcursionsIfLinked(idea_id);
    closeAddForm();
  }

  // --- Edit Form Actions ---
  function startEdit(item: ScheduleItem) {
    editTitleTouched.value = false;
    editForm.value = {
      time: item.time ?? '',
      endTime: item.end_time ?? '',
      title: item.title,
      note: item.note ?? '',
      endDate: item.end_date ?? '',
      location: item.location ?? '',
      mapsLink: item.maps_link ?? '',
      linkKey: linkKeyFor(item),
    };
    showEditLocationSection.value = !!(
      editForm.value.linkKey ||
      editForm.value.location ||
      editForm.value.mapsLink
    );
    editingItem.value = item;
  }

  async function submitEdit() {
    if (!editForm.value.title.trim()) {
      editTitleTouched.value = true;
      return;
    }
    if (!editingItem.value || isItemUploadingAttachments.value || tripStore.currentTripId == null)
      return;
    const parsed = parseLatLngFromMapsLink(editForm.value.mapsLink);
    const { spot_id, idea_id } = parseLinkKey(editForm.value.linkKey);
    const linked = spot_id != null || idea_id != null;
    const previousIdeaId = editingItem.value.idea_id;
    await scheduleStore.update(editingItem.value.id, {
      trip_id: tripStore.currentTripId,
      date: editingItem.value.date,
      end_date: editForm.value.endDate || undefined,
      time: editForm.value.time || undefined,
      end_time: editForm.value.endTime || undefined,
      title: editForm.value.title.trim(),
      note: editForm.value.note || undefined,
      location: linked ? undefined : editForm.value.location || undefined,
      maps_link: linked ? undefined : editForm.value.mapsLink || undefined,
      lat: linked ? undefined : (parsed?.lat ?? editingItem.value.lat ?? undefined),
      lng: linked ? undefined : (parsed?.lng ?? editingItem.value.lng ?? undefined),
      spot_id,
      idea_id,
      user_modified: 1,
    });
    await syncExcursionsIfLinked(previousIdeaId, idea_id);
    editDraft.clear();
    editingItem.value = null;
  }

  function closeEditForm() {
    editTitleTouched.value = false;
    editDraft.clear();
    editingItem.value = null;
    showEditLocationSection.value = false;
  }

  function discardEditDraft() {
    if (!editingItem.value) return;
    startEdit(editingItem.value);
    editDraft.clear();
    showToast({ message: 'Änderungen verworfen.', type: 'info' });
  }

  async function deleteEditingItem() {
    if (!editingItem.value || isItemUploadingAttachments.value) return;
    const ideaId = editingItem.value.idea_id;
    await scheduleStore.remove(editingItem.value.id);
    showToast({ message: 'Termin gelöscht. Er befindet sich nun im Papierkorb.', type: 'info' });
    await syncExcursionsIfLinked(ideaId);
    closeEditForm();
  }

  return {
    placeNames,
    // Add form
    newStartDate,
    newTime,
    newEndTime,
    newTitle,
    newNote,
    newEndDate,
    newLocation,
    newMapsLink,
    newLinkKey,
    showAddForm,
    showAddLocationSection,
    newTitleTouched,
    newStartDateTouched,
    showNewTitleError,
    showNewStartDateError,
    canAddScheduleItem,
    addScheduleItemTooltip,
    newDraft,
    openAddForm,
    closeAddForm,
    discardNewDraft,
    addItem,
    // Edit form
    editingItem,
    isItemUploadingAttachments,
    showEditLocationSection,
    editTitleTouched,
    editForm,
    showEditTitleError,
    canSaveEditScheduleItem,
    editScheduleItemTooltip,
    editDraft,
    startEdit,
    submitEdit,
    closeEditForm,
    discardEditDraft,
    deleteEditingItem,
  };
}
