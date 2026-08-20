<script setup lang="ts">
// Ladezustand für den Moment zwischen "App gemountet" und "erster Urlaub/Echtzeit-Backfill fertig"
// (siehe App.vue: v-else-if="!tripStore.loaded || !liveSync.ready") - vorher stand hier nur ein
// leerer, unbeschrifteter Div mit demselben Hintergrund-Gradient wie LoginView.vue, wirkte dadurch
// wie ein Einfrieren der App (#149). Gleiche Bildsprache wie LoginView.vue (ReisotorRobot, gleicher
// Gradient) statt eines neuen Musters, gleicher Spinner-Stil wie ViewLoadingState.vue.
import ReisotorRobot from './ReisotorRobot.vue';
</script>

<template>
  <div class="splash" role="status" aria-live="polite">
    <ReisotorRobot size="140px" />
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
