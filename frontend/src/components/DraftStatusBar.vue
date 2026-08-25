<script setup lang="ts">
import type { DraftStatus } from '../composables/useDraftAutosave';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ status: DraftStatus; restored?: boolean }>();
</script>

<template>
  <!-- Transparenz für den noch-nicht-gespeichert-Zustand (Nutzer-Feedback): status ist bewusst nie
       "gespeichert" im Sinne des eigentlichen Objekts - nur der Entwurf (localStorage + /drafts)
       ist gesichert, das eigentliche Speichern läuft weiterhin über den Submit-Button des Formulars. -->
  <p v-if="status !== 'idle'" class="draft-status" :class="status">
    <template v-if="restored && status === 'saved'"
      ><AppIcon :icon="FORM_FIELD_ICONS.note" :size="13" group="formFields" /> Entwurf
      wiederhergestellt – noch nicht gespeichert</template
    >
    <template v-else-if="status === 'dirty'"
      ><AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" /> Noch nicht gespeichert –
      Entwurf wird gesichert…</template
    >
    <template v-else-if="status === 'saved'"
      ><AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" /> Noch nicht gespeichert –
      Entwurf gesichert</template
    >
    <template v-else-if="status === 'offline'"
      ><AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" /> Noch nicht gespeichert –
      Entwurf nur lokal gesichert (offline)</template
    >
  </p>
</template>

<style scoped>
.draft-status {
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
</style>
