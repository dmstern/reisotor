<script setup lang="ts">
import type { DraftStatus } from '../composables/useDraftAutosave';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

withDefaults(
  defineProps<{
    status: DraftStatus;
    restored?: boolean;
    canDiscard?: boolean;
  }>(),
  {
    restored: false,
    canDiscard: false,
  }
);

const emit = defineEmits<{
  (e: 'discard'): void;
}>();
</script>

<template>
  <!-- Transparenz für den noch-nicht-gespeichert-Zustand (Nutzer-Feedback): status ist bewusst nie
       "gespeichert" im Sinne des eigentlichen Objekts - nur der Entwurf (localStorage + /drafts)
       ist gesichert, das eigentliche Speichern läuft weiterhin über den Submit-Button des Formulars. -->
  <div v-if="status !== 'idle'" class="draft-status" :class="status">
    <span class="draft-status-message">
      <template v-if="restored && status === 'saved'">
        <AppIcon :icon="FORM_FIELD_ICONS.note" :size="13" group="formFields" />
        <span>Entwurf wiederhergestellt – noch nicht gespeichert</span>
      </template>
      <template v-else-if="status === 'dirty'">
        <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
        <span>Noch nicht gespeichert – Entwurf wird gesichert…</span>
      </template>
      <template v-else-if="status === 'saved'">
        <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
        <span>Noch nicht gespeichert – Entwurf gesichert</span>
      </template>
      <template v-else-if="status === 'offline'">
        <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
        <span>Noch nicht gespeichert – Entwurf nur lokal gesichert (offline)</span>
      </template>
    </span>
    <button
      v-if="canDiscard"
      type="button"
      class="draft-discard-btn"
      title="Entwurf verwerfen"
      aria-label="Entwurf verwerfen"
      @click="emit('discard')"
    >
      <AppIcon :icon="ACTION_ICONS.delete" :size="12" group="actions" />
      <span>Entwurf verwerfen</span>
    </button>
  </div>
</template>

<style scoped>
.draft-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2, 8px);
  margin: 0;
  padding: 4px 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  /* In Flex-Row-Formularen (z. B. ShoppingListView.vue's .add-form) soll dieser Text nie eine
     Formularfeld-Zeile mitteilen bzw. von deren Höhe gestreckt werden - erzwingt stattdessen immer
     eine eigene volle Zeile. In Flex-Column-Formularen ist das ein No-op (dort schon von Natur aus
     zeilenfüllend). */
  flex-basis: 100%;
}

.draft-status-message {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.draft-discard-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  font-size: 0.75rem;
  font-family: inherit;
  font-weight: 500;
  color: var(--color-danger);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  cursor: pointer;
  line-height: 1.3;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
  user-select: none;
}

.draft-discard-btn:hover {
  background: var(--color-hover);
  border-color: var(--color-danger);
}

.draft-discard-btn:active {
  transform: scale(0.96);
}

.draft-discard-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
</style>
