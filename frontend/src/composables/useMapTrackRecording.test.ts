// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMapTrackRecording } from './useMapTrackRecording';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useTracksStore } from '../stores/tracks';
import { useAuthStore } from '../stores/auth';
import { useDrawersStore } from '../stores/drawers';

describe('useMapTrackRecording', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('detects when track recording is active in store', () => {
    const trackRecording = useTrackRecordingStore();
    const recording = useMapTrackRecording();

    expect(recording.isMapRecordingActive.value).toBe(false);
    trackRecording.recording = true;
    expect(recording.isMapRecordingActive.value).toBe(true);
  });

  it('stops recording when toggleRecord is called while recording', async () => {
    const trackRecording = useTrackRecordingStore();
    trackRecording.recording = true;
    const stopSpy = vi.spyOn(trackRecording, 'stop').mockResolvedValue();

    const recording = useMapTrackRecording();
    await recording.toggleRecord();

    expect(stopSpy).toHaveBeenCalled();
  });

  it('stops unended user track when found', async () => {
    const tracksStore = useTracksStore();
    const auth = useAuthStore();
    auth.user = { id: 42, username: 'test', avatar: '🐱', is_admin: false };
    tracksStore.tracks = [
      {
        id: 10,
        trip_id: 1,
        user_id: 42,
        excursion_id: null,
        title: null,
        visibility: 'private',
        started_at: '2026-01-01T10:00:00Z',
        ended_at: null,
      },
    ];
    const stopTrackSpy = vi.spyOn(tracksStore, 'stopTrack').mockResolvedValue(undefined as never);

    const recording = useMapTrackRecording();
    expect(recording.isMapRecordingActive.value).toBe(true);

    await recording.toggleRecord();
    expect(stopTrackSpy).toHaveBeenCalledWith(10);
  });

  it('shows warning modal if warning is not dismissed', async () => {
    const recording = useMapTrackRecording();
    recording.trackWarningDismissed.value = false;

    await recording.toggleRecord();
    expect(recording.showTrackRecordingWarningModal.value).toBe(true);
  });

  it('starts recording directly if warning is dismissed', async () => {
    const trackRecording = useTrackRecordingStore();
    const drawers = useDrawersStore();
    drawers.mapFocusExcursionId = 99;
    const startSpy = vi.spyOn(trackRecording, 'start').mockResolvedValue({} as never);

    const recording = useMapTrackRecording();
    recording.trackWarningDismissed.value = true;

    await recording.toggleRecord();
    expect(startSpy).toHaveBeenCalledWith({ visibility: 'private', excursionId: 99 });
  });

  it('starts recording when startRecordingConfirmed is called', async () => {
    const trackRecording = useTrackRecordingStore();
    const drawers = useDrawersStore();
    drawers.mapFocusExcursionId = 77;
    const startSpy = vi.spyOn(trackRecording, 'start').mockResolvedValue({} as never);

    const recording = useMapTrackRecording();
    recording.showTrackRecordingWarningModal.value = true;

    await recording.startRecordingConfirmed();
    expect(recording.showTrackRecordingWarningModal.value).toBe(false);
    expect(startSpy).toHaveBeenCalledWith({ visibility: 'private', excursionId: 77 });
  });
});
