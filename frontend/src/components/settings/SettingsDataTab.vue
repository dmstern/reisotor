<script setup lang="ts">
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import AppIcon from '../AppIcon.vue';
import { useAuthStore } from '../../stores/auth';
import { useBackupExport } from '../../composables/useBackupExport';
import { ACTION_ICONS } from '../../utils/actionIcons';

const auth = useAuthStore();
const { exporting, exportError, exportBackup } = useBackupExport();
</script>

<template>
  <div class="data-tab">
    <Card v-if="auth.user?.is_admin">
      <h2>Datensicherung</h2>
      <p>
        Vor einem Neu-Deployment mit neuen Features könnt ihr hier alle Daten (inklusive Datenbank
        und Datei-Anhängen) als ZIP-Datei sichern.
      </p>

      <div class="backup-actions">
        <Button variant="secondary" :disabled="exporting" @click="exportBackup">
          <template v-if="exporting">Exportiere…</template>
          <template v-else>
            <AppIcon :icon="ACTION_ICONS.download" :size="14" group="actions" /> Backup exportieren
            (ZIP)
          </template>
        </Button>
      </div>

      <p v-if="exportError" class="hint error">{{ exportError }}</p>
      <p class="hint">
        <AppIcon :icon="ACTION_ICONS.info" :size="14" group="actions" /> Die Wiederherstellung
        (Import) erfolgt ab sofort manuell auf dem Server, um einen sicheren Austausch der Datenbank
        (data.sqlite) und der Uploads zu gewährleisten.
      </p>
    </Card>
  </div>
</template>

<style scoped>
.data-tab :deep(.card) {
  margin-bottom: var(--space-4);
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-2) 0;
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
}

.hint.error {
  color: var(--color-danger);
}
</style>
