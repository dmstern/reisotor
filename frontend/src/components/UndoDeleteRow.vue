<script setup lang="ts">
// Platzhalter, der für das 60s-Rückgängig-Fenster (useUndoableDelete.ts) genau an der Stelle steht,
// an der die gelöschte Karte/Zeile vorher war – für den Fall, dass jemand aus Versehen gelöscht hat.
defineProps<{ label?: string }>();
defineEmits<{ (e: 'undo'): void }>();
</script>

<template>
  <div class="undo-delete-row">
    <span class="undo-delete-text">🗑️ Gelöscht<template v-if="label"> · {{ label }}</template></span>
    <button type="button" class="card-action-btn" @click="$emit('undo')">Löschen rückgängig machen</button>
  </div>
</template>

<style scoped>
.undo-delete-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-hover);
}

.undo-delete-text {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
