import { ref, computed, type Ref } from 'vue';
import type { Excursion, ExcursionLeg, IdeaRole, LocationTrack, User } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useTracksStore } from '../stores/tracks';
import { useToast } from './useToast';
import { useDraftAutosave } from './useDraftAutosave';
import { isEmptyRichText } from '../utils/richText';

export interface ExcursionFormData {
  title: string;
  image_url: string;
  note: string;
  date: string;
  spot_ids: number[];
  role: IdeaRole | '';
  destination_spot_id: number | null;
  legs: ExcursionLeg[];
  track_ids: number[];
}

export function emptyExcursionForm(): ExcursionFormData {
  return {
    title: '',
    image_url: '',
    note: '',
    date: '',
    spot_ids: [] as number[],
    role: '' as IdeaRole | '',
    destination_spot_id: null as number | null,
    legs: [] as ExcursionLeg[],
    track_ids: [] as number[],
  };
}

export function tourPayload(form: ExcursionFormData) {
  return {
    title: form.title.trim(),
    image_url: form.image_url || undefined,
    note: form.note && !isEmptyRichText(form.note) ? form.note : undefined,
    note_format: 'html' as const,
    date: form.date || undefined,
    spot_ids: form.spot_ids,
    role: form.role ? form.role : null,
    destination_spot_id: form.destination_spot_id,
    legs: form.legs,
  };
}

export interface UseTourFormOptions {
  users: Ref<User[]>;
  tracksToShareOnSave: Ref<Set<number>>;
  onTrackPrivateWarning?: (track: LocationTrack, tourTitle: string) => void;
  excursionForGroupTitle?: (title: string) => Excursion | null;
}

