<script setup lang="ts">
// Markiert ein einzelnes Objekt (nicht die ganze App wie OfflineIndicator.vue) als offline angelegt/
// bearbeitet und noch nicht mit dem Server synchronisiert - siehe api/offline.ts's Outbox +
// api/client.ts's queueMutation(), die genau dafür ein `_pending`-Flag auf die optimistische Antwort
// setzen. Gleiches Icon wie OfflineIndicator.vue's Offline-Pille, damit beide Anzeigen als
// dasselbe Konzept erkennbar bleiben.
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
</script>

<template>
  <span
    class="pending-sync-badge"
    title="Offline gespeichert – wird automatisch synchronisiert, sobald wieder eine Verbindung besteht"
  >
    <AppIcon :icon="ACTION_ICONS.offline" :size="12" group="actions" /> nur lokal gespeichert
  </span>
</template>

<style scoped>
/* Pille statt Squircle-Card (siehe DESIGN.md: Pillen/Chips/Badges bleiben beim normalen
   Kreisbogen-Radius) - dieselbe Optik wie OfflineIndicator.vue's .offline-pill, hier nur als
   Objekt-lokaler statt App-weiter Hinweis. */
.pending-sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-accent);
  padding: 2px 9px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
