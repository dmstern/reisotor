<script setup lang="ts">
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

withDefaults(
  defineProps<{
    small?: boolean;
    floating?: boolean;
    size?: 'xs' | 'sm' | 'md';
    title?: string;
    ariaLabel?: string;
    icon?: IconDef;
    shape?: 'squircle' | 'circle';
    variant?: 'ghost' | 'secondary' | 'tonal' | 'danger' | 'primary' | 'overlay';
  }>(),
  {
    icon: () => ACTION_ICONS.edit,
  }
);
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <!-- .stop hier (statt an den Verwendungsstellen mit @click.stop="handler"): dort wäre der
       emittierte Payload undefined (click hat keine Nutzlast), Vues .stop-Modifier ruft aber
       stopPropagation() auf genau diesem Payload auf – würde also crashen. Hier ist $event der
       echte native Klick, .stop ist deshalb sicher und schützt jede Karte, die diesen Button in
       einen jetzt klickbaren Card-Root einbettet (z. B. ExcursionCard.vue). -->
  <IconButton
    v-if="floating"
    class="edit-btn floating"
    :icon="icon"
    :size="size ?? 'sm'"
    :shape="shape ?? 'circle'"
    :variant="variant ?? 'overlay'"
    :title="title ?? 'Bearbeiten'"
    :aria-label="ariaLabel ?? title ?? 'Bearbeiten'"
    @click.stop="$emit('click')"
  />
  <IconButton
    v-else
    :variant="variant ?? (small || size ? 'ghost' : 'secondary')"
    :shape="shape ?? 'squircle'"
    class="edit-btn"
    :class="{ small: small || size === 'sm' }"
    :icon="icon"
    :size="size ?? 'sm'"
    :title="title ?? 'Bearbeiten'"
    :aria-label="ariaLabel ?? title ?? 'Bearbeiten'"
    @click.stop="$emit('click')"
  />
</template>

<style lang="scss" scoped>
.edit-btn {
  flex-shrink: 0;
}

/* Schwebender runder Button, z. B. über einem Vorschaubild – Positionierung
   erfolgt relativ zum nächsten `position: relative`-Elternelement. */
.edit-btn.floating {
  position: absolute;
  top: 8px;
  left: 8px;
}
</style>
