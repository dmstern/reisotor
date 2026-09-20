<script setup lang="ts">
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

// CheckableListItem.vue: Wiederverwendbare Primitive für abhakbare Zeilen (ToDo, Einkaufsliste, Packliste).
// Kapselt Zeilen-Layout, Trennlinien, Done-Status (Transparenz & Strikethrough), Aktionen und Echtzeit-Highlighting.
withDefaults(
  defineProps<{
    /** Ob das Listenelement als erledigt markiert ist */
    done?: boolean;
    /** Ob das Element durch Echtzeit-Sync neu hervorgehoben werden soll */
    highlighted?: boolean;
    /** Ob das Element durch Kalender-/Hash-Sprung fokussiert ist (Brand-Farbe) */
    focused?: boolean;
    /** HTML-Tag für das Container-Element (Standard: 'li') */
    tag?: string;
  }>(),
  {
    done: false,
    highlighted: false,
    focused: false,
    tag: 'li',
  }
);
</script>

<template>
  <component
    :is="tag"
    class="checkable-list-item row"
    :class="{
      'checkable-list-item--done': done,
      'row--done': done,
      'row-done': done,
      'checkable-list-item--highlighted': highlighted,
      'row--highlighted': highlighted,
      'new-highlight': highlighted,
      'checkable-list-item--focused': focused,
      'row--focused': focused,
      'is-focused': focused,
    }"
  >
    <slot />
    <!-- Sparkle-Badge für LiveSync-Updates von anderen Nutzern -->
    <span
      v-if="highlighted"
      class="list-item-sparkle"
      title="Neu von Mitreisenden hinzugefügt oder geändert"
      aria-label="Neu aktualisiert"
    >
      <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
    </span>
    <div v-if="$slots.actions" class="checkable-list-item__actions row-actions">
      <slot name="actions" />
    </div>
  </component>
</template>

<style scoped>
.checkable-list-item,
.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 9px var(--space-2);
  border-bottom: 1px solid var(--color-border);
  min-width: 0;
}

.checkable-list-item:last-child,
.row:last-child {
  border-bottom: none;
}

.checkable-list-item--done,
.row--done,
.row-done {
  opacity: 0.6;
}

/* Zeilen selbst haben keinen eigenen Radius - die globale .new-highlight-Regel
   würde hier sonst mit Karten-Radius wirken. Kleinerer, zur schmalen Zeile passender Wert. */
.checkable-list-item--highlighted,
.row--highlighted,
.row.new-highlight {
  --new-highlight-radius: var(--radius-sm-squircle);
  position: relative;
  border-radius: var(--new-highlight-radius);
  corner-shape: squircle;
}

.checkable-list-item--highlighted::after,
.row--highlighted::after,
.row.new-highlight::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  border-radius: var(--new-highlight-radius);
  corner-shape: squircle;
  box-shadow:
    inset 0 0 0 2px var(--color-success),
    0 4px 16px -2px color-mix(in srgb, var(--color-success) 32%, transparent),
    0 2px 6px -1px color-mix(in srgb, var(--color-success) 20%, transparent);
  animation: rowNewHighlightPulse 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Glanz-Animation für LiveSync-Updates, die sanft von links nach rechts drüberwischt */
.checkable-list-item--highlighted::before,
.row--highlighted::before,
.row.new-highlight::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--new-highlight-radius);
  corner-shape: squircle;
  pointer-events: none;
  z-index: 2;
  background: linear-gradient(
    110deg,
    transparent 35%,
    color-mix(in srgb, var(--color-success) 22%, rgba(255, 255, 255, 0.45)) 48%,
    color-mix(in srgb, var(--color-success) 45%, #ffffff) 50%,
    color-mix(in srgb, var(--color-success) 22%, rgba(255, 255, 255, 0.45)) 52%,
    transparent 65%
  );
  background-size: 260% 100%;
  background-repeat: no-repeat;
  animation: rowGlanceSweep 3.4s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

@keyframes rowGlanceSweep {
  0% {
    background-position: 130% 0;
  }
  35% {
    background-position: -30% 0;
  }
  100% {
    background-position: -30% 0;
  }
}

/* Sparkle-Badge für LiveSync-Updates in Listenzeilen */
.list-item-sparkle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-success) 14%, var(--color-surface));
  border: 1px solid var(--color-success);
  color: var(--color-success);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--color-success) 30%, transparent);
  flex-shrink: 0;
  margin-left: auto;
  margin-right: var(--space-1);
  align-self: center;
  pointer-events: none;
  z-index: 3;
  animation: sparkleTwinkle 3.4s cubic-bezier(0.25, 1, 0.5, 1) infinite;
}

@keyframes sparkleTwinkle {
  0% {
    transform: scale(1) rotate(0deg);
  }
  15% {
    transform: scale(1.18) rotate(14deg);
  }
  30% {
    transform: scale(1) rotate(0deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes rowNewHighlightPulse {
  0% {
    box-shadow:
      inset 0 0 0 0px var(--color-success),
      0 0 0 0 transparent;
  }
  50% {
    box-shadow:
      inset 0 0 0 3.5px var(--color-success),
      0 0 20px 3px color-mix(in srgb, var(--color-success) 45%, transparent);
  }
  100% {
    box-shadow:
      inset 0 0 0 2px var(--color-success),
      0 4px 16px -2px color-mix(in srgb, var(--color-success) 32%, transparent),
      0 2px 6px -1px color-mix(in srgb, var(--color-success) 20%, transparent);
  }
}

.checkable-list-item--focused,
.row--focused,
.row.is-focused {
  --focus-radius: var(--radius-sm-squircle);
  position: relative;
  z-index: 2;
  border-radius: var(--focus-radius);
  corner-shape: squircle;
}

.checkable-list-item--focused::after,
.row--focused::after,
.row.is-focused::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border-radius: var(--focus-radius);
  corner-shape: squircle;
  box-shadow:
    inset 0 0 0 2px var(--color-primary),
    0 4px 16px -2px color-mix(in srgb, var(--color-primary) 32%, transparent),
    0 2px 6px -1px color-mix(in srgb, var(--color-primary) 20%, transparent);
  animation: rowFocusPulse 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes rowFocusPulse {
  0% {
    box-shadow:
      inset 0 0 0 0px var(--color-primary),
      0 0 0 0 transparent;
  }
  50% {
    box-shadow:
      inset 0 0 0 3.5px var(--color-primary),
      0 0 20px 3px color-mix(in srgb, var(--color-primary) 45%, transparent);
  }
  100% {
    box-shadow:
      inset 0 0 0 2px var(--color-primary),
      0 4px 16px -2px color-mix(in srgb, var(--color-primary) 32%, transparent),
      0 2px 6px -1px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .checkable-list-item--highlighted::after,
  .row--highlighted::after,
  .row.new-highlight::after,
  .checkable-list-item--highlighted::before,
  .row--highlighted::before,
  .row.new-highlight::before,
  .list-item-sparkle,
  .checkable-list-item--focused::after,
  .row--focused::after,
  .row.is-focused::after {
    animation: none;
  }
}

:deep(.checkable-list-item__text--done),
:deep(.row__text--done),
:deep(.text-done) {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.checkable-list-item__actions,
:deep(.row-actions) {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: auto;
  align-self: flex-start;
}
</style>
