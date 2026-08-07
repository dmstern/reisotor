<script setup lang="ts">
// Platzhalter für den ersten Ladevorgang einer View (v-else zum jeweiligen `v-if="!loading"` der
// View) - vorher blieb die Seite bis zum ersten erfolgreichen (oder auf den Cache zurückgefallenen)
// Request komplett leer/weiß, was insbesondere bei einem hängenden Request (instabiles Netz, siehe
// REQUEST_TIMEOUT_MS in api/client.ts) wie ein Einfrieren der App wirkte. Bewusst eine eigene,
// einfache Komponente statt LoadingIndicator.vue (Header-Pill für laufende Requests jeder Art
// inkl. Hintergrund-Sync) - hier geht es gezielt um den "Seiteninhalt fehlt komplett noch"-Fall
// einer einzelnen View.
</script>

<template>
  <div class="view-loading" role="status" aria-live="polite">
    <span class="spinner" />
    <span class="text">Lädt…</span>
  </div>
</template>

<style scoped>
.view-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-muted);
}

.spinner {
  width: 28px;
  height: 28px;
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
