<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useTrackRecordingStore } from '../stores/trackRecording';

// Läuft eine Standort-Aufzeichnung (stores/trackRecording.ts), soll das app-weit sichtbar sein –
// nicht nur, solange TripMap.vue gerade gemountet ist (dort startet/stoppt man die Aufzeichnung,
// aber sie soll auch aus jeder anderen View heraus erkennbar UND beendbar bleiben). Gleiche Stelle
// im Header wie OfflineIndicator.vue (.status-row, AppHeader.vue).
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

watch(
  () => trackRecording.recording,
  (recording) => {
    if (recording) startTicking();
    else stopTicking();
  },
  { immediate: true },
);

onMounted(() => {
  if (trackRecording.recording) startTicking();
});
onUnmounted(stopTicking);

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
  <button
    v-if="trackRecording.recording"
    type="button"
    class="recording-pill"
    title="Standort-Aufzeichnung läuft – antippen zum Beenden"
    @click="trackRecording.stop()"
  >
    ⏺️ {{ elapsedLabel }} ⏹️
  </button>
</template>

<style scoped>
/* Gleiches Pillen-/Button-Muster wie OfflineIndicator.vue's .offline-pill - eigene Farbe statt
   --color-accent (dort app-weit für "Echtzeit-Update von jemand anderem" reserviert, siehe
   DESIGN.md) oder --color-primary (schon für "aktiv synchronisiert" genutzt), damit eine laufende
   Aufzeichnung als eigenständiger Zustand erkennbar bleibt. --color-danger passt inhaltlich
   ("Aufnahme läuft", wie eine Rec-Anzeige) und ist bereits eine bestehende, semantische Variable. */
.recording-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--color-danger);
  border: none;
  font: inherit;
  padding: 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
}
</style>
