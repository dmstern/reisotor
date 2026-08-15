import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api, rawRequest } from '../api/client';
import { useTripStore } from './trip';
import { useTracksStore } from './tracks';
import type { LocationTrack, TrackVisibility } from '../api/types';

interface BufferedPoint {
  lat: number;
  lng: number;
  recorded_at: string;
  accuracy?: number;
}

const ACTIVE_KEY = 'reisotor-track-recording-active';
const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_POINT_THRESHOLD = 20;

function bufferKey(trackId: number): string {
  return `reisotor-track-buffer:${trackId}`;
}

function readBuffer(trackId: number): BufferedPoint[] {
  try {
    return JSON.parse(localStorage.getItem(bufferKey(trackId)) ?? '[]') as BufferedPoint[];
  } catch {
    return [];
  }
}

function writeBuffer(trackId: number, points: BufferedPoint[]) {
  localStorage.setItem(bufferKey(trackId), JSON.stringify(points));
}

function clearBuffer(trackId: number) {
  localStorage.removeItem(bufferKey(trackId));
}

interface ActiveState {
  trackId: number;
  tripId: number;
  startedAt: string;
}

function loadActiveState(): ActiveState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveState) : null;
  } catch {
    return null;
  }
}

function saveActiveState(state: ActiveState | null) {
  if (state) localStorage.setItem(ACTIVE_KEY, JSON.stringify(state));
  else localStorage.removeItem(ACTIVE_KEY);
}

