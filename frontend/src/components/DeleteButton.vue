<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ small?: boolean; disabled?: boolean; floating?: boolean }>();
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <!-- .stop hier statt an den Verwendungsstellen – siehe EditButton.vue für die Begründung
       (dort wäre der emittierte Payload undefined, .stop dort würde crashen). -->
  <IconButton
    v-if="floating"
    class="delete-btn floating"
    :icon="ACTION_ICONS.delete"
    size="sm"
    :disabled="disabled"
    :title="disabled ? 'Löschen hier nicht möglich – in der Ursprungssicht bearbeiten' : 'Löschen'"
    :aria-label="disabled ? 'Löschen nicht möglich' : 'Löschen'"
    @click.stop="$emit('click')"
  />
  <IconButton
    v-else-if="small"
    variant="ghost"
    class="delete-btn small"
    :icon="ACTION_ICONS.delete"
    size="sm"
    :disabled="disabled"
    :title="disabled ? 'Löschen hier nicht möglich – in der Ursprungssicht bearbeiten' : 'Löschen'"
    :aria-label="disabled ? 'Löschen nicht möglich' : 'Löschen'"
    @click.stop="$emit('click')"
  />
  <Button
    v-else
    variant="secondary"
    class="delete-btn"
    :disabled="disabled"
    :title="disabled ? 'Löschen hier nicht möglich – in der Ursprungssicht bearbeiten' : 'Löschen'"
    :aria-label="disabled ? 'Löschen nicht möglich' : 'Löschen'"
    @click.stop="$emit('click')"
  >
    <AppIcon :icon="ACTION_ICONS.delete" :size="15" group="actions" />
  </Button>
</template>

<style scoped>
.delete-btn {
  width: var(--input-height-sm, 38px);
  height: var(--input-height-sm, 38px);
  min-width: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.delete-btn.small {
  width: var(--input-height-sm, 38px);
  height: var(--input-height-sm, 38px);
  min-width: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  padding: 0;
  font-size: var(--font-size-sm);
}

.delete-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
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
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: 50%;
  /* Setzt das globale corner-shape:squircle (style.css) für diesen echten Kreis-Button zurück –
     siehe EditButton.vue's identischer Kommentar. */
  corner-shape: round;
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
