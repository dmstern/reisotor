<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

withDefaults(
  defineProps<{
    small?: boolean;
    floating?: boolean;
    title?: string;
    ariaLabel?: string;
    icon?: IconDef;
    shape?: 'squircle' | 'circle';
    variant?: 'ghost' | 'secondary' | 'danger' | 'primary' | 'card-action' | 'floating';
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
    size="sm"
    :shape="shape ?? 'circle'"
    :variant="variant"
    :title="title ?? 'Bearbeiten'"
    :aria-label="ariaLabel ?? title ?? 'Bearbeiten'"
    @click.stop="$emit('click')"
  />
  <IconButton
    v-else-if="small"
    :variant="variant ?? 'ghost'"
    :shape="shape ?? 'squircle'"
    class="edit-btn small"
    :icon="icon"
    size="sm"
    :title="title ?? 'Bearbeiten'"
    :aria-label="ariaLabel ?? title ?? 'Bearbeiten'"
    @click.stop="$emit('click')"
  />
  <Button
    v-else
    :variant="variant ?? 'secondary'"
    :shape="shape ?? 'squircle'"
    class="edit-btn"
    :title="title ?? 'Bearbeiten'"
    :aria-label="ariaLabel ?? title ?? 'Bearbeiten'"
    @click.stop="$emit('click')"
  >
    <AppIcon :icon="icon" :size="15" group="actions" />
  </Button>
</template>

<style scoped>
.edit-btn {
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

.edit-btn.small {
  width: var(--input-height-sm, 38px);
  height: var(--input-height-sm, 38px);
  min-width: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  padding: 0;
  font-size: var(--font-size-sm);
}

.edit-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

/* Schwebender runder Button, z. B. über einem Vorschaubild – Positionierung
   erfolgt relativ zum nächsten `position: relative`-Elternelement. Hintergrund bleibt
   bewusst immer hell (auch im Dark Mode, das Bild darunter ist theme-unabhängig) –
   die Icon-Farbe ist deshalb fest dunkel statt an --color-text gekoppelt, sonst wird
   sie im Dark Mode hell auf hell und damit unsichtbar. */
.edit-btn.floating {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: var(--radius-pill);
  /* Setzt das globale corner-shape:squircle (style.css, gilt für <button> generell) für diesen
     echten Kreis-Button zurück – mit corner-shape:round bleibt der Button bei --radius-pill
     und 1:1-Seitenverhältnis ein perfekt runder Kreis ohne Blob-Verzerrung. */
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
:root[data-theme='dark'] .edit-btn.floating {
  background: rgba(35, 34, 32, 0.85);
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .edit-btn.floating {
    background: rgba(35, 34, 32, 0.85);
    color: #f2efe9;
  }
}
</style>
