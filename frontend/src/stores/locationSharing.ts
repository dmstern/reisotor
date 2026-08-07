import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';

export type ShareDuration = 'off' | 'day' | 'week' | 'forever';

// setTimeout()s Maximalverzögerung liegt bei ca. 24,8 Tagen (32-Bit-Signed-Int-Millisekunden) -
// reicht für "1 Tag", aber nicht für "1 Woche"/"dauerhaft". Statt eines einzelnen zu großen
// Timeouts wird in handhabbaren Schritten neu geplant.
const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;

// Standort-Freigabe unabhängig von der Kartenansicht (Nutzer-Feedback: bisher sah man andere
// Mitglieder nur, solange diese selbst gerade TripMap.vue geöffnet hatten). Läuft app-weit,
// solange die PWA/der Tab irgendwo offen ist (instanziiert in App.vue, analog zu liveSync.ts) -
// echtes Tracking bei vollständig geschlossener App/im Hintergrund ist mit Standard-Web-Technologie
// nicht erreichbar (kein navigator.geolocation-Zugriff aus einem Service Worker oder nach
// Schließen der App, insbesondere iOS Safari/PWA). Das hier ist das erreichbare Maximum: einmal
// gewählt, übersteht die Freigabe App-Neustarts (serverseitig als Ablaufzeitpunkt persistiert,
// siehe routes/realtime.ts) und sendet unabhängig davon, welche Ansicht gerade sichtbar ist -
// nicht mehr nur, solange TripMap.vue selbst gemountet ist.
export const useLocationSharingStore = defineStore('locationSharing', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();

  const shareUntil = ref<string | null>(null);
  const active = ref(false);

  let watchId: number | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  function clearExpiryTimer() {
    if (expiryTimer != null) clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  function stopWatch() {
    if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    active.value = false;
  }

  function startWatch() {
    if (watchId != null || !navigator.geolocation) return;
    active.value = true;
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        liveSync.sendPosition(position.coords.latitude, position.coords.longitude);
      },
      () => {
        // Zugriff verweigert/fehlgeschlagen - Freigabe bleibt serverseitig gesetzt (nächster
        // erfolgreicher watchPosition()-Callback, z. B. nach Berechtigungs-Erteilung, greift dann
        // automatisch wieder), nur ohne aktuelle Positions-Updates in der Zwischenzeit.
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }

  function scheduleExpiry() {
    clearExpiryTimer();
    if (!shareUntil.value) return;
    const remainingMs = new Date(shareUntil.value).getTime() - Date.now();
    if (remainingMs <= 0) {
      stopWatch();
      return;
    }
    expiryTimer = setTimeout(scheduleExpiry, Math.min(remainingMs, MAX_TIMEOUT_MS));
  }

  async function load(tripId: number | null) {
    stopWatch();
    clearExpiryTimer();
    shareUntil.value = null;
    if (tripId == null) return;
    try {
      const res = await api.get<{ location_share_until: string | null }>(
        `/realtime/location-share?trip_id=${tripId}`,
      );
      shareUntil.value = res.location_share_until;
    } catch {
      return;
    }
    if (shareUntil.value && new Date(shareUntil.value).getTime() > Date.now()) {
      startWatch();
      scheduleExpiry();
    }
  }

  async function setDuration(duration: ShareDuration) {
    const tripId = tripStore.currentTripId;
    if (tripId == null) return;
    const res = await api.put<{ location_share_until: string | null }>('/realtime/location-share', {
      trip_id: tripId,
      duration,
    });
    shareUntil.value = res.location_share_until;
    clearExpiryTimer();
    if (shareUntil.value) {
      startWatch();
      scheduleExpiry();
    } else {
      stopWatch();
      liveSync.stopSharingPosition();
    }
  }

  watch(() => tripStore.currentTripId, load, { immediate: true });

  return { shareUntil, active, setDuration };
});
