<script setup lang="ts">
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
  box-shadow: inset 0 0 0 2px var(--color-success);
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
  box-shadow: inset 0 0 0 2px var(--color-primary);
  animation: rowFocusPulse 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes rowFocusPulse {
  0% {
    box-shadow:
      inset 0 0 0 3.5px var(--color-primary),
      0 0 16px 2px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }
  100% {
    box-shadow: inset 0 0 0 2px var(--color-primary);
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
