<script setup lang="ts">
import { toRef } from 'vue';
import type { AttachmentPreviewItem } from '../utils/attachment';
import { useAttachmentExif } from '../composables/useAttachmentExif';
import { formatGeoCoordinates } from '../utils/imageCompression';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import MapsAppPicker from './MapsAppPicker.vue';

const props = withDefaults(
  defineProps<{
    currentAttachment: AttachmentPreviewItem | null;
    allAttachments?: AttachmentPreviewItem[];
    currentIndex?: number;
  }>(),
  {
    allAttachments: () => [],
    currentIndex: 0,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { currentMetadata, hasExifMetadata, formatExifDateTime, onShowLocationOnMap } =
  useAttachmentExif({
    currentAttachment: toRef(props, 'currentAttachment'),
    allAttachments: toRef(props, 'allAttachments'),
    currentIndex: toRef(props, 'currentIndex'),
    onCloseModal: () => emit('close'),
  });
</script>

<template>
  <Transition name="exif-card">
    <div
      v-if="hasExifMetadata && currentMetadata"
      class="preview-exif-card"
      data-testid="preview-exif-card"
    >
      <Transition name="exif-content" mode="out-in">
        <div :key="currentAttachment?.url || String(currentIndex)" class="exif-details">
          <div v-if="currentMetadata.dateTime" class="exif-item" data-testid="exif-date">
            <div class="exif-icon-badge" aria-hidden="true">
              <AppIcon :icon="FORM_FIELD_ICONS.time" :size="16" group="formFields" />
            </div>
            <div class="exif-text">
              <span class="exif-label">Aufnahmedatum</span>
              <span class="exif-value">{{ formatExifDateTime(currentMetadata.dateTime) }}</span>
            </div>
          </div>

          <div
            v-if="currentMetadata.latitude != null && currentMetadata.longitude != null"
            class="exif-item"
            data-testid="exif-location"
          >
            <div class="exif-icon-badge" aria-hidden="true">
              <AppIcon :icon="FORM_FIELD_ICONS.location" :size="16" group="formFields" />
            </div>
            <div class="exif-text">
              <span class="exif-label">Standort</span>
              <span class="exif-value">{{
                formatGeoCoordinates(currentMetadata.latitude, currentMetadata.longitude)
              }}</span>
            </div>
          </div>
        </div>
      </Transition>

      <div
        v-if="currentMetadata.latitude != null && currentMetadata.longitude != null"
        class="exif-actions"
      >
        <Button
          variant="secondary"
          size="sm"
          class="btn-show-map"
          :icon="FORM_FIELD_ICONS.maps"
          @click="onShowLocationOnMap"
        >
          Ort auf Karte anzeigen
        </Button>
        <MapsAppPicker
          :lat="currentMetadata.latitude"
          :lng="currentMetadata.longitude"
          :title="currentAttachment?.original_name || 'Foto-Standort'"
          size="sm"
          variant="secondary"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.preview-exif-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-3);
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  transition: border-color var(--transition-fast);
}

.preview-exif-card:hover {
  border-color: var(--color-border-strong);
}

/* Smooth Transition für den EXIF-Metadaten-Kasten */
.exif-card-enter-active {
  transition:
    opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    padding-top 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    padding-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.25s ease;
  max-height: 280px;
  overflow: hidden;
}

.exif-card-leave-active {
  transition:
    opacity 0.22s ease-in,
    transform 0.22s ease-in,
    max-height 0.26s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    padding-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    padding-bottom 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease;
  max-height: 280px;
  overflow: hidden;
}

.exif-card-enter-from,
.exif-card-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-width: 0;
  border-bottom-width: 0;
  border-color: transparent;
}

/* Subtle cross-fade for values when switching between attachments */
.exif-content-enter-active,
.exif-content-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.exif-content-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.exif-content-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .exif-card-enter-active,
  .exif-card-leave-active,
  .exif-content-enter-active,
  .exif-content-leave-active {
    transition: none !important;
    max-height: none !important;
    transform: none !important;
  }
}

.exif-details {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  min-width: 0;
}

.exif-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.exif-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint);
  color: var(--color-primary);
  flex-shrink: 0;
}

.exif-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
}

.exif-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.exif-value {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.exif-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

@container (max-width: 580px) {
  .preview-exif-card {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .exif-details {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .exif-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

@container (max-width: 380px) {
  .exif-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .exif-actions :deep(.btn-show-map),
  .exif-actions :deep(.maps-picker),
  .exif-actions :deep(.maps-picker .btn) {
    width: 100%;
    justify-content: center;
  }
}
</style>
