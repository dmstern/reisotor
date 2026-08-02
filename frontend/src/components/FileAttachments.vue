<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Attachment, AttachmentDomain } from '../api/types';
import { compressImage } from '../utils/imageCompression';
import { readAsDataUrl, formatFileSize } from '../utils/fileUpload';

// Wiederverwendbare Datei-Anhänge (Tickets/Dokumente) für Reise/Unterkunft/Notizen/Termine/Budget
// (siehe backend/src/routes/attachments.ts) – kapselt GET/POST/DELETE /attachments komplett, damit
// sie 1:1 per <FileAttachments domain="..." :entity-id="item.id" /> in mehrere Views eingebunden
// werden kann, analog zum uploadFiles()-Muster in DiaryView.vue (dort images-Array statt eigener
// Anhang-Tabelle, da Tagebuch-Bilder inline im Beitrag gerendert werden statt als Anhangsliste).
const props = defineProps<{ domain: AttachmentDomain; entityId: number }>();

const attachments = ref<Attachment[]>([]);
const uploading = ref(false);
const error = ref('');

async function load() {
  attachments.value = await api.get<Attachment[]>(`/attachments?domain=${props.domain}&entity_id=${props.entityId}`);
}

onMounted(load);

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (!files.length) return;

  uploading.value = true;
  error.value = '';
  try {
    for (const file of files) {
      const data = file.type.startsWith('image/') ? await compressImage(file) : await readAsDataUrl(file);
      const created = await api.post<Attachment>('/attachments', {
        domain: props.domain,
        entity_id: props.entityId,
        data,
        filename: file.name,
      });
      attachments.value.push(created);
    }
  } catch {
    error.value = 'Datei-Upload fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    uploading.value = false;
  }
}

async function remove(attachment: Attachment) {
  await api.delete(`/attachments/${attachment.id}`);
  attachments.value = attachments.value.filter((a) => a.id !== attachment.id);
}
</script>

<template>
  <div class="file-attachments">
    <h4 class="heading">Anhänge</h4>
    <ul v-if="attachments.length" class="attachment-list">
      <li v-for="attachment in attachments" :key="attachment.id" class="attachment-row">
        <a :href="attachment.url" target="_blank" rel="noopener" class="attachment-link">
          📎 {{ attachment.original_name }}
        </a>
        <span class="size">{{ formatFileSize(attachment.size_bytes) }}</span>
        <button type="button" class="remove-btn" title="Anhang löschen" @click="remove(attachment)">✕</button>
      </li>
    </ul>
    <label class="upload-label">
      <input type="file" accept="image/*,application/pdf" multiple :disabled="uploading" @change="onFilesSelected" />
      {{ uploading ? 'Lädt hoch …' : '+ Datei hinzufügen' }}
    </label>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.file-attachments {
  margin-top: var(--space-3);
}

.heading {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.attachment-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.attachment-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
}

.attachment-link {
  color: var(--color-primary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-link:hover {
  text-decoration: underline;
}

.size {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.remove-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.remove-btn:hover {
  color: var(--color-danger, #c0392b);
}

.upload-label {
  display: inline-block;
  font-size: 0.85rem;
  color: var(--color-primary);
  cursor: pointer;
}

.upload-label input {
  display: none;
}

.error {
  color: var(--color-danger, #c0392b);
  font-size: 0.8rem;
  margin-top: var(--space-1);
}
</style>