// Standort-Aufzeichnung ("wo war ich wirklich?", stores/tracks.ts liefert die Liste vergangener
// Aufzeichnungen zum Anzeigen): läuft app-weit unabhängig davon, welche View gerade offen ist,
// exakt wie stores/locationSharing.ts (dort instanziiert, hier analog in App.vue). Startet nur bei
// bestehender Verbindung (POST /tracks braucht einen echten Server-id, siehe unten) - einmal
// gestartet, übersteht die Aufzeichnung selbst kurze Empfangslöcher (Wanderung ohne Netz) UND einen
// versehentlichen Reload, da sowohl der aktive Zustand als auch noch nicht gesendete Punkte in
// localStorage gespiegelt werden.
//
// Punkte-Puffer bewusst NICHT über den generischen Outbox-Mechanismus (api/offline.ts) - der ist
// ein einzelner, für alle Domänen gemeinsamer FIFO, der beim ersten Fehlschlag komplett stehen
// bleibt. Bei potenziell vielen GPS-Punkten (mehrstündige Wanderung) würde das mit ToDo-/Packlisten-
// Mutationen anderer Domänen verklemmen. Stattdessen ein eigener, periodisch geflushter Puffer nur
// für Track-Punkte.
export const useTrackRecordingStore = defineStore('trackRecording', () => {
  const tripStore = useTripStore();
  const tracksStore = useTracksStore();

  const track = ref<LocationTrack | null>(null);
  const recording = ref(false);
  const startError = ref<string | null>(null);

  let watchId: number | null = null;
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let pendingBuffer: BufferedPoint[] = [];

  function persistBuffer() {
    if (!track.value) return;
    writeBuffer(track.value.id, pendingBuffer);
  }

  async function flushBuffer() {
    if (!track.value || !pendingBuffer.length) return;
    const toSend = pendingBuffer;
    try {
      await rawRequest(`/tracks/${track.value.id}/points`, {
        method: 'POST',
        body: JSON.stringify({ points: toSend }),
      });
      // Nur die tatsächlich gesendeten Punkte entfernen - während des Requests können bereits neue
      // hinzugekommen sein (watchPosition läuft parallel weiter).
      pendingBuffer = pendingBuffer.slice(toSend.length);
      persistBuffer();
    } catch {
      // Bleibt im Puffer stehen, der nächste Tick versucht es erneut - kein Datenverlust bei einem
      // kurzzeitigen Empfangsloch.
    }
  }

  function startFlushLoop() {
    stopFlushLoop();
    flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
  }

  function stopFlushLoop() {
    if (flushTimer != null) clearInterval(flushTimer);
    flushTimer = null;
  }

  function startWatch() {
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        pendingBuffer.push({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          recorded_at: new Date().toISOString(),
          accuracy: position.coords.accuracy ?? undefined,
        });
        persistBuffer();
        if (pendingBuffer.length >= FLUSH_POINT_THRESHOLD) flushBuffer();
      },
      () => {
        // Zugriff verweigert/fehlgeschlagen - Aufzeichnung bleibt aktiv, der nächste erfolgreiche
        // Callback (z. B. nach Berechtigungs-Erteilung) sammelt einfach weiter.
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }

  function stopWatch() {
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  /** Startet eine neue Aufzeichnungs-Sitzung. Braucht eine bestehende Verbindung: POST /tracks
   *  müsste sonst über die generische Outbox mit einer negativen Platzhalter-id antworten (siehe
   *  api/offline.ts), auf die der dedizierte Punkte-Puffer hier nicht aufgebaut ist - eine bereits
   *  laufende Aufzeichnung übersteht dagegen kurze Empfangslöcher problemlos (siehe oben). */
  async function start(options: { visibility?: TrackVisibility; excursionId?: number | null }): Promise<boolean> {
    if (recording.value) return true;
    const tripId = tripStore.currentTripId;
    if (tripId == null) return false;
    startError.value = null;
    try {
      const created = await api.post<LocationTrack>('/tracks', {
        trip_id: tripId,
        visibility: options.visibility ?? 'private',
        excursion_id: options.excursionId ?? null,
      });
      if (created.id < 0) {
        // Offline (queueMutation() antwortet nie mit einem Fehler, siehe api/client.ts) - eine
        // Aufzeichnung braucht aber von Anfang an eine echte Server-id für den Punkte-Puffer.
        startError.value = 'Aufzeichnung braucht eine Verbindung zum Server, bitte später erneut versuchen.';
        return false;
      }
      track.value = created;
      recording.value = true;
      pendingBuffer = [];
      saveActiveState({ trackId: created.id, tripId, startedAt: created.started_at });
      startWatch();
      startFlushLoop();
      // stores/tracks.ts bekäme die neue Aufzeichnung sonst erst beim nächsten Trip-Wechsel/Reload
      // mit - eigene Mutationen lösen (anders als bei fremden) keinen liveSync-Refresh aus (siehe
      // stores/tracks.ts's domainVersion-Watch, der genau die eigene actor_user_id herausfiltert).
      tracksStore.load().catch(() => {});
      return true;
    } catch {
      startError.value = 'Aufzeichnung konnte nicht gestartet werden.';
      return false;
    }
  }

  async function stop() {
    if (!recording.value || !track.value) return;
    stopWatch();
    await flushBuffer();
    stopFlushLoop();
    try {
      await api.post(`/tracks/${track.value.id}/stop`);
    } catch {
      // Offline - der Stop-Zeitpunkt landet dann in der normalen Outbox (kleine Einzel-Mutation,
      // anders als die Punkte selbst unproblematisch dafür geeignet) und wird beim nächsten Sync
      // nachgeholt.
    }
    clearBuffer(track.value.id);
    saveActiveState(null);
    track.value = null;
    recording.value = false;
    pendingBuffer = [];
    // Aktualisiert u. a. den "🔴 läuft"-Status auf "⏱️ <Dauer>" in ExcursionsView.vue's
    // Aufzeichnungen-Liste (siehe Kommentar in start() oben).
    tracksStore.load().catch(() => {});
  }

  /** Stellt eine beim letzten Beenden der App noch laufende Aufzeichnung wieder her (Reload/App neu
   *  geöffnet, während eine Sitzung aktiv war) - inklusive noch nicht gesendeter Punkte. */
  function resume() {
    const state = loadActiveState();
    if (!state || state.tripId !== tripStore.currentTripId) return;
    pendingBuffer = readBuffer(state.trackId);
    track.value = {
      id: state.trackId,
      trip_id: state.tripId,
      user_id: -1,
      excursion_id: null,
      title: null,
      visibility: 'private',
      started_at: state.startedAt,
      ended_at: null,
    };
    recording.value = true;
    startWatch();
    startFlushLoop();
    // Echte Track-Metadaten (visibility/excursion_id/user_id) nachladen, damit UI-Zustände (z. B.
    // ein Sichtbarkeits-Badge) nach einem Reload korrekt sind, statt der obigen Platzhalterzeile.
    api
      .get<LocationTrack[]>(`/tracks?trip_id=${state.tripId}`)
      .then((tracks) => {
        const found = tracks.find((t) => t.id === state.trackId);
        if (found) track.value = found;
      })
      .catch(() => {});
  }

  watch(
    () => tripStore.currentTripId,
    (tripId, previousTripId) => {
      // Ein Urlaubswechsel während einer laufenden Aufzeichnung beendet sie NICHT automatisch (der
      // Track bleibt dem Urlaub zugeordnet, in dem er gestartet wurde) - resume() greift nur beim
      // initialen Laden (previousTripId noch undefined), nicht bei jedem Wechsel.
      if (previousTripId === undefined && tripId != null) resume();
    },
    { immediate: true },
  );

  return { track, recording, startError, start, stop };
});
