<script setup lang="ts">
// Markiert ein einzelnes Objekt (nicht die ganze App wie OfflineIndicator.vue) als offline angelegt/
// bearbeitet und noch nicht mit dem Server synchronisiert - nutzt das primitive Badge.vue.
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import Badge from './primitives/Badge.vue';
</script>

<template>
  <Badge
    variant="accent"
    class="pending-sync-badge"
    title="Offline gespeichert – wird automatisch synchronisiert, sobald wieder eine Verbindung besteht"
  >
    <AppIcon :icon="ACTION_ICONS.offline" :size="12" group="actions" /> nur lokal gespeichert
  </Badge>
</template>

<style scoped>
.pending-sync-badge {
  font-size: 0.72rem;
  color: #fff;
  background: var(--color-accent);
  border-color: transparent;
  flex-shrink: 0;
}
</style>
