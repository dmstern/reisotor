<script setup lang="ts">
import type { DraftStatus } from '../composables/useDraftAutosave';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

withDefaults(
  defineProps<{
    status: DraftStatus;
    restored?: boolean;
    canDiscard?: boolean;
    mode?: 'create' | 'edit';
  }>(),
  {
    restored: false,
    canDiscard: false,
    mode: 'create',
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
      <template v-if="mode === 'edit'">
        <template v-if="restored && status === 'saved'">
          <AppIcon :icon="FORM_FIELD_ICONS.note" :size="14" group="formFields" />
          <span>Stand nach Unterbrechung wiederhergestellt – noch nicht gespeichert</span>
        </template>
        <template v-else-if="status === 'dirty'">
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span>Ungespeicherte Änderungen…</span>
        </template>
        <template v-else-if="status === 'saved'">
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span>Ungespeicherte Änderungen</span>
        </template>
        <template v-else-if="status === 'offline'">
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span>Ungespeicherte Änderungen (nur lokal gesichert)</span>
        </template>
      </template>
      <template v-else>
        <template v-if="restored && status === 'saved'">
          <AppIcon :icon="FORM_FIELD_ICONS.note" :size="14" group="formFields" />
          <span>Entwurf wiederhergestellt – noch nicht gespeichert</span>
        </template>
        <template v-else-if="status === 'dirty'">
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span>Noch nicht gespeichert – Entwurf wird gesichert…</span>
        </template>
        <template v-else-if="status === 'saved'">
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span>Noch nicht gespeichert – Entwurf gesichert</span>
        </template>
        <template v-else-if="status === 'offline'">
          <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
          <span>Noch nicht gespeichert – Entwurf nur lokal gesichert (offline)</span>
        </template>
      </template>
    </span>
    <Button
      v-if="canDiscard"
      type="button"
      variant="danger"
      secondary
      size="xs"
      shape="pill"
      :icon="ACTION_ICONS.delete"
      class="draft-discard-btn"
      :title="mode === 'edit' ? 'Änderungen verwerfen' : 'Entwurf verwerfen'"
      :aria-label="mode === 'edit' ? 'Änderungen verwerfen' : 'Entwurf verwerfen'"
      @click="emit('discard')"
    >
      <span>{{ mode === 'edit' ? 'Änderungen verwerfen' : 'Entwurf verwerfen' }}</span>
    </Button>
  </div>
</template>

<style lang="scss" scoped>
.draft-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin: 0;
  padding: var(--space-1-5) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  /* In Flex-Row-Formularen (z. B. ShoppingListView.vue's .add-form) soll dieser Text nie eine
     Formularfeld-Zeile mitteilen bzw. von deren Höhe gestreckt werden - erzwingt stattdessen immer
     eine eigene volle Zeile. In Flex-Column-Formularen ist das ein No-op (dort schon von Natur aus
     zeilenfüllend). */
  flex-basis: 100%;
  min-width: 0;
}

.draft-status-message {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1-5);
  min-width: 0;
}

.draft-status-message span {
  min-width: 0;
  word-break: break-word;
}
</style>
