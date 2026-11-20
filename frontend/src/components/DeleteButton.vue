<script setup lang="ts">
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
    variant="overlay"
    shape="circle"
    :icon="ACTION_ICONS.delete"
    size="sm"
    :disabled="disabled"
    :title="disabled ? 'Löschen hier nicht möglich – in der Ursprungssicht bearbeiten' : 'Löschen'"
    :aria-label="disabled ? 'Löschen nicht möglich' : 'Löschen'"
    @click.stop="$emit('click')"
  />
  <IconButton
    v-else
    :variant="small ? 'ghost' : 'secondary'"
    shape="squircle"
    class="delete-btn"
    :class="{ small }"
    :icon="ACTION_ICONS.delete"
    size="sm"
    :disabled="disabled"
    :title="disabled ? 'Löschen hier nicht möglich – in der Ursprungssicht bearbeiten' : 'Löschen'"
    :aria-label="disabled ? 'Löschen nicht möglich' : 'Löschen'"
    @click.stop="$emit('click')"
  />
</template>

<style scoped>
.delete-btn {
  flex-shrink: 0;
}

/* Schwebender runder Button oben rechts übers Vorschaubild – Gegenstück zu EditButton.floating
   (oben links). Positionierung erfolgt relativ zum nächsten `position: relative`-Elternelement. */
.delete-btn.floating {
  position: absolute;
  top: 8px;
  right: 8px;
}
</style>
