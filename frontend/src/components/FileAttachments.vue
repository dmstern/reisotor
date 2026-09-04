<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Attachment, AttachmentDomain } from '../api/types';
import { compressImage } from '../utils/imageCompression';
import { readAsDataUrl } from '../utils/fileUpload';
import Button from './primitives/Button.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useAuthStore } from '../stores/auth';
import AttachmentPreviewModal from './AttachmentPreviewModal.vue';
import AttachmentThumbnails from './AttachmentThumbnails.vue';

const auth = useAuthStore();

// Wiederverwendbare Datei-Anhänge (Tickets/Dokumente) für Reise/Unterkunft/Notizen/Termine/Budget
// (siehe backend/src/routes/attachments.ts) – kapselt GET/POST/DELETE /attachments komplett, damit
// sie 1:1 per <FileAttachments domain="..." :entity-id="item.id" /> in mehrere Views eingebunden
// werden kann, analog zum uploadFiles()-Muster in DiaryView.vue (dort images-Array statt eigener
// Anhang-Tabelle, da Tagebuch-Bilder inline im Beitrag gerendert werden statt als Anhangsliste).
const props = withDefaults(
  defineProps<{
    domain: AttachmentDomain;
    entityId: number;
    /** Steuert, ob Hinzufügen/Löschen von Anhängen möglich ist - Standard AN, damit bestehende
     *  Einbindungen ohne diese Prop unverändert funktionieren. Detail-/Ansichts-Dialoge (kein
     *  Bearbeiten-Kontext, z. B. TravelDetailDialog.vue) setzen das explizit
     *  aus: Anhänge bleiben dort weiterhin sichtbar/herunterladbar, nur eben nicht änderbar - der
     *  Datei-Upload-Button gehört ins jeweilige Bearbeiten-Formular, nicht in die reine Ansicht. */
    editable?: boolean;
  }>(),
  { editable: true }
);

const attachments = ref<Attachment[]>([]);
const uploading = ref(false);
const error = ref('');
const previewOpen = ref(false);
const previewIndex = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

function openPreview(index: number) {
  previewIndex.value = index;
  previewOpen.value = true;
}

async function load() {
  attachments.value = await api.get<Attachment[]>(
    `/attachments?domain=${props.domain}&entity_id=${props.entityId}`
  );
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
      const data = file.type.startsWith('image/')
        ? await compressImage(file)
        : await readAsDataUrl(file);
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
  <!-- Im reinen Ansichtsmodus (editable=false) ohne jeden Anhang komplett weglassen statt einer
       leeren "Anhänge"-Überschrift ohne Inhalt und ohne Möglichkeit, etwas hinzuzufügen. -->
  <div v-if="editable || attachments.length" class="file-attachments">
    <h4 class="heading">Anhänge</h4>
    <AttachmentThumbnails
      v-if="attachments.length"
      :items="attachments"
      :editable="editable"
      remove-title="Anhang löschen"
      remove-aria-label="Anhang löschen"
      @click="openPreview"
      @remove="(index) => remove(attachments[index])"
    />

    <AttachmentPreviewModal
      v-model="previewOpen"
      :attachments="attachments"
      :initial-index="previewIndex"
    />
    <p v-if="editable && auth.user?.restricted" class="hint">
      Eingeschränkter Modus - Kein Datei-Upload möglich
    </p>
    <div v-else-if="editable" class="upload-control">
      <input
        ref="fileInputRef"
        type="file"
        class="file-input-hidden"
        accept="image/*,application/pdf"
        multiple
        aria-label="Datei auswählen"
        :disabled="uploading"
        @change="onFilesSelected"
      />
      <Button
        variant="secondary"
        size="sm"
        :icon="ACTION_ICONS.add"
        :disabled="uploading"
        type="button"
        @click="fileInputRef?.click()"
      >
        {{ uploading ? 'Lädt hoch …' : '+ Datei hinzufügen' }}
      </Button>
    </div>
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

.file-input-hidden {
  display: none;
}

.hint {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin: 0;
}

.error {
  color: var(--color-danger, #c0392b);
  font-size: 0.8rem;
  margin-top: var(--space-1);
}
</style>
