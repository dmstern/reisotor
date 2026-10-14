<script setup lang="ts">
import { computed, nextTick, toRef, watch } from 'vue';
import type { Attachment } from '../api/types';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import FileFormatGraphic from './primitives/FileFormatGraphic.vue';
import AttachmentExifCard from './AttachmentExifCard.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatFileSize } from '../utils/fileUpload';
import { DEMO_MODE } from '../demo/isDemoMode';
import { isImage, normalizeAttachment, type AttachmentPreviewItem } from '../utils/attachment';
import { useAttachmentSlider } from '../composables/useAttachmentSlider';
import { useAttachmentHeight } from '../composables/useAttachmentHeight';

export type { AttachmentPreviewItem };

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    attachments: (Attachment | AttachmentPreviewItem | string)[];
    initialIndex?: number;
    editable?: boolean;
  }>(),
  { initialIndex: 0, editable: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'remove', index: number): void;
}>();

const normalizedAttachments = computed<AttachmentPreviewItem[]>(() =>
  props.attachments.map((a, i) => normalizeAttachment(a, i))
);

const {
  currentIndex,
  currentAttachment,
  visibleSlides,
  isDragging,
  isAnimating,
  trackStyle,
  prev,
  next,
  resetAnimationState,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onMouseDown,
} = useAttachmentSlider({
  items: normalizedAttachments,
  initialIndex: toRef(props, 'initialIndex'),
  isOpen: toRef(props, 'modelValue'),
  onClose: () => emit('update:modelValue', false),
});

const {
  previewContentRef,
  sliderTrackRef,
  isTransitionReady,
  contentStyle,
  updateContentHeight,
  onImageLoad,
  resetHeightState,
} = useAttachmentHeight({
  isOpen: toRef(props, 'modelValue'),
  slidesCountOrKey: visibleSlides,
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      resetHeightState();
      nextTick(() => {
        updateContentHeight(false);
      });
    } else {
      resetHeightState();
    }
  }
);

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

function onRemoveCurrent() {
  resetAnimationState();
  const currentLen = props.attachments.length;
  const removeIdx = currentIndex.value;
  emit('remove', removeIdx);
  if (currentLen <= 1) {
    emit('update:modelValue', false);
  } else if (removeIdx >= currentLen - 1) {
    currentIndex.value = Math.max(0, currentLen - 2);
  }
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

      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        class="preview-stage"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchCancel"
        @mousedown="onMouseDown"
      >
        <IconButton
          v-if="attachments.length > 1"
          variant="ghost"
          class="nav-btn prev-btn"
          :icon="ACTION_ICONS.scrollLeft"
          title="Vorheriger Anhang (Pfeiltaste links)"
          aria-label="Vorheriger Anhang"
          :disabled="isAnimating"
          @click="prev"
        />

        <div
          ref="previewContentRef"
          class="preview-content"
          :class="{
            'is-draggable': attachments.length > 1 && !isAnimating,
            'is-dragging': isDragging,
            'has-transition': isTransitionReady,
          }"
          :style="contentStyle"
        >
          <div ref="sliderTrackRef" class="slider-track" :style="trackStyle">
            <div
              v-for="slide in visibleSlides"
              :key="slide.slot"
              class="slider-slide"
              :aria-hidden="slide.ariaHidden || undefined"
            >
              <div v-if="slide.item && isImage(slide.item)" class="image-wrapper">
                <img
                  :src="slide.item.url"
                  :alt="slide.item.original_name"
                  class="preview-img"
                  draggable="false"
                  @load="onImageLoad"
                />
              </div>
              <div v-else-if="slide.item" class="unsupported-wrapper">
                <FileFormatGraphic
                  :filename="slide.item.original_name || slide.item.filename"
                  :mime-type="slide.item.mime_type"
                  :size="56"
                  class="unsupported-icon"
                />
                <p class="unsupported-title">Keine Vorschau verfügbar</p>
                <p class="unsupported-hint">
                  Für diesen Dateityp ist keine direkte Bild-Vorschau verfügbar.
                </p>
                <p class="unsupported-filename">
                  {{ slide.item.original_name }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <IconButton
          v-if="attachments.length > 1"
          variant="ghost"
          class="nav-btn next-btn"
          :icon="ACTION_ICONS.scrollRight"
          title="Nächster Anhang (Pfeiltaste rechts)"
          aria-label="Nächster Anhang"
          :disabled="isAnimating"
          @click="next"
        />
      </div>

      <!-- EXIF Metadaten (Aufnahmedatum & Geolocation) -->
      <AttachmentExifCard
        :current-attachment="currentAttachment"
        :all-attachments="normalizedAttachments"
        :current-index="currentIndex"
        @close="emit('update:modelValue', false)"
      />

      <div class="preview-actions">
        <Button
          v-if="editable"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          :title="isImage(currentAttachment) ? 'Bild entfernen' : 'Anhang löschen'"
          @click="onRemoveCurrent"
        >
          Löschen
        </Button>
        <div class="preview-actions-right">
          <Button
            variant="primary"
            :icon="ACTION_ICONS.download"
            @click="download(currentAttachment)"
          >
            Herunterladen
          </Button>
        </div>
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
  touch-action: pan-y pinch-zoom;
}

.nav-btn {
  flex-shrink: 0;
}

.preview-content {
  flex: 1;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  position: relative;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.preview-content:not(.has-transition) {
  transition: none !important;
}

.preview-content.is-draggable {
  cursor: grab;
}

.preview-content.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.slider-track {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  will-change: transform;
}

.slider-slide {
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.image-wrapper {
  width: 100%;
  max-height: 65vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.preview-img {
  max-width: 100%;
  max-height: 65vh;
  object-fit: contain;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

@media (prefers-reduced-motion: reduce) {
  .slider-track {
    transition: none !important;
  }

  .preview-content {
    transition: none !important;
  }
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
  corner-shape: squircle;
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
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.preview-actions-right {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
}
</style>