export function useTourForm(options: UseTourFormOptions) {
  const { users, tracksToShareOnSave, onTrackPrivateWarning, excursionForGroupTitle } = options;

  const excursionsStore = useExcursionsStore();
  const tracksStore = useTracksStore();
  const { showToast } = useToast();

  const showExcursionForm = ref(false);
  const excursionForm = ref<ExcursionFormData>(emptyExcursionForm());

  const showExcursionTracksSection = ref(false);
  const showEditExcursionTracksSection = ref(false);
  const showExcursionSpotsSection = ref(false);
  const showEditExcursionSpotsSection = ref(false);

  const editingExcursion = ref<number | null>(null);
  const isExcursionUploadingAttachments = ref(false);
  const editExcursionForm = ref<ExcursionFormData>(emptyExcursionForm());

  const activeExcursionForm = computed(() =>
    editingExcursion.value !== null ? editExcursionForm.value : excursionForm.value
  );

  const excursionTitleTouched = ref(false);
  const showExcursionTitleError = computed(
    () => excursionTitleTouched.value && !activeExcursionForm.value.title.trim()
  );

  const isExcursionRoleInvalid = computed(() =>
    Boolean(activeExcursionForm.value.role && activeExcursionForm.value.spot_ids.length < 2)
  );

  const canSaveExcursion = computed(
    () =>
      !!activeExcursionForm.value.title.trim() &&
      !isExcursionRoleInvalid.value &&
      !isExcursionUploadingAttachments.value
  );

  const excursionSaveTooltip = computed(() => {
    if (isExcursionUploadingAttachments.value) return 'Dateianhänge werden noch hochgeladen…';
    if (!activeExcursionForm.value.title.trim())
      return 'Bitte gib zuerst einen Titel für die Tour ein';
    if (isExcursionRoleInvalid.value)
      return 'Für Anreise/Abreise/Weiterreise werden mindestens 2 Stationen benötigt';
    return undefined;
  });

  const newExcursionDraft = useDraftAutosave('excursions:new', excursionForm, showExcursionForm);
  const editExcursionDraft = useDraftAutosave(
    () => `excursions:edit:${editingExcursion.value}`,
    editExcursionForm,
    computed(() => editingExcursion.value !== null)
  );

  const initialEditingExcursion = computed(() => {
    if (editingExcursion.value == null) return null;
    return excursionsStore.excursions.find((e) => e.id === editingExcursion.value) ?? null;
  });

  const isEditTourTitleModified = computed(() => {
    if (!initialEditingExcursion.value) return false;
    return (
      (editExcursionForm.value.title || '').trim() !==
      (initialEditingExcursion.value.title || '').trim()
    );
  });

  const isEditTourDateModified = computed(() => {
    if (!initialEditingExcursion.value) return false;
    return (editExcursionForm.value.date || '') !== (initialEditingExcursion.value.date || '');
  });

  const isEditTourNoteModified = computed(() => {
    if (!initialEditingExcursion.value) return false;
    return (
      (editExcursionForm.value.note || '').trim() !==
      (initialEditingExcursion.value.note || '').trim()
    );
  });

  const isEditTourRoleModified = computed(() => {
    if (!initialEditingExcursion.value) return false;
    return (
      (editExcursionForm.value.role || '').trim() !==
      (initialEditingExcursion.value.role || '').trim()
    );
  });

  const isExcursionModalDirty = computed(() =>
    editingExcursion.value !== null
      ? editExcursionDraft.isDirty.value
      : newExcursionDraft.isDirty.value
  );

  const selectableTracksForTour = computed(() => {
    const currentExcursionId = editingExcursion.value;
    return tracksStore.tracks.filter(
      (t) => t.excursion_id == null || t.excursion_id === currentExcursionId
    );
  });

  function onToggleTourTrack(trk: LocationTrack) {
    const isAssigned = activeExcursionForm.value.track_ids.includes(trk.id);
    if (isAssigned) {
      activeExcursionForm.value.track_ids = activeExcursionForm.value.track_ids.filter(
        (id) => id !== trk.id
      );
      tracksToShareOnSave.value.delete(trk.id);
    } else {
      if (trk.visibility === 'private' && users.value.length > 1) {
        if (onTrackPrivateWarning) {
          onTrackPrivateWarning(trk, activeExcursionForm.value.title.trim() || 'Tour');
        }
      } else {
        activeExcursionForm.value.track_ids.push(trk.id);
      }
    }
  }

  function openExcursionForm() {
    excursionTitleTouched.value = false;
    excursionForm.value = emptyExcursionForm();
    showExcursionSpotsSection.value = false;
    showExcursionTracksSection.value = false;
    tracksToShareOnSave.value.clear();
    showExcursionForm.value = true;
  }

  function closeExcursionForm() {
    excursionTitleTouched.value = false;
    showExcursionForm.value = false;
    excursionForm.value = emptyExcursionForm();
    tracksToShareOnSave.value.clear();
    newExcursionDraft.clear();
  }

  function discardNewExcursionDraft() {
    excursionTitleTouched.value = false;
    excursionForm.value = emptyExcursionForm();
    showExcursionSpotsSection.value = false;
    showExcursionTracksSection.value = false;
    tracksToShareOnSave.value.clear();
    newExcursionDraft.clear();
    showToast({ message: 'Entwurf verworfen.', type: 'info' });
  }

  async function addExcursion() {
    if (!excursionForm.value.title.trim() || isExcursionRoleInvalid.value) {
      if (!excursionForm.value.title.trim()) excursionTitleTouched.value = true;
      return;
    }
    const created = await excursionsStore.create(tourPayload(excursionForm.value));
    for (const trackId of excursionForm.value.track_ids) {
      const shouldShare = tracksToShareOnSave.value.has(trackId);
      await tracksStore.update(trackId, {
        excursion_id: created.id,
        ...(shouldShare ? { visibility: 'shared' } : {}),
      });
    }
    tracksToShareOnSave.value.clear();
    closeExcursionForm();
  }

  function startEditExcursion(excursion: Excursion) {
    excursionTitleTouched.value = false;
    showEditExcursionSpotsSection.value = false;
    showEditExcursionTracksSection.value = false;
    tracksToShareOnSave.value.clear();
    editExcursionForm.value = {
      title: excursion.title,
      image_url: excursion.image_url ?? '',
      note: excursion.note ?? '',
      date: excursion.date ?? '',
      spot_ids: [...excursion.spot_ids],
      role: excursion.role ?? '',
      destination_spot_id: excursion.destination_spot_id ?? null,
      legs: excursion.legs ? excursion.legs.map((l) => ({ ...l })) : [],
      track_ids: tracksStore.tracks.filter((t) => t.excursion_id === excursion.id).map((t) => t.id),
    };
    editingExcursion.value = excursion.id;
  }

  async function submitEditExcursion() {
    if (
      editingExcursion.value == null ||
      isExcursionUploadingAttachments.value ||
      !editExcursionForm.value.title.trim() ||
      isExcursionRoleInvalid.value
    ) {
      if (!editExcursionForm.value.title.trim()) excursionTitleTouched.value = true;
      return;
    }
    const excId = editingExcursion.value;
    await excursionsStore.update(excId, tourPayload(editExcursionForm.value));
    const currentAssigned = tracksStore.tracks
      .filter((t) => t.excursion_id === excId)
      .map((t) => t.id);
    const nextAssigned = editExcursionForm.value.track_ids;

    for (const oldId of currentAssigned) {
      if (!nextAssigned.includes(oldId)) {
        await tracksStore.update(oldId, { excursion_id: null });
      }
    }
    for (const newId of nextAssigned) {
      if (!currentAssigned.includes(newId)) {
        const shouldShare = tracksToShareOnSave.value.has(newId);
        await tracksStore.update(newId, {
          excursion_id: excId,
          ...(shouldShare ? { visibility: 'shared' } : {}),
        });
      }
    }
    tracksToShareOnSave.value.clear();
    editExcursionDraft.clear();
    editingExcursion.value = null;
  }

  function closeEditExcursionForm() {
    excursionTitleTouched.value = false;
    tracksToShareOnSave.value.clear();
    editExcursionDraft.clear();
    editingExcursion.value = null;
  }

  function discardEditExcursionDraft() {
    if (!initialEditingExcursion.value) return;
    startEditExcursion(initialEditingExcursion.value);
    editExcursionDraft.clear();
    showToast({ message: 'Änderungen verworfen.', type: 'info' });
  }

  async function deleteEditingExcursion() {
    if (editingExcursion.value === null || isExcursionUploadingAttachments.value) return;
    const id = editingExcursion.value;
    const excursion = excursionsStore.excursions.find((e) => e.id === id);
    if (excursion?.date) {
      const confirmed = window.confirm(
        'Diese Tour ist bereits im Kalender eingeplant. Wirklich löschen? Die zugeordneten Spots bleiben erhalten und werden nicht mitgelöscht.'
      );
      if (!confirmed) return;
    }
    await excursionsStore.remove(id);
    closeEditExcursionForm();
  }

  async function toggleExcursionDestination(excursion: Excursion, spotId: number) {
    const newDest = excursion.destination_spot_id === spotId ? null : spotId;
    const payload = {
      trip_id: excursion.trip_id,
      title: excursion.title,
      image_url: excursion.image_url ?? undefined,
      note: excursion.note ?? undefined,
      note_format: 'html' as const,
      date: excursion.date ?? undefined,
      spot_ids: excursion.spot_ids,
      role: excursion.role ?? null,
      destination_spot_id: newDest,
      legs: excursion.legs,
    };
    await excursionsStore.update(excursion.id, payload);
  }

  async function addSpotToExcursion(excursionId: number, spotId: number) {
    const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
    if (!excursion || excursion.spot_ids.includes(spotId)) return;
    await excursionsStore.update(excursionId, {
      title: excursion.title,
      image_url: excursion.image_url ?? undefined,
      note: excursion.note ?? undefined,
      date: excursion.date ?? undefined,
      spot_ids: [...excursion.spot_ids, spotId],
    });
  }

  async function assignSpotToTourTitle(spotId: number, title: string) {
    const excursion = excursionForGroupTitle
      ? excursionForGroupTitle(title)
      : (excursionsStore.excursions.find((e) => e.title === title) ?? null);
    if (excursion) {
      if (!excursion.spot_ids.includes(spotId)) await addSpotToExcursion(excursion.id, spotId);
    } else {
      await excursionsStore.create({ title, spot_ids: [spotId] });
    }
  }

  return {
    showExcursionForm,
    excursionForm,
    showExcursionTracksSection,
    showEditExcursionTracksSection,
    showExcursionSpotsSection,
    showEditExcursionSpotsSection,
    editingExcursion,
    isExcursionUploadingAttachments,
    editExcursionForm,
    activeExcursionForm,
    excursionTitleTouched,
    showExcursionTitleError,
    isExcursionRoleInvalid,
    canSaveExcursion,
    excursionSaveTooltip,
    newExcursionDraft,
    editExcursionDraft,
    initialEditingExcursion,
    isEditTourTitleModified,
    isEditTourDateModified,
    isEditTourNoteModified,
    isEditTourRoleModified,
    isExcursionModalDirty,
    selectableTracksForTour,
    onToggleTourTrack,
    openExcursionForm,
    closeExcursionForm,
    discardNewExcursionDraft,
    addExcursion,
    startEditExcursion,
    submitEditExcursion,
    closeEditExcursionForm,
    discardEditExcursionDraft,
    deleteEditingExcursion,
    toggleExcursionDestination,
    addSpotToExcursion,
    assignSpotToTourTitle,
  };
}
