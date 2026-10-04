import { computed, ref } from 'vue';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useTracksStore } from '../stores/tracks';
import { useAuthStore } from '../stores/auth';
import { useDrawersStore } from '../stores/drawers';
import { usePersistedRef } from './usePersistedRef';

export function useMapTrackRecording() {
  const trackRecording = useTrackRecordingStore();
  const tracksStore = useTracksStore();
  const auth = useAuthStore();
  const drawers = useDrawersStore();

  const showTrackRecordingWarningModal = ref(false);
  const trackWarningDismissed = usePersistedRef<boolean>(
    'reisotor-track-recording-warning-acknowledged',
    false
  );

  const isMapRecordingActive = computed(() => {
    if (trackRecording.recording) return true;
    return tracksStore.tracks.some((t) => !t.ended_at && t.user_id === auth.user?.id);
  });

  async function toggleRecord() {
    if (trackRecording.recording) {
      await trackRecording.stop();
      return;
    }
    const unended = tracksStore.tracks.find((t) => !t.ended_at && t.user_id === auth.user?.id);
    if (unended) {
      await tracksStore.stopTrack(unended.id);
      return;
    }
    if (trackWarningDismissed.value) {
      await trackRecording.start({
        visibility: 'private',
        excursionId: drawers.mapFocusExcursionId,
      });
    } else {
      showTrackRecordingWarningModal.value = true;
    }
  }

  async function startRecordingConfirmed() {
    showTrackRecordingWarningModal.value = false;
    await trackRecording.start({
      visibility: 'private',
      excursionId: drawers.mapFocusExcursionId,
    });
  }

  return {
    trackRecording,
    showTrackRecordingWarningModal,
    trackWarningDismissed,
    isMapRecordingActive,
    toggleRecord,
    startRecordingConfirmed,
  };
}
