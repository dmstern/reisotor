<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { Attachment } from '../api/types';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import FileFormatGraphic from './primitives/FileFormatGraphic.vue';
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
    editable?: boolean;
  }>(),
  { initialIndex: 0, editable: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'remove', index: number): void;
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
      resetAnimationState();
    }
  }
);

watch(
  () => props.attachments.length,
  (newLen) => {
    resetAnimationState();
    if (newLen === 0) {
      emit('update:modelValue', false);
    } else if (currentIndex.value >= newLen) {
      currentIndex.value = Math.max(0, newLen - 1);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  resetAnimationState();
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

const prevAttachment = computed<AttachmentPreviewItem | null>(() => {
  if (normalizedAttachments.value.length <= 1) return null;
  const idx =
    (currentIndex.value - 1 + normalizedAttachments.value.length) %
    normalizedAttachments.value.length;
  return normalizedAttachments.value[idx] ?? null;
});

const nextAttachment = computed<AttachmentPreviewItem | null>(() => {
  if (normalizedAttachments.value.length <= 1) return null;
  const idx = (currentIndex.value + 1) % normalizedAttachments.value.length;
  return normalizedAttachments.value[idx] ?? null;
});

const visibleSlides = computed(() => {
  if (normalizedAttachments.value.length <= 1) {
    return [
      {
        slot: 'current',
        item: currentAttachment.value,
        ariaHidden: false,
      },
    ];
  }
  return [
    {
      slot: 'prev',
      item: prevAttachment.value,
      ariaHidden: true,
    },
    {
      slot: 'current',
      item: currentAttachment.value,
      ariaHidden: false,
    },
    {
      slot: 'next',
      item: nextAttachment.value,
      ariaHidden: true,
    },
  ];
});

function isImage(attachment: AttachmentPreviewItem | null): boolean {
  if (!attachment) return false;
  if (attachment.mime_type && attachment.mime_type.startsWith('image/')) {
    return true;
  }
  const name = attachment.original_name || attachment.filename || '';
  return /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(name) || attachment.url.startsWith('data:image/');
}

// --- Smoothe & Stabile Swipe- und Slide-Animation ---
const isDragging = ref(false);
const isAnimating = ref(false);
const dragOffset = ref(0);
const targetOffsetPercent = ref<-200 | -100 | 0>(-100);

let touchStartX = 0;
let touchStartY = 0;
let isHorizontalGesture: boolean | null = null;
let animationTimer: ReturnType<typeof setTimeout> | null = null;
let activeMouseUpHandler: (() => void) | null = null;
let activeMouseMoveHandler: ((e: MouseEvent) => void) | null = null;

function clearAnimTimer() {
  if (animationTimer) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
}

function removeActiveMouseDragListeners() {
  if (activeMouseMoveHandler) {
    window.removeEventListener('mousemove', activeMouseMoveHandler);
    activeMouseMoveHandler = null;
  }
  if (activeMouseUpHandler) {
    window.removeEventListener('mouseup', activeMouseUpHandler);
    activeMouseUpHandler = null;
  }
}

function resetAnimationState() {
  clearAnimTimer();
  removeActiveMouseDragListeners();
  isAnimating.value = false;
  isDragging.value = false;
  dragOffset.value = 0;
  targetOffsetPercent.value = -100;
  isHorizontalGesture = null;
}

const ANIMATION_DURATION_MS = 280;

function slideTowards(direction: 'next' | 'prev' | 'cancel') {
  if (isAnimating.value) return;
  clearAnimTimer();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (direction === 'cancel') {
    if (dragOffset.value === 0) return;
    isAnimating.value = true;
    dragOffset.value = 0;
    targetOffsetPercent.value = -100;
    animationTimer = setTimeout(
      () => {
        isAnimating.value = false;
      },
      reducedMotion ? 0 : 220
    );
    return;
  }

  isAnimating.value = true;
  dragOffset.value = 0;
  targetOffsetPercent.value = direction === 'next' ? -200 : 0;

  const duration = reducedMotion ? 0 : ANIMATION_DURATION_MS;

  animationTimer = setTimeout(() => {
    if (direction === 'next') {
      currentIndex.value = (currentIndex.value + 1) % props.attachments.length;
    } else {
      currentIndex.value =
        (currentIndex.value - 1 + props.attachments.length) % props.attachments.length;
    }
    targetOffsetPercent.value = -100;
    isAnimating.value = false;
  }, duration);
}

function prev() {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  slideTowards('prev');
}

function next() {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  slideTowards('next');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue || props.attachments.length <= 1 || isAnimating.value) return;
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

// --- Swipe Logic für Touch-Geräte ---
function onTouchStart(e: TouchEvent) {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  if (e.touches.length !== 1) return;
  if ((e.target as HTMLElement)?.closest('.nav-btn, button, a')) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isHorizontalGesture = null;
  dragOffset.value = 0;
  isDragging.value = true;
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value || isAnimating.value) return;
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  const deltaX = currentX - touchStartX;
  const deltaY = currentY - touchStartY;

  if (isHorizontalGesture === null) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX > 6 || absY > 6) {
      if (absX > absY) {
        isHorizontalGesture = true;
      } else {
        isHorizontalGesture = false;
        isDragging.value = false;
        return;
      }
    } else {
      return;
    }
  }

  if (isHorizontalGesture) {
    if (e.cancelable) {
      e.preventDefault();
    }
    dragOffset.value = deltaX;
  }
}

function onTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;

  if (isHorizontalGesture) {
    const SWIPE_THRESHOLD = 45;
    if (dragOffset.value < -SWIPE_THRESHOLD) {
      slideTowards('next');
    } else if (dragOffset.value > SWIPE_THRESHOLD) {
      slideTowards('prev');
    } else {
      slideTowards('cancel');
    }
  } else {
    dragOffset.value = 0;
  }
  isHorizontalGesture = null;
}

function onTouchCancel() {
  if (isDragging.value) {
    isDragging.value = false;
    slideTowards('cancel');
  }
  isHorizontalGesture = null;
}

// --- Maus-Drag-Unterstützung für Desktop ---
function onMouseDown(e: MouseEvent) {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  if (e.button !== 0) return;
  if ((e.target as HTMLElement)?.closest('.nav-btn, button, a')) return;

  e.preventDefault();
  removeActiveMouseDragListeners();

  const startX = e.clientX;
  isDragging.value = true;
  dragOffset.value = 0;

  activeMouseMoveHandler = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return;
    dragOffset.value = moveEvent.clientX - startX;
  };

  activeMouseUpHandler = () => {
    removeActiveMouseDragListeners();
    if (!isDragging.value) return;
    isDragging.value = false;

    const SWIPE_THRESHOLD = 50;
    if (dragOffset.value < -SWIPE_THRESHOLD) {
      slideTowards('next');
    } else if (dragOffset.value > SWIPE_THRESHOLD) {
      slideTowards('prev');
    } else {
      slideTowards('cancel');
    }
  };

  window.addEventListener('mousemove', activeMouseMoveHandler);
  window.addEventListener('mouseup', activeMouseUpHandler);
}

const trackStyle = computed(() => {
  if (props.attachments.length <= 1) {
    return {
      transform: 'none',
      transition: 'none',
    };
  }

  if (isDragging.value) {
    return {
      transform: `translateX(calc(-100% + ${dragOffset.value}px))`,
      transition: 'none',
    };
  }

  if (isAnimating.value) {
    return {
      transform: `translateX(calc(${targetOffsetPercent.value}% + 0px))`,
      transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }

  return {
    transform: 'translateX(calc(-100% + 0px))',
    transition: 'none',
  };
});
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
          class="preview-content"
          :class="{
            'is-draggable': attachments.length > 1 && !isAnimating,
            'is-dragging': isDragging,
          }"
        >
          <div class="slider-track" :style="trackStyle">
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

      <div class="preview-actions">
        <Button
          v-if="editable"
          variant="danger"
          :icon="ACTION_ICONS.delete"
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
  display: flex;
  align-items: center;
  justify-content: center;
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
}

.preview-img {
  max-width: 100%;
  max-height: 65vh;
  object-fit: contain;
  border-radius: var(--radius-md-squircle);
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

@media (prefers-reduced-motion: reduce) {
  .slider-track {
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
