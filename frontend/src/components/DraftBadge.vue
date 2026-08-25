<script setup lang="ts">
// Markiert eine Notiz/einen Tagebucheintrag als Entwurf, der (anders als PendingSyncBadge.vue's
// Offline-Zustand) dauerhaft nur für die anlegende Person sichtbar bleibt, bis sie ihn veröffentlicht
// (#89) - gleiches 🔒-Konzept wie DESIGN.md's "Sichtbarkeits-Kennzeichnung" (ACTION_ICONS.private),
// keine neue Bedeutung für ein neues Icon erfinden.
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
</script>

<template>
  <span
    class="draft-badge"
    title="Entwurf – erst nach dem Veröffentlichen für andere Mitreisende sichtbar"
  >
    <AppIcon :icon="ACTION_ICONS.private" :size="12" group="actions" /> Entwurf – nur für dich
    sichtbar
  </span>
</template>

<style scoped>
/* Gleiche Pillen-Optik wie PendingSyncBadge.vue, andere Bedeutung (siehe DESIGN.md "Eine Bedeutung
   pro Farbe") - deshalb --color-text-muted/--color-hover statt --color-accent, das ist bereits für
   "Echtzeit-Update von jemand anderem" reserviert. */
.draft-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-hover);
  padding: 2px 9px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
