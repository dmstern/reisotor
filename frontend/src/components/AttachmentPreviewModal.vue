<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { Attachment } from '../api/types';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatFileSize } from '../utils/fileUpload';
import { DEMO_MODE } from '../demo/isDemoMode';

export interface AttachmentPreviewItem {
  id?: number;
  url: string;
  original_name?: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    attachments: (Attachment | AttachmentPreviewItem | string)[];
    initialIndex?: number;
  }>(),
  { initialIndex: 0 }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const currentIndex = ref(props.initialIndex);

watch(
  () => props.initialIndex,
  (newIdx) => {
    if (newIdx !== undefined && newIdx >= 0 && newIdx < props.attachments.length) {
      currentIndex.value = newIdx;
    }
  }
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (
        props.initialIndex !== undefined &&
        props.initialIndex >= 0 &&
        props.initialIndex < props.attachments.length
      ) {
        currentIndex.value = props.initialIndex;
      } else {
        currentIndex.value = 0;
      }
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});

function normalizeAttachment(
  item: Attachment | AttachmentPreviewItem | string,
  index: number
): AttachmentPreviewItem {
  if (typeof item === 'string') {
    return {
      url: item,
      original_name: `Bild ${index + 1}`,
      mime_type: 'image/jpeg',
    };
  }
  return {
    ...item,
    original_name: item.original_name || item.filename || `Anhang ${index + 1}`,
  };
}

const normalizedAttachments = computed<AttachmentPreviewItem[]>(() =>
  props.attachments.map((a, i) => normalizeAttachment(a, i))
);

const currentAttachment = computed<AttachmentPreviewItem | null>(
  () => normalizedAttachments.value[currentIndex.value] ?? null
);

function isImage(attachment: AttachmentPreviewItem | null): boolean {
  if (!attachment) return false;
  if (attachment.mime_type && attachment.mime_type.startsWith('image/')) {
    return true;
  }
  const name = attachment.original_name || attachment.filename || '';
  return /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(name) || attachment.url.startsWith('data:image/');
}

function prev() {
  if (props.attachments.length <= 1) return;
  currentIndex.value =
    (currentIndex.value - 1 + props.attachments.length) % props.attachments.length;
}

function next() {
  if (props.attachments.length <= 1) return;
  currentIndex.value = (currentIndex.value + 1) % props.attachments.length;
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue || props.attachments.length <= 1) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  }
}

function download(attachment: AttachmentPreviewItem | null) {
  if (!attachment) return;
  const downloadUrl =
    DEMO_MODE || attachment.url.startsWith('data:') || !attachment.id
      ? attachment.url
      : `/api/attachments/${attachment.id}/download`;

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = attachment.original_name || attachment.filename || 'attachment';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="lg"
    :title="currentAttachment?.original_name || 'Anhang-Vorschau'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="currentAttachment" class="preview-container">
      <div class="preview-meta">
        <span v-if="attachments.length > 1" class="preview-counter">
          {{ currentIndex + 1 }} von {{ attachments.length }}
        </span>
        <span v-if="currentAttachment.size_bytes" class="preview-size">
          {{ formatFileSize(currentAttachment.size_bytes) }}
        </span>
      </div>

      <div class="preview-stage">
        <IconButton
          v-if="attachments.length > 1"
          variant="ghost"
          class="nav-btn prev-btn"
          :icon="ACTION_ICONS.scrollLeft"
          title="Vorheriger Anhang (Pfeiltaste links)"
          aria-label="Vorheriger Anhang"
          @click="prev"
        />

        <div class="preview-content">
          <div v-if="isImage(currentAttachment)" class="image-wrapper">
            <img
              :src="currentAttachment.url"
              :alt="currentAttachment.original_name"
              class="preview-img"
            />
          </div>
          <div v-else class="unsupported-wrapper">
            <AppIcon
              :icon="ACTION_ICONS.attachment"
              :size="48"
              group="actions"
              class="unsupported-icon"
            />
            <p class="unsupported-title">Keine Vorschau verfügbar</p>
            <p class="unsupported-hint">Für diesen Dateityp ist keine Vorschau verfügbar.</p>
            <p class="unsupported-filename">
              {{ currentAttachment.original_name }}
            </p>
          </div>
        </div>

        <IconButton
          v-if="attachments.length > 1"
          variant="ghost"
          class="nav-btn next-btn"
          :icon="ACTION_ICONS.scrollRight"
          title="Nächster Anhang (Pfeiltaste rechts)"
          aria-label="Nächster Anhang"
          @click="next"
        />
      </div>

      <div class="preview-actions">
        <Button
          variant="primary"
          :icon="ACTION_ICONS.download"
          @click="download(currentAttachment)"
        >
          Herunterladen
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 200px;
}

.nav-btn {
  flex-shrink: 0;
}

.preview-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-wrapper {
  max-height: 65vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-md-squircle);
}

.preview-img {
  max-width: 100%;
  max-height: 65vh;
  object-fit: contain;
  border-radius: var(--radius-md-squircle);
  display: block;
}

.unsupported-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.03));
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md-squircle);
  width: 100%;
  min-height: 220px;
}

.unsupported-icon {
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.unsupported-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  margin: 0 0 var(--space-1);
}

.unsupported-hint {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2);
}

.unsupported-filename {
  font-size: 0.8rem;
  color: var(--color-primary);
  word-break: break-all;
  margin: 0;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
</style>
