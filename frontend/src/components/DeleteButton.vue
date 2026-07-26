<script setup lang="ts">
defineProps<{ small?: boolean; disabled?: boolean; floating?: boolean }>();
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    type="button"
    class="secondary delete-btn"
    :class="{ small, floating }"
    :disabled="disabled"
    :title="disabled ? 'Löschen hier nicht möglich – in der Ursprungssicht bearbeiten' : 'Löschen'"
    :aria-label="disabled ? 'Löschen nicht möglich' : 'Löschen'"
    @click="$emit('click')"
  >
    🗑️
  </button>
</template>

<style scoped>
.delete-btn {
  padding: 6px 10px;
  font-size: 0.9rem;
  line-height: 1;
  flex-shrink: 0;
}

.delete-btn.small {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.delete-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Schwebender runder Button oben rechts übers Vorschaubild – Gegenstück zu EditButton.floating
   (oben links). Positionierung erfolgt relativ zum nächsten `position: relative`-Elternelement. */
.delete-btn.floating {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #2b2a28;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ohne eigenes Vorschaubild (Platzhalter-Fläche in --color-primary-tint, dunkel im Dark Mode)
   wirkt der immer-helle Kreis dort zu grell. Dunkler, halbtransparenter Kreis + heller Icon statt
   fest hell+dunkel – bleibt trotzdem über echten Fotos in beiden Modi gut lesbar. */
:root[data-theme='dark'] .delete-btn.floating {
  background: rgba(35, 34, 32, 0.85);
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .delete-btn.floating {
    background: rgba(35, 34, 32, 0.85);
    color: #f2efe9;
  }
}
</style>
