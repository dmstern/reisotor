<script setup lang="ts">
import { computed } from 'vue';
import type { Attachment } from '../api/types';
import type { AttachmentPreviewItem } from './AttachmentPreviewModal.vue';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatFileSize } from '../utils/fileUpload';

const props = withDefaults(
  defineProps<{
    items: (Attachment | AttachmentPreviewItem | string)[];
    editable?: boolean;
    removeTitle?: string;
    removeAriaLabel?: string;
  }>(),
  {
    editable: true,
    removeTitle: 'Anhang entfernen',
    removeAriaLabel: 'Anhang entfernen',
  }
);

const emit = defineEmits<{
  (e: 'click', index: number): void;
  (e: 'remove', index: number): void;
}>();

function normalize(
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

const normalizedList = computed(() => props.items.map((item, idx) => normalize(item, idx)));

function isImage(item: AttachmentPreviewItem): boolean {
  if (item.mime_type && item.mime_type.startsWith('image/')) {
    return true;
  }
  const name = item.original_name || item.filename || '';
  return /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(name) || item.url.startsWith('data:image/');
}

function fileExtension(name: string): string {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx === -1) return 'DATEI';
  return name
    .slice(dotIdx + 1)
    .toUpperCase()
    .slice(0, 4);
}
</script>

<template>
  <div class="attachment-thumbnails">
    <div
      v-for="(item, index) in normalizedList"
      :key="item.id ?? item.url ?? index"
      class="preview-thumb attachment-row"
    >
      <button
        type="button"
        class="thumb-btn attachment-link"
        :title="`${item.original_name}${item.size_bytes ? ' (' + formatFileSize(item.size_bytes) + ')' : ''}`"
        :aria-label="`Vorschau für ${item.original_name} anzeigen`"
        @click="emit('click', index)"
      >
        <img
          v-if="isImage(item)"
          :src="item.url"
          :alt="item.original_name"
          class="thumb-img"
          loading="lazy"
        />
        <div v-else class="thumb-doc">
          <AppIcon :icon="ACTION_ICONS.attachment" :size="22" group="actions" />
          <span class="thumb-doc-ext">{{ fileExtension(item.original_name || '') }}</span>
          <span class="thumb-doc-name">{{ item.original_name }}</span>
        </div>
        <span class="screenreader-only">{{ item.original_name }}</span>
      </button>
      <IconButton
        v-if="editable"
        size="sm"
        :icon="ACTION_ICONS.close"
        class="remove-thumb remove-btn"
        :title="removeTitle"
        :aria-label="removeAriaLabel"
        @click="emit('remove', index)"
      />
    </div>
  </div>
</template>

<style scoped>
.attachment-thumbnails {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  margin-bottom: var(--space-2);
}

.preview-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.thumb-btn {
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle, 8px);
  corner-shape: squircle;
  overflow: hidden;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.04));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.thumb-btn:hover {
  transform: scale(1.03);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-doc {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px;
  width: 100%;
  height: 100%;
  text-align: center;
  color: var(--color-text-muted);
}

.thumb-doc-ext {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-primary);
  text-transform: uppercase;
  margin-top: 2px;
}

.thumb-doc-name {
  font-size: 0.6rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 68px;
}

.remove-thumb {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  corner-shape: round;
  border: none;
  background: var(--color-danger, #c0392b);
  color: white;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
  z-index: 2;
  transition:
    background 0.15s ease,
    transform 0.12s ease;
}

.remove-thumb:hover {
  background: var(--color-danger-dark, #a93226);
  transform: scale(1.08);
}

.screenreader-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
