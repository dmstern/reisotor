import { ref, computed, type Ref } from 'vue';
import type { LocationTrack, TrackVisibility, User, Excursion } from '../api/types';
import {
  formatDateTime,
  toLocalDatetimeInputValue,
  fromLocalDatetimeInputValue,
} from '../utils/dateFormat';
import { formatDurationShort } from '../utils/trackGeometry';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { TabBarItem } from '../components/TabBar.vue';
import type { TourItem } from '../components/TourAssignDropdown.vue';
import { useAuthStore } from '../stores/auth';
import { useTracksStore } from '../stores/tracks';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import { usePersistedRef } from './usePersistedRef';

export interface UseExcursionTracksOptions {
  users: Ref<User[]>;
  isSheetOverlayMode: Ref<boolean>;
  sheetState: Ref<'collapsed' | 'partial' | 'full'>;
  onShareTrackToTour?: (track: LocationTrack) => void;
}

export function useExcursionTracks(options: UseExcursionTracksOptions) {
  const { users, isSheetOverlayMode, sheetState, onShareTrackToTour } = options;

  const auth = useAuthStore();
  const tracksStore = useTracksStore();
  const trackRecording = useTrackRecordingStore();
  const excursionsStore = useExcursionsStore();
  const drawers = useDrawersStore();

  function trackTitle(track: LocationTrack): string {
    return track.title || `Aufzeichnung vom ${formatDateTime(track.started_at)}`;
  }

  function trackDurationLabel(track: LocationTrack): string {
    if (!track.ended_at) return '';
    const ms = new Date(track.ended_at).getTime() - new Date(track.started_at).getTime();
    return formatDurationShort(ms);
  }

  function trackAuthorUser(track: LocationTrack): User | undefined {
    if (track.user_id) {
      const u = users.value.find((u) => u.id === track.user_id);
      if (u) return u;
    }
    if (auth.user && auth.user.id === track.user_id) {
      return auth.user;
    }
    return undefined;
  }

  function trackAuthorAvatar(track: LocationTrack): string {
    const u = trackAuthorUser(track);
    return u?.avatar || track.author_avatar || '👤';
  }

  function trackAuthorName(track: LocationTrack): string {
    const u = trackAuthorUser(track);
    return u?.username || track.author_username || '';
  }

  function trackAuthorTitle(track: LocationTrack): string {
    const name = trackAuthorName(track);
    return name ? `Aufgezeichnet von ${name}` : 'Aufzeichnung';
  }

  function onTrackShowOnMap(trackId: number) {
    if (isSheetOverlayMode.value && sheetState.value === 'full') {
      sheetState.value = 'partial';
    }
    drawers.openMapForTrack(trackId);
  }

  const trackEditTabs = computed<TabBarItem[]>(() => [
    { key: 'general', label: 'Allgemein', icon: ACTION_ICONS.edit },
    {
      key: 'permissions',
      label: 'Berechtigungen',
      icon: ACTION_ICONS.shared,
      unseen: isEditTrackVisibilityModified.value,
    },
  ]);
  const activeTrackEditTab = ref<'general' | 'permissions'>('general');

  const editingTrack = ref<LocationTrack | null>(null);
  const editTrackTitle = ref('');
  const editTrackStartedAt = ref('');
  const editTrackVisibility = ref<TrackVisibility>('private');
  const editTrackExcursionId = ref<number | null>(null);

  const showTrackShareWarningModal = ref(false);
  const shareWarningTrackTitle = ref('');
  const shareWarningTourTitle = ref('');
  const pendingShareTrack = ref<LocationTrack | null>(null);
  const pendingTrackTourId = ref<number | null>(null);
  const tracksToShareOnSave = ref(new Set<number>());

  const trackTourAssignments = computed<TourItem[]>(() => {
    return excursionsStore.excursions.map((e) => ({
      id: e.id,
      title: e.title,
      assigned: editTrackExcursionId.value === e.id,
    }));
  });

  const editTrackExcursionTitle = computed(() => {
    if (editTrackExcursionId.value == null) return null;
    const exc = excursionsStore.excursions.find((e) => e.id === editTrackExcursionId.value);
    return exc?.title ?? null;
  });

  function onToggleTrackTour(tourId: number) {
    if (editTrackExcursionId.value === tourId) {
      editTrackExcursionId.value = null;
      return;
    }
    const tour = excursionsStore.excursions.find((e) => e.id === tourId);
    const isPrivate =
      editTrackVisibility.value === 'private' || editingTrack.value?.visibility === 'private';
    if (isPrivate && users.value.length > 1) {
      pendingTrackTourId.value = tourId;
      shareWarningTrackTitle.value =
        editTrackTitle.value.trim() ||
        (editingTrack.value ? trackTitle(editingTrack.value) : 'Aufzeichnung');
      shareWarningTourTitle.value = tour?.title || 'Tour';
      showTrackShareWarningModal.value = true;
    } else {
      editTrackExcursionId.value = tourId;
    }
  }

  async function onCreateTourFromTrack(title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newExcursion = await excursionsStore.create({
      title: trimmed,
    });
    onToggleTrackTour(newExcursion.id);
  }

  function onConfirmShareModal() {
    if (pendingTrackTourId.value != null) {
      editTrackExcursionId.value = pendingTrackTourId.value;
      editTrackVisibility.value = 'shared';
      pendingTrackTourId.value = null;
    } else if (pendingShareTrack.value != null) {
      if (onShareTrackToTour) {
        onShareTrackToTour(pendingShareTrack.value);
      }
      pendingShareTrack.value = null;
    }
    showTrackShareWarningModal.value = false;
  }

  function getTourForTrack(track: LocationTrack): Excursion | undefined {
    if (track.excursion_id == null) return undefined;
    return excursionsStore.excursions.find((e) => e.id === track.excursion_id);
  }

  const isEditTrackTitleModified = computed(() => {
    if (!editingTrack.value) return false;
    return editTrackTitle.value.trim() !== (editingTrack.value.title ?? '').trim();
  });
  const isEditTrackStartedAtModified = computed(() => {
    if (!editingTrack.value) return false;
    return editTrackStartedAt.value !== toLocalDatetimeInputValue(editingTrack.value.started_at);
  });
  const isEditTrackVisibilityModified = computed(() => {
    if (!editingTrack.value) return false;
    return editTrackVisibility.value !== editingTrack.value.visibility;
  });
  const isEditTrackTourModified = computed(() => {
    if (!editingTrack.value) return false;
    return editTrackExcursionId.value !== (editingTrack.value.excursion_id ?? null);
  });

  function startEditTrack(track: LocationTrack) {
    editingTrack.value = track;
    editTrackTitle.value = track.title ?? '';
    editTrackStartedAt.value = toLocalDatetimeInputValue(track.started_at);
    editTrackVisibility.value = track.visibility;
    editTrackExcursionId.value = track.excursion_id ?? null;
    activeTrackEditTab.value = 'general';
  }

  function closeEditTrack() {
    editingTrack.value = null;
    pendingTrackTourId.value = null;
    activeTrackEditTab.value = 'general';
  }

  async function submitEditTrack() {
    if (!editingTrack.value) return;
    const rawTitle = editTrackTitle.value.trim();
    const title = rawTitle ? rawTitle : null;
    const startedAt =
      fromLocalDatetimeInputValue(editTrackStartedAt.value) ?? editingTrack.value.started_at;
    await tracksStore.update(editingTrack.value.id, {
      title,
      started_at: startedAt,
      visibility: editTrackVisibility.value,
      excursion_id: editTrackExcursionId.value,
    });
    closeEditTrack();
  }

  async function stopEditingTrack() {
    if (!editingTrack.value) return;
    const id = editingTrack.value.id;
    if (trackRecording.recording && trackRecording.track?.id === id) {
      await trackRecording.stop();
    } else {
      await tracksStore.stopTrack(id);
    }
    const updated = tracksStore.tracks.find((t) => t.id === id);
    if (updated) {
      editingTrack.value = updated;
    }
  }

  async function deleteEditingTrack() {
    if (!editingTrack.value) return;
    const confirmed = window.confirm('Möchtest du diese Aufzeichnung wirklich löschen?');
    if (!confirmed) return;
    const id = editingTrack.value.id;
    closeEditTrack();
    await removeTrack(id);
  }

  async function removeTrack(id: number) {
    if (drawers.mapFocusTrackId === id) drawers.mapFocusTrackId = null;
    await tracksStore.remove(id);
  }

  // Track Recording Hinweis-Modal (#230)
  const showTrackRecordingWarningModal = ref(false);
  const trackWarningDismissed = usePersistedRef<boolean>(
    'reisotor-track-recording-warning-acknowledged',
    false
  );

  const hasActiveRecording = computed(() => {
    if (trackRecording.recording) return true;
    return tracksStore.tracks.some((t) => !t.ended_at && t.user_id === auth.user?.id);
  });

  async function onRecordButtonClick() {
    if (trackRecording.recording) {
      await trackRecording.stop();
    } else {
      const activeTrack = tracksStore.tracks.find(
        (t) => !t.ended_at && t.user_id === auth.user?.id
      );
      if (activeTrack) {
        await tracksStore.stopTrack(activeTrack.id);
      } else if (trackWarningDismissed.value) {
        trackRecording.start({ visibility: 'private' });
      } else {
        showTrackRecordingWarningModal.value = true;
      }
    }
  }

  function startRecordingConfirmed() {
    showTrackRecordingWarningModal.value = false;
    trackRecording.start({ visibility: 'private' });
  }

  async function stopTrackDirect(track: LocationTrack) {
    if (trackRecording.recording && trackRecording.track?.id === track.id) {
      await trackRecording.stop();
    } else {
      await tracksStore.stopTrack(track.id);
    }
  }

  return {
    trackTitle,
    trackDurationLabel,
    trackAuthorUser,
    trackAuthorAvatar,
    trackAuthorName,
    trackAuthorTitle,
    onTrackShowOnMap,
    trackEditTabs,
    activeTrackEditTab,
    editingTrack,
    editTrackTitle,
    editTrackStartedAt,
    editTrackVisibility,
    editTrackExcursionId,
    showTrackShareWarningModal,
    shareWarningTrackTitle,
    shareWarningTourTitle,
    pendingShareTrack,
    pendingTrackTourId,
    tracksToShareOnSave,
    trackTourAssignments,
    editTrackExcursionTitle,
    onToggleTrackTour,
    onCreateTourFromTrack,
    onConfirmShareModal,
    getTourForTrack,
    isEditTrackTitleModified,
    isEditTrackStartedAtModified,
    isEditTrackVisibilityModified,
    isEditTrackTourModified,
    startEditTrack,
    closeEditTrack,
    submitEditTrack,
    stopEditingTrack,
    deleteEditingTrack,
    removeTrack,
    showTrackRecordingWarningModal,
    hasActiveRecording,
    onRecordButtonClick,
    startRecordingConfirmed,
    stopTrackDirect,
  };
}
