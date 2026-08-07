<script setup lang="ts">
import type { DraftStatus } from '../composables/useDraftAutosave';

defineProps<{ status: DraftStatus; restored?: boolean }>();
</script>

<template>
  <!-- Transparenz für den noch-nicht-gespeichert-Zustand (Nutzer-Feedback): status ist bewusst nie
       "gespeichert" im Sinne des eigentlichen Objekts - nur der Entwurf (localStorage + /drafts)
       ist gesichert, das eigentliche Speichern läuft weiterhin über den Submit-Button des Formulars. -->
  <p v-if="status !== 'idle'" class="draft-status" :class="status">
    <template v-if="restored && status === 'saved'">📝 Entwurf wiederhergestellt – noch nicht gespeichert</template>
    <template v-else-if="status === 'dirty'">✏️ Noch nicht gespeichert – Entwurf wird gesichert…</template>
    <template v-else-if="status === 'saved'">✏️ Noch nicht gespeichert – Entwurf gesichert</template>
    <template v-else-if="status === 'offline'">✏️ Noch nicht gespeichert – Entwurf nur lokal gesichert (offline)</template>
  </p>
</template>

<style scoped>
.draft-status {
  margin: 0;
  padding: 4px 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
</style>
