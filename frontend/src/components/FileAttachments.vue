<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Attachment, AttachmentDomain } from '../api/types';
import { compressImage, isHeicFile } from '../utils/imageCompression';
import { readAsDataUrl, isImageFile } from '../utils/fileUpload';
import Button from './primitives/Button.vue';
import Alert from './primitives/Alert.vue';
import PolaroidStack from './primitives/PolaroidStack.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useAuthStore } from '../stores/auth';
import { useAccountTierModal } from '../composables/useAccountTierModal';
import PremiumBadge from './PremiumBadge.vue';
import AttachmentPreviewModal from './AttachmentPreviewModal.vue';
import AttachmentThumbnails from './AttachmentThumbnails.vue';
import UploadProgressBar from './UploadProgressBar.vue';
import { useErrorNotifier } from '../composables/useErrorNotifier';

const auth = useAuthStore();
const { notifyError } = useErrorNotifier();

const emit = defineEmits<{
  (e: 'update:uploading', value: boolean): void;
}>();

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
    /** Kompakte Badge-Ansicht für eingeklappte Spot-Karten: Zeigt anstelle des vollen
     *  Polaroid-Stapels ein dezentes Büroklammer-Badge mit der Anzahl der Anhänge. Klick auf das
     *  Badge öffnet direkt die Datei-Vorschau. */
    collapsed?: boolean;
    /** Ermöglicht das direkte Übergeben von Anhängen (z. B. für Unit-Tests oder Preloading) */
    initialAttachments?: Attachment[];
  }>(),
  { editable: true, collapsed: false }
);

const attachments = ref<Attachment[]>(props.initialAttachments ?? []);
const uploading = ref(false);
const currentFile = ref(1);
const totalFiles = ref(0);
const currentFileName = ref('');
const progressPercent = ref(0);
let abortController: AbortController | null = null;

const error = ref('');
const previewOpen = ref(false);
const previewIndex = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

function setUploading(value: boolean) {
  uploading.value = value;
  emit('update:uploading', value);
}

function abortUpload() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  setUploading(false);
  currentFile.value = 1;
  totalFiles.value = 0;
  currentFileName.value = '';
  progressPercent.value = 0;
}

const badgeTooltip = computed(() => {
  const count = attachments.value.length;

  if (!count) {
    return '';
  }

  return `${count} ${count === 1 ? 'Anhang' : 'Anhänge'} (Klicken für Vorschau)`;
});

function openPreview(index?: number) {
  previewIndex.value = typeof index === 'number' ? index : 0;
  previewOpen.value = true;
}

async function load() {
  if (props.initialAttachments) {
    return;
  }

  if (!props.entityId || props.entityId <= 0 || Number.isNaN(props.entityId)) {
    return;
  }

  try {
    attachments.value = await api.get<Attachment[]>(
      `/attachments?domain=${props.domain}&entity_id=${props.entityId}`
    );
  } catch (err) {
    // Fehler beim Laden (z. B. Server kurzzeitig nicht erreichbar oder offline ohne Cache)
    // abfangen, um unhandledrejection zu verhindern (#527).
    console.debug(
      `[FileAttachments] Konnte Anhänge für ${props.domain}:${props.entityId} nicht laden:`,
      err
    );
  }
}

function onAttachmentsChanged(e: Event) {
  if (props.initialAttachments) {
    return;
  }

  const custom = e as CustomEvent<{ domain: string; entityId: number }>;

  if (
    custom.detail &&
    custom.detail.domain === props.domain &&
    custom.detail.entityId === props.entityId
  ) {
    load();
  }
}

onMounted(() => {
  load();

  if (typeof window !== 'undefined') {
    window.addEventListener('attachments-changed', onAttachmentsChanged);
  }
});

onUnmounted(() => {
  abortUpload();

  if (typeof window !== 'undefined') {
    window.removeEventListener('attachments-changed', onAttachmentsChanged);
  }
});

watch(
  () => props.collapsed,
  () => {
    load();
  }
);

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';

  if (!files.length) {
    return;
  }

  abortController = new AbortController();
  totalFiles.value = files.length;
  currentFile.value = 1;
  currentFileName.value = files[0].name;
  progressPercent.value = 0;
  setUploading(true);
  error.value = '';

  try {
    for (let i = 0; i < files.length; i++) {
      if (abortController.signal.aborted) {
        break;
      }

      const file = files[i];
      currentFile.value = i + 1;
      currentFileName.value = file.name;
      progressPercent.value = Math.round((i / files.length) * 100);

      const data = isImageFile(file) ? await compressImage(file) : await readAsDataUrl(file);

      if (abortController.signal.aborted) {
        break;
      }

      progressPercent.value = Math.round(((i + 0.5) / files.length) * 100);

      const filename = isHeicFile(file) ? file.name.replace(/\.(heic|heif)$/i, '.jpg') : file.name;
      const created = await api.post<Attachment>(
        '/attachments',
        {
          domain: props.domain,
          entity_id: props.entityId,
          data,
          filename,
        },
        { signal: abortController.signal }
      );

      if (abortController.signal.aborted) {
        break;
      }

      attachments.value.push(created);
      progressPercent.value = Math.round(((i + 1) / files.length) * 100);
    }

    if (!abortController.signal.aborted && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('attachments-changed', {
          detail: { domain: props.domain, entityId: props.entityId },
        })
      );
    }
  } catch (err) {
    if (abortController?.signal.aborted) {
      return;
    }

    error.value = 'Datei-Upload fehlgeschlagen. Bitte erneut versuchen.';
    notifyError(err, {
      context: 'Datei-Anhang',
      componentInfo: `FileAttachments (${props.domain}:${props.entityId})`,
      silent: true,
    });
  } finally {
    setUploading(false);
    abortController = null;
  }
}

