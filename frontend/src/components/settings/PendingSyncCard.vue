<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Card from '../primitives/Card.vue';
import Badge from '../primitives/Badge.vue';
import Button from '../primitives/Button.vue';
import IconButton from '../primitives/IconButton.vue';
import Alert from '../primitives/Alert.vue';
import Modal from '../Modal.vue';
import Input from '../primitives/Input.vue';
import Textarea from '../primitives/Textarea.vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import {
  getOutbox,
  removeOutboxEntry,
  clearOutbox,
  updateOutboxEntry,
  remapOutboxTempId,
  type OutboxEntry,
} from '../../api/offline';
import { rawRequest } from '../../api/client';
import { useConnectivityStore } from '../../stores/connectivity';
import { useLiveSyncStore } from '../../stores/liveSync';
import { useToast } from '../../composables/useToast';
import { migrateLocalData } from '../../utils/localMigrations';

const connectivity = useConnectivityStore();
const { showToast } = useToast();

const outboxEntries = ref<OutboxEntry[]>([]);
const expandedEntryIds = ref<Set<string>>(new Set());
const singleSyncingId = ref<string | null>(null);
const migrating = ref(false);

// Edit Modal State
const editingEntry = ref<OutboxEntry | null>(null);
const editPath = ref('');
const editBodyJson = ref('');
const editJsonError = ref<string | null>(null);

function refreshOutbox() {
  outboxEntries.value = getOutbox();
}

onMounted(() => {
  refreshOutbox();
  if (typeof window !== 'undefined') {
    window.addEventListener('reisotor:outbox-changed', refreshOutbox);
    window.addEventListener('storage', refreshOutbox);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('reisotor:outbox-changed', refreshOutbox);
    window.removeEventListener('storage', refreshOutbox);
  }
});

function toggleExpand(id: string) {
  if (expandedEntryIds.value.has(id)) {
    expandedEntryIds.value.delete(id);
  } else {
    expandedEntryIds.value.add(id);
  }
}

function methodBadgeVariant(method: OutboxEntry['method']): 'success' | 'accent' | 'danger' {
  switch (method) {
    case 'POST':
      return 'success';
    case 'PUT':
      return 'accent';
    case 'DELETE':
      return 'danger';
  }
}

function methodLabel(method: OutboxEntry['method']): string {
  switch (method) {
    case 'POST':
      return 'Erstellen';
    case 'PUT':
      return 'Bearbeiten';
    case 'DELETE':
      return 'Löschen';
  }
}

