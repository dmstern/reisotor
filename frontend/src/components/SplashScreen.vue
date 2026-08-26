<script setup lang="ts">
// Ladezustand für den Moment zwischen "App gemountet" und "erster Urlaub/Echtzeit-Backfill fertig"
// (siehe App.vue: v-else-if="!tripStore.loaded || !liveSync.ready || !firstLoadDone") - vorher stand
// hier nur ein leerer, unbeschrifteter Div mit demselben Hintergrund-Gradient wie LoginView.vue,
// wirkte dadurch wie ein Einfrieren der App (#149). Gleiche Bildsprache wie LoginView.vue
// (ReisotorRobot, gleicher Gradient) statt eines neuen Musters, gleicher Spinner-Stil wie
// ViewLoadingState.vue.
import { onMounted, onUnmounted } from 'vue';
import ReisotorRobot from './ReisotorRobot.vue';

const props = withDefaults(
  defineProps<{
    /** Rucksack-packen-Animation einmal komplett durchlaufen lassen, bevor "ready" feuert (nur beim
     *  allerersten App-Start sinnvoll - App.vue reicht dafür false durch, sobald sie einmal gelaufen
     *  ist, damit ein Urlaubswechsel (derselbe Splash, siehe liveSync.ready oben) nicht jedes Mal
     *  erneut die 2s erzwingt). */
    playIntro?: boolean;
  }>(),
  { playIntro: true }
);

// App.vue soll die eigentliche UI erst zeigen, wenn die Rucksack-Animation fertig durchgelaufen ist
// (nicht nur, sobald die Daten da sind) - siehe ReisotorRobot.vue's packingDone-Emit, das exakt beim
// animationend der zeitlich letzten Teil-Animation feuert.
const emit = defineEmits<{ ready: [] }>();

let settled = false;
function finish() {
  if (settled) return;
  settled = true;
  emit('ready');
}

// Fallback, falls animationend aus irgendeinem Grund nie feuert (z. B. Tab im Hintergrund throttled
// requestAnimationFrame/Animationen in manchen Browsern) - ohne das bliebe die App sonst dauerhaft
// auf dem Splash hängen. Deutlich über der reell veranschlagten 2s-Animationsdauer, damit er im
// Normalfall nie zuschlägt.
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
onMounted(() => {
  // prefers-reduced-motion oder navigator.webdriver (E2E- / Scratch-Tests) direkt hier prüfen statt
  // uns nur auf ReisotorRobot.vue's CSS-Verkürzung (animation-duration: 0.01s) zu verlassen: ein
  // Browser feuert "animationend" für eine derart knappe Animation nicht immer zuverlässig (insbesondere
  // direkt nach einer Navigation, während das Dokument noch sein erstes Layout/Paint macht) - dann würde
  // JEDER Seitenaufruf den vollen Fallback-Timer unten abwarten müssen, statt sofort weiterzumachen.
  // In automatisierten E2E- und Scratch-Tests (navigator.webdriver ist true) wird die Animation ebenfalls
  // sofort beendet, damit Screenshots nicht auf dem Splash hängen bleiben.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isWebdriver = Boolean(navigator.webdriver);
  if (props.playIntro && !reducedMotion && !isWebdriver) {
    fallbackTimer = setTimeout(finish, 4000);
  } else {
    finish();
  }
});
onUnmounted(() => {
  if (fallbackTimer) clearTimeout(fallbackTimer);
});
</script>

<template>
  <div class="splash" role="status" aria-live="polite">
    <ReisotorRobot size="140px" :phase="playIntro ? 'packing' : 'idle'" @packing-done="finish" />
    <div class="loading">
      <span class="spinner" />
      <span class="text">Lädt…</span>
    </div>
  </div>
</template>

<style scoped>
.splash {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 60%);
}

.loading {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
