<script setup lang="ts">
import Card from '../primitives/Card.vue';
import Button from '../primitives/Button.vue';
import AppIcon from '../AppIcon.vue';
import SettingsCardHeader from './SettingsCardHeader.vue';
import { useBackupExport } from '../../composables/useBackupExport';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { IconDatabase, IconDatabaseFilled } from '@tabler/icons-vue';
import type { IconDef } from '../../utils/icon';

const DATA_ICON: IconDef = {
  id: 'database',
  emoji: '🗄️',
  outline: IconDatabase,
  filled: IconDatabaseFilled,
};

const { exporting, exportError, exportBackup } = useBackupExport();
</script>

<template>
  <Card class="admin-card">
    <SettingsCardHeader title="Datensicherung" :icon="DATA_ICON" />
    <p class="hint">
      Vor einem Neu-Deployment mit neuen Features könnt ihr hier alle Daten (inklusive Datenbank und
      Datei-Anhängen) als ZIP-Datei sichern.
    </p>

    <div class="backup-actions">
      <Button variant="secondary" size="md" :loading="exporting" @click="exportBackup">
        <template v-if="exporting">Exportiere…</template>
        <template v-else>
          <AppIcon :icon="ACTION_ICONS.download" :size="16" group="actions" /> Backup exportieren
          (ZIP)
        </template>
      </Button>
    </div>

    <p v-if="exportError" class="hint error">{{ exportError }}</p>
    <p class="hint info-hint">
      <AppIcon :icon="ACTION_ICONS.info" :size="14" group="actions" /> Die Wiederherstellung
      (Import) erfolgt ab sofort manuell auf dem Server, um einen sicheren Austausch der Datenbank
      (data.sqlite) und der Uploads zu gewährleisten.
    </p>
  </Card>
</template>

<style scoped>
.admin-card {
  margin-bottom: var(--space-4);
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
}

.hint {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.hint:last-child {
  margin-bottom: 0;
}

.hint :deep(.app-icon) {
  vertical-align: -2.5px;
}

.hint.error {
  color: var(--color-danger);
}
</style>