function getEntryInfo(entry: OutboxEntry): { category: string; title: string } {
  const path = entry.path.split('?')[0];
  const body =
    entry.body && typeof entry.body === 'object' ? (entry.body as Record<string, unknown>) : {};
  const rawTitle = body.title || body.name || body.text || body.note;
  const titleStr = typeof rawTitle === 'string' ? rawTitle.trim() : '';

  if (path.includes('/todos')) {
    return {
      category: 'Aufgabe',
      title: titleStr || 'Aufgabe ohne Titel',
    };
  }
  if (path.includes('/spots')) {
    return {
      category: 'Spot / Ort',
      title: titleStr || 'Spot ohne Namen',
    };
  }
  if (path.includes('/budget')) {
    const amountStr =
      typeof body.amount === 'number'
        ? ` (${body.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })})`
        : '';
    return {
      category: 'Ausgabe',
      title: (titleStr || 'Ausgabe') + amountStr,
    };
  }
  if (path.includes('/diary')) {
    return {
      category: 'Tagebuch',
      title:
        titleStr ||
        (typeof body.entry_date === 'string'
          ? `Eintrag vom ${body.entry_date}`
          : 'Tagebucheintrag'),
    };
  }
  if (path.includes('/notes')) {
    return {
      category: 'Notiz',
      title: titleStr || 'Notiz ohne Titel',
    };
  }
  if (path.includes('/packing')) {
    return {
      category: 'Packliste',
      title: titleStr || 'Packlisten-Eintrag',
    };
  }
  if (path.includes('/shopping')) {
    return {
      category: 'Einkaufsliste',
      title: titleStr || 'Einkaufs-Artikel',
    };
  }
  return {
    category: path.replace(/^\//, '').split('/')[0] || 'Element',
    title: titleStr || path,
  };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function syncSingle(entry: OutboxEntry) {
  if (singleSyncingId.value) return;
  singleSyncingId.value = entry.id;

  try {
    const res = await rawRequest(entry.path, {
      method: entry.method,
      body: entry.body ? JSON.stringify(entry.body) : undefined,
    });

    if (entry.tempId != null && res && typeof res === 'object' && 'id' in res) {
      remapOutboxTempId(entry.tempId, (res as { id: number }).id);
    }

    removeOutboxEntry(entry.id);
    refreshOutbox();
    useLiveSyncStore().refreshAll();
    showToast({
      message: 'Eintrag erfolgreich synchronisiert.',
      type: 'success',
    });
  } catch (err: unknown) {
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number'
        ? (err as { status: number }).status
        : undefined;
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Fehler beim Übertragen';

    updateOutboxEntry(entry.id, {
      lastError: {
        status,
        message,
        timestamp: new Date().toISOString(),
      },
    });
    refreshOutbox();

    showToast({
      message: `Synchronisierung fehlgeschlagen: ${message}`,
      type: 'error',
    });
  } finally {
    singleSyncingId.value = null;
  }
}

function discardSingle(entry: OutboxEntry) {
  const { title } = getEntryInfo(entry);
  if (
    confirm(
      `Diesen nicht synchronisierten Eintrag ("${title}") wirklich verwerfen? Lokal vorgenommene Änderungen gehen verloren.`
    )
  ) {
    removeOutboxEntry(entry.id);
    refreshOutbox();
    showToast({ message: 'Eintrag verworfen.', type: 'info' });
  }
}

function discardAll() {
  if (
    confirm(
      `Alle ${outboxEntries.value.length} nicht synchronisierten Einträge wirklich verwerfen? Diese Aktion kann nicht rückgängig gemacht werden.`
    )
  ) {
    clearOutbox();
    refreshOutbox();
    showToast({ message: 'Alle ausstehenden Einträge wurden verworfen.', type: 'info' });
  }
}

function openEditModal(entry: OutboxEntry) {
  editingEntry.value = entry;
  editPath.value = entry.path;
  editBodyJson.value = entry.body ? JSON.stringify(entry.body, null, 2) : '';
  editJsonError.value = null;
}

function closeEditModal() {
  editingEntry.value = null;
  editPath.value = '';
  editBodyJson.value = '';
  editJsonError.value = null;
}

function saveEdit() {
  if (!editingEntry.value) return;

  let parsedBody: unknown = undefined;
  if (editBodyJson.value.trim()) {
    try {
      parsedBody = JSON.parse(editBodyJson.value);
    } catch (_e) {
      editJsonError.value = 'Ungültiges JSON-Format. Bitte überprüfe die Syntax.';
      return;
    }
  }

  updateOutboxEntry(editingEntry.value.id, {
    path: editPath.value.trim(),
    body: parsedBody,
  });

  refreshOutbox();
  closeEditModal();
  showToast({
    message: 'Eintrag aktualisiert. Du kannst ihn nun erneut übertragen.',
    type: 'success',
  });
}

function handleMigrateData() {
  migrating.value = true;
  try {
    const report = migrateLocalData();
    refreshOutbox();
    if (report.migratedEntriesCount > 0) {
      showToast({
        message: `${report.migratedEntriesCount} ${
          report.migratedEntriesCount === 1 ? 'Eintrag' : 'Einträge'
        } erfolgreich auf aktuelles Format migriert.`,
        type: 'success',
      });
    } else {
      showToast({
        message: 'Lokale Daten sind auf dem neuesten Stand. Keine Migration erforderlich.',
        type: 'info',
      });
    }
  } catch (_err: unknown) {
    showToast({
      message: 'Fehler bei der Datenmigration.',
      type: 'error',
    });
  } finally {
    migrating.value = false;
  }
}
</script>

<template>
  <Card id="unsynced-items" class="pending-sync-card">
    <div class="card-header">
      <div class="header-title-row">
        <h2>
          <AppIcon :icon="ACTION_ICONS.syncPending" :size="20" group="actions" />
          Nicht-synchronisierte Inhalte
        </h2>
        <Badge v-if="outboxEntries.length > 0" variant="accent">
          {{ outboxEntries.length }} ausstehend
        </Badge>
        <Badge v-else variant="success">Alle Daten synchron</Badge>
      </div>
      <p class="header-desc hint">
        {{
          outboxEntries.length > 0
            ? 'Diese Änderungen wurden offline gespeichert und warten auf die Übertragung an das Backend. Falls die Übertragung fehlschlägt, kannst du die Fehlerursache einsehen, Daten anpassen oder Einträge verwerfen.'
            : 'Alle lokalen Änderungen wurden erfolgreich an den Server übertragen.'
        }}
      </p>
    </div>

    <div class="card-actions-bar">
      <Button
        v-if="outboxEntries.length > 0"
        variant="primary"
        size="sm"
        :disabled="connectivity.syncing || singleSyncingId !== null"
        @click="connectivity.syncNow()"
      >
        <AppIcon
          :icon="ACTION_ICONS.syncPending"
          :size="14"
          group="actions"
          :class="{ 'is-spinning': connectivity.syncing }"
        />
        {{ connectivity.syncing ? 'Synchronisiere…' : 'Alle jetzt übertragen' }}
      </Button>

      <Button
        variant="secondary"
        size="sm"
        :disabled="migrating"
        @click="handleMigrateData"
        title="Prüft und aktualisiert veraltete lokale Datenformate auf die aktuelle Backend-Version"
      >
        <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" />
        {{ migrating ? 'Migriere…' : 'Daten prüfen & reparieren' }}
      </Button>

      <Button
        v-if="outboxEntries.length > 0"
        variant="secondary"
        size="sm"
        class="discard-all-btn"
        @click="discardAll"
      >
        <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" />
        Alle verwerfen
      </Button>
    </div>

    <!-- Liste der ausstehenden Einträge -->
    <div v-if="outboxEntries.length > 0" class="outbox-list">
      <div v-for="entry in outboxEntries" :key="entry.id" class="outbox-item">
        <div class="item-summary-row">
          <div class="item-main-info">
            <div class="badges-row">
              <Badge :variant="methodBadgeVariant(entry.method)">
                {{ methodLabel(entry.method) }}
              </Badge>
              <span class="item-category">{{ getEntryInfo(entry).category }}</span>
              <span class="item-time">{{ formatDate(entry.createdAt) }}</span>
            </div>
            <div class="item-title">{{ getEntryInfo(entry).title }}</div>
            <div class="item-path">
              <code>{{ entry.method }} {{ entry.path }}</code>
            </div>
          </div>

          <div class="item-actions">
            <Button
              size="sm"
              variant="secondary"
              :disabled="singleSyncingId !== null || connectivity.syncing"
              @click="syncSingle(entry)"
              title="Diesen Eintrag jetzt übertragen"
            >
              <AppIcon
                :icon="ACTION_ICONS.syncPending"
                :size="14"
                group="actions"
                :class="{ 'is-spinning': singleSyncingId === entry.id }"
              />
              Übertragen
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="openEditModal(entry)"
              title="Nutzdaten bearbeiten"
            >
              <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
              Bearbeiten
            </Button>
            <Button
              size="sm"
              variant="ghost"
              @click="toggleExpand(entry.id)"
              :title="expandedEntryIds.has(entry.id) ? 'Details verbergen' : 'Details anzeigen'"
            >
              {{ expandedEntryIds.has(entry.id) ? 'Weniger' : 'Details' }}
            </Button>
            <IconButton
              variant="ghost"
              :aria-label="`Eintrag ${getEntryInfo(entry).title} verwerfen`"
              title="Verwerfen"
              @click="discardSingle(entry)"
            >
              <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" />
            </IconButton>
          </div>
        </div>

        <!-- Fehleranzeige, falls vorhanden -->
        <Alert v-if="entry.lastError" variant="danger" class="item-error-alert">
          <div class="error-content">
            <strong>
              Fehler bei Übertragung{{
                entry.lastError.status ? ` (HTTP ${entry.lastError.status})` : ''
              }}:
            </strong>
            <span class="error-msg">{{ entry.lastError.message }}</span>
            <div class="error-meta hint">
              Zuletzt versucht: {{ formatDate(entry.lastError.timestamp) }}
              <template v-if="entry.retryCount">
                · {{ entry.retryCount }} Fehlversuch{{ entry.retryCount > 1 ? 'e' : '' }}
              </template>
            </div>
          </div>
        </Alert>

        <!-- Ausklappbare Rohdaten / JSON -->
        <div v-if="expandedEntryIds.has(entry.id)" class="item-details-box">
          <div class="detail-field">
            <span class="detail-label">ID:</span>
            <code>{{ entry.id }}</code>
          </div>
          <div v-if="entry.tempId != null" class="detail-field">
            <span class="detail-label">Temporäre ID:</span>
            <code>{{ entry.tempId }}</code>
          </div>
          <div class="detail-field">
            <span class="detail-label">Nutzdaten (Body):</span>
            <pre class="json-code">{{ JSON.stringify(entry.body, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Modal
      :model-value="editingEntry !== null"
      title="Eintrag bearbeiten"
      size="md"
      @update:model-value="closeEditModal"
    >
      <form v-if="editingEntry" @submit.prevent="saveEdit" class="edit-form">
        <p class="hint">
          Hier kannst du den Ziel-Pfad und die Nutzdaten des Eintrags anpassen, falls sich die
          API-Struktur geändert hat.
        </p>

        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="edit-entry-path">API-Pfad</label>
          <Input id="edit-entry-path" v-model="editPath" required />
        </div>

        <div class="field">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="edit-entry-body">Nutzdaten (JSON)</label>
          <Textarea id="edit-entry-body" v-model="editBodyJson" :rows="8" />
          <p v-if="editJsonError" class="hint error">{{ editJsonError }}</p>
        </div>

        <div class="modal-buttons">
          <Button type="button" variant="secondary" @click="closeEditModal">Abbrechen</Button>
          <Button type="submit" variant="primary">Speichern</Button>
        </div>
      </form>
    </Modal>
  </Card>
</template>

<style scoped>
.pending-sync-card {
  margin-top: var(--space-4);
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.header-title-row h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.header-desc {
  margin: var(--space-2) 0 var(--space-3);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.card-actions-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.discard-all-btn {
  margin-left: auto;
}

.outbox-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.outbox-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-elevated, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.item-summary-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.item-main-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 200px;
}

.badges-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.item-category {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.item-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.item-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  word-break: break-word;
}

.item-path code {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-hover);
  padding: 1px 4px;
  border-radius: var(--radius-sm);
}

.item-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.item-error-alert {
  margin-top: var(--space-1);
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-sm);
}

.error-msg {
  word-break: break-word;
}

.error-meta {
  margin: 0;
  font-size: var(--font-size-xs);
}

.item-details-box {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-label {
  font-weight: 600;
  color: var(--color-text-muted);
}

.json-code {
  margin: 0;
  padding: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  max-height: 200px;
  font-family: monospace;
  font-size: 0.75rem;
  line-height: 1.3;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.hint.error {
  color: var(--color-danger);
}
</style>
