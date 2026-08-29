<script setup lang="ts">
// Markiert eine Notiz/einen Tagebucheintrag als Entwurf - nutzt das primitive Badge.vue.
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import Badge from './primitives/Badge.vue';
</script>

<template>
  <Badge
    variant="default"
    class="draft-badge"
    title="Entwurf – erst nach dem Veröffentlichen für andere Mitreisende sichtbar"
  >
    <AppIcon :icon="ACTION_ICONS.private" :size="12" group="actions" /> Entwurf – nur für dich
    sichtbar
  </Badge>
</template>

<style scoped>
.draft-badge {
  font-size: 0.72rem;
  flex-shrink: 0;
}
</style>