async function remove(attachment: Attachment) {
  if (!attachment) {
    return;
  }

  const previous = [...attachments.value];
  attachments.value = attachments.value.filter((a) => a.id !== attachment.id);

  try {
    await api.delete(`/attachments/${attachment.id}`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('attachments-changed', {
          detail: { domain: props.domain, entityId: props.entityId },
        })
      );
    }
  } catch (err) {
    attachments.value = previous;
    error.value = 'Fehler beim Löschen des Anhangs.';
    notifyError(err, {
      context: 'Datei-Anhang',
      componentInfo: `FileAttachments (${props.domain}:${props.entityId})`,
      silent: true,
    });
  }
}

const { openAccountTierModal } = useAccountTierModal();

function handleUploadClick() {
  if (auth.user?.restricted) {
    openAccountTierModal('uploads');
    return;
  }

  fileInputRef.value?.click();
}
</script>

<template>
  <!-- Im reinen Ansichtsmodus (editable=false) ohne jeden Anhang komplett weglassen statt einer
       leeren "Anhänge"-Überschrift ohne Inhalt und ohne Möglichkeit, etwas hinzuzufügen. -->
  <div
    v-if="editable || attachments.length"
    class="file-attachments"
    :class="{ 'is-collapsed': collapsed }"
  >
    <!-- Im eingeklappten Ansichtsmodus (z. B. auf Spots): dezentes Büroklammer-Badge mit Anzahl -->
    <div v-if="collapsed && !editable" class="attachments-badge-wrap">
      <Button
        variant="overlay"
        shape="pill"
        size="xs"
        class="attachments-badge"
        :title="badgeTooltip"
        :aria-label="badgeTooltip"
        @click.stop="openPreview(0)"
      >
        <AppIcon :icon="ACTION_ICONS.attachment" :size="13" group="actions" />
        <span class="attachments-badge-count">{{ attachments.length }}</span>
      </Button>
    </div>

    <!-- Im regulären Ansichtsmodus: verspielter Polaroid-Stapel mit Büroklammer -->
    <template v-else>
      <h4 class="heading">Anhänge</h4>
      <!-- Im Ansichtsmodus: verspielter Polaroid-Stapel mit Büroklammer -->
      <div v-if="!editable && attachments.length" class="attachments-polaroid-wrap">
        <PolaroidStack :items="attachments" clipped @click="(idx) => openPreview(idx)" />
      </div>
      <!-- Im Bearbeiten-Modus: Thumbnails mit Direkt-Löschen-Badges -->
      <AttachmentThumbnails
        v-else-if="attachments.length"
        :items="attachments"
        :editable="editable"
        remove-title="Anhang löschen"
        remove-aria-label="Anhang löschen"
        @click="openPreview"
        @remove="(index) => remove(attachments[index])"
      />

      <div v-if="editable" class="upload-control">
        <input
          v-if="!auth.user?.restricted"
          ref="fileInputRef"
          type="file"
          class="file-input-hidden"
          accept="image/*,.heic,.heif,application/pdf"
          multiple
          aria-label="Datei auswählen"
          :disabled="uploading"
          @change="onFilesSelected"
        />
        <UploadProgressBar
          v-if="uploading"
          :current="currentFile"
          :total="totalFiles"
          :progress-percent="progressPercent"
          :filename="currentFileName"
          @cancel="abortUpload"
        />
        <Button
          v-else
          variant="secondary"
          size="sm"
          :icon="ACTION_ICONS.filePlus"
          type="button"
          @click="handleUploadClick"
        >
          Datei hinzufügen
          <PremiumBadge v-if="auth.user?.restricted" feature="uploads" as="span" :stop="false" />
        </Button>
      </div>
      <Alert
        v-if="error"
        variant="danger"
        size="sm"
        reportable
        :description="error"
        error-context="Datei-Anhang"
        class="error"
      />
    </template>

    <AttachmentPreviewModal
      v-model="previewOpen"
      :attachments="attachments"
      :initial-index="previewIndex"
      :editable="!auth.user?.restricted"
      @remove="(index) => remove(attachments[index])"
    />
  </div>
</template>

<style lang="scss" scoped>
.file-attachments {
  margin-top: var(--space-3);
}

.file-attachments.is-collapsed {
  margin-top: 0;
}

.attachments-badge-wrap {
  display: inline-flex;
}

.heading {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.attachments-polaroid-wrap {
  padding: var(--space-xs) 0 var(--space-1-5) var(--space-xs);
}

.file-input-hidden {
  display: none;
}

.hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

.error {
  margin-top: var(--space-1);
}
</style>
