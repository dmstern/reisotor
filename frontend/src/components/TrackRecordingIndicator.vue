<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTrackRecordingStore } from '../stores/trackRecording';

// Läuft eine Standort-Aufzeichnung (stores/trackRecording.ts), soll das app-weit sichtbar sein –
// nicht nur, solange TripMap.vue gerade gemountet ist (dort startet/stoppt man die Aufzeichnung,
// aber sie soll auch aus jeder anderen View heraus erkennbar, pausierbar UND beendbar bleiben).
// Gleiche Stelle im Header wie OfflineIndicator.vue (.status-row, AppHeader.vue). Zentraler Ort für
// Pause/Fortsetzen (statt z. B. auf der Karte) - Stromsparen bei einem längeren Aufenthalt an einem
// Ort soll unabhängig davon möglich sein, welche View gerade offen ist.
const trackRecording = useTrackRecordingStore();

const elapsedMs = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

function updateElapsed() {
  if (!trackRecording.track) return;
  elapsedMs.value = Date.now() - new Date(trackRecording.track.started_at).getTime();
}

function startTicking() {
  stopTicking();
  updateElapsed();
  timer = setInterval(updateElapsed, 1000);
}

function stopTicking() {
  if (timer != null) clearInterval(timer);
  timer = null;
}

// Tickt nur, solange tatsächlich aufgezeichnet wird - während einer Pause bleibt die Anzeige auf
// "Pausiert" stehen statt weiterzulaufen (elapsedMs friert dabei einfach ein). Ein späteres
// Fortsetzen lässt die Zahl bewusst auf den dann tatsächlich verstrichenen Gesamtwert springen
// (Startzeitpunkt bleibt derselbe, die Pausendauer zählt weiterhin mit - deckt sich mit der Dauer,
// die z. B. ExcursionsView.vue's Aufzeichnungen-Liste hinterher aus ended_at - started_at
// berechnet), keine separate "reine Aufzeichnungszeit ohne Pausen"-Zählung.
watch(
  () => [trackRecording.recording, trackRecording.paused] as const,
  ([recording, paused]) => {
    if (recording && !paused) startTicking();
    else stopTicking();
  },
  { immediate: true },
);

const elapsedLabel = computed(() => {
  const totalSeconds = Math.floor(elapsedMs.value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
});
</script>

<template>
  <div v-if="trackRecording.recording" class="recording-pill" :class="{ paused: trackRecording.paused }">
    <button
      type="button"
      class="recording-pill-btn"
      :title="trackRecording.paused ? 'Aufzeichnung fortsetzen' : 'Aufzeichnung pausieren (z. B. zum Stromsparen)'"
      :aria-label="trackRecording.paused ? 'Aufzeichnung fortsetzen' : 'Aufzeichnung pausieren'"
      @click="trackRecording.paused ? trackRecording.resume() : trackRecording.pause()"
    >
      {{ trackRecording.paused ? '▶️' : '⏸️' }}
    </button>
    <span class="recording-pill-label">{{ trackRecording.paused ? '⏸️ Pausiert' : `⏺️ ${elapsedLabel}` }}</span>
    <button
      type="button"
      class="recording-pill-btn"
      title="Aufzeichnung beenden"
      aria-label="Aufzeichnung beenden"
      @click="trackRecording.stop()"
    >
      ⏹️
    </button>
  </div>
</template>

<style scoped>
/* Gleiches Pillen-Muster wie OfflineIndicator.vue's .offline-pill - eigene Farbe statt
   --color-accent (dort app-weit für "Echtzeit-Update von jemand anderem" reserviert, siehe
   DESIGN.md) oder --color-primary (schon für "aktiv synchronisiert" genutzt), damit eine laufende
   Aufzeichnung als eigenständiger Zustand erkennbar bleibt. --color-danger passt inhaltlich
   ("Aufnahme läuft", wie eine Rec-Anzeige) und ist bereits eine bestehende, semantische Variable.
   Anders als die einzelnen <span>/<button>-Varianten dort ist dies ein Container mit ZWEI eigenen
   Buttons (Pause/Fortsetzen + Stop) statt eines einzelnen Klickziels. */
.recording-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-danger);
  padding: 2px 2px 2px 8px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Etwas gedämpfter während der Pause - macht den Zustand zusätzlich zum Text/Icon auf einen Blick
   erkennbar. */
.recording-pill.paused {
  background: color-mix(in srgb, var(--color-danger) 65%, var(--color-text-muted));
}

.recording-pill-label {
  font-variant-numeric: tabular-nums;
  padding: 2px 2px;
}

.recording-pill-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  corner-shape: round;
  color: #fff;
  font-size: 0.7rem;
  line-height: 1;
  cursor: pointer;
}

.recording-pill-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}
</style>
