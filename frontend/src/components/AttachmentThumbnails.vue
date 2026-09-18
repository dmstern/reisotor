<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Attachment } from '../api/types';
import type { AttachmentPreviewItem } from './AttachmentPreviewModal.vue';
import IconButton from './primitives/IconButton.vue';
import FileFormatGraphic from './primitives/FileFormatGraphic.vue';
import PolaroidStack from './primitives/PolaroidStack.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatFileSize } from '../utils/fileUpload';

const props = withDefaults(
  defineProps<{
    items: (Attachment | AttachmentPreviewItem | string)[];
    editable?: boolean;
    removeTitle?: string;
    removeAriaLabel?: string;
    fanned?: boolean;
  }>(),
  {
    editable: true,
    removeTitle: 'Anhang entfernen',
    removeAriaLabel: 'Anhang entfernen',
    fanned: undefined,
  }
);

const emit = defineEmits<{
  (e: 'click', index: number): void;
  (e: 'remove', index: number): void;
  (e: 'update:fanned', value: boolean): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const internalFanned = ref(false);
const isCollapsing = ref(false);
let activeAnimTimeout: number | null = null;

const isFanned = computed({
  get: () => (props.fanned !== undefined ? props.fanned : internalFanned.value),
  set: (val: boolean) => {
    internalFanned.value = val;
    emit('update:fanned', val);
  },
});

const STACK_ANGLES = [-2, 6, -7, 8];
const STACK_X_OFFSETS = [0, 4, -5, 6];
const STACK_Y_OFFSETS = [0, -1, 2, 1];

function clearActiveAnimation() {
  if (activeAnimTimeout !== null) {
    clearTimeout(activeAnimTimeout);
    activeAnimTimeout = null;
  }
}

onBeforeUnmount(() => {
  clearActiveAnimation();
});

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function expandToFanned() {
  if (isFanned.value && !isCollapsing.value) return;
  clearActiveAnimation();

  if (isReducedMotion() || !rootRef.value) {
    isCollapsing.value = false;
    isFanned.value = true;
    return;
  }

  // 1. Positionen der Kacheln im gestapelten Zustand erfassen
  const stackTiles = rootRef.value.querySelectorAll<HTMLElement>(
    '.thumbnails-stacked-container .polaroid-tile'
  );
  const tileRects = Array.from(stackTiles).map((el) => el.getBoundingClientRect());
  const initialHeight = rootRef.value.getBoundingClientRect().height;

  // 2. Aufgefächerten Zustand mounten
  isCollapsing.value = false;
  isFanned.value = true;

  await nextTick();
  if (!rootRef.value) return;

  const fannedWraps = rootRef.value.querySelectorAll<HTMLElement>('.fanned-item-wrap');
  const removeThumbs = rootRef.value.querySelectorAll<HTMLElement>('.remove-thumb');
  const headerBar = rootRef.value.querySelector<HTMLElement>('.fanned-header-bar');

  if (!fannedWraps.length || !tileRects.length) return;

  const targetHeight = rootRef.value.getBoundingClientRect().height;

  // 3. FLIP Invert: Kacheln sofort an der Position des Stapels initialisieren
  fannedWraps.forEach((wrap, i) => {
    const tileRect = tileRects[Math.min(i, tileRects.length - 1)];
    const cardRect = wrap.getBoundingClientRect();

    const tileCenterX = tileRect.left + tileRect.width / 2;
    const tileCenterY = tileRect.top + tileRect.height / 2;
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const cardCenterY = cardRect.top + cardRect.height / 2;

    const dx = tileCenterX - cardCenterX;
    const dy = tileCenterY - cardCenterY;
    const scale = tileRect.width / (cardRect.width || 1);
    const stackRot = STACK_ANGLES[Math.min(i, STACK_ANGLES.length - 1)] || 0;

    wrap.style.transformOrigin = 'center center';
    wrap.style.transition = 'none';
    wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${stackRot}deg) scale(${scale})`;
    wrap.style.zIndex = String(fannedWraps.length - i);
    if (i >= tileRects.length) {
      wrap.style.opacity = '0';
    }
  });

  removeThumbs.forEach((thumb) => {
    thumb.style.transition = 'none';
    thumb.style.transform = 'scale(0)';
    thumb.style.opacity = '0';
  });

  if (headerBar) {
    headerBar.style.transition = 'none';
    headerBar.style.transform = 'translate3d(0, -8px, 0)';
    headerBar.style.opacity = '0';
  }

  rootRef.value.style.height = `${initialHeight}px`;
  rootRef.value.style.overflow = 'hidden';

  // 4. In den nächsten Frames die Animation flüssig starten (FLIP Play)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!rootRef.value) return;

      rootRef.value.style.transition = 'height 0.44s cubic-bezier(0.32, 0.72, 0, 1)';
      rootRef.value.style.height = `${targetHeight}px`;

      if (headerBar) {
        headerBar.style.transition =
          'opacity 0.32s ease, transform 0.35s cubic-bezier(0.34, 1.25, 0.64, 1)';
        headerBar.style.transform = 'translate3d(0, 0, 0)';
        headerBar.style.opacity = '1';
      }

      fannedWraps.forEach((wrap, i) => {
        const delay = i * 32;
        wrap.style.transition = `transform 0.46s cubic-bezier(0.34, 1.25, 0.64, 1) ${delay}ms, opacity 0.32s ease ${delay}ms`;
        wrap.style.transform = `translate3d(0, 0, 0) rotate(var(--item-rot, 0deg)) scale(1)`;
        wrap.style.opacity = '1';
      });

      removeThumbs.forEach((thumb, i) => {
        const delay = 140 + i * 32;
        thumb.style.transition = `transform 0.28s cubic-bezier(0.34, 1.5, 0.64, 1) ${delay}ms, opacity 0.22s ease ${delay}ms`;
        thumb.style.transform = 'scale(1)';
        thumb.style.opacity = '1';
      });

      const totalDuration = Math.min(650, (fannedWraps.length - 1) * 32 + 480);
      activeAnimTimeout = window.setTimeout(() => {
        if (rootRef.value) {
          rootRef.value.style.height = '';
          rootRef.value.style.overflow = '';
          rootRef.value.style.transition = '';
        }
        if (headerBar) {
          headerBar.style.transition = '';
          headerBar.style.transform = '';
          headerBar.style.opacity = '';
        }
        fannedWraps.forEach((wrap) => {
          wrap.style.transition = '';
          wrap.style.transform = '';
          wrap.style.opacity = '';
          wrap.style.transformOrigin = '';
          wrap.style.zIndex = '';
        });
        removeThumbs.forEach((thumb) => {
          thumb.style.transition = '';
          thumb.style.transform = '';
          thumb.style.opacity = '';
        });
        activeAnimTimeout = null;
      }, totalDuration);
    });
  });
}

function collapseToStacked() {
  if (!isFanned.value && !isCollapsing.value) return;
  clearActiveAnimation();

  if (isReducedMotion() || !rootRef.value) {
    isCollapsing.value = false;
    isFanned.value = false;
    return;
  }

  const fannedWraps = rootRef.value.querySelectorAll<HTMLElement>('.fanned-item-wrap');
  const removeThumbs = rootRef.value.querySelectorAll<HTMLElement>('.remove-thumb');
  const headerBar = rootRef.value.querySelector<HTMLElement>('.fanned-header-bar');

  if (!fannedWraps.length) {
    isCollapsing.value = false;
    isFanned.value = false;
    return;
  }

  isCollapsing.value = true;

  const currentHeight = rootRef.value.getBoundingClientRect().height;
  const containerRect = rootRef.value.getBoundingClientRect();

  // Ziel-Position des Stapels (oben links, padding 4px)
  const stackLeft = containerRect.left + 4;
  const stackTop = containerRect.top + 4;
  const tileBaseCenterX = stackLeft + 29;
  const tileBaseCenterY = stackTop + 33;
  const stackedHeight = 78;

  rootRef.value.style.height = `${currentHeight}px`;
  rootRef.value.style.overflow = 'hidden';
  rootRef.value.style.transition = 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1)';

  requestAnimationFrame(() => {
    if (!rootRef.value) return;

    rootRef.value.style.height = `${stackedHeight}px`;

    if (headerBar) {
      headerBar.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
      headerBar.style.opacity = '0';
      headerBar.style.transform = 'translate3d(0, -6px, 0)';
    }

    removeThumbs.forEach((thumb) => {
      thumb.style.transition = 'transform 0.16s ease, opacity 0.14s ease';
      thumb.style.transform = 'scale(0)';
      thumb.style.opacity = '0';
    });

    fannedWraps.forEach((wrap, i) => {
      const cardRect = wrap.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;

      const targetCenterX = tileBaseCenterX + (STACK_X_OFFSETS[i % 4] || 0);
      const targetCenterY = tileBaseCenterY + (STACK_Y_OFFSETS[i % 4] || 0);
      const targetRot = STACK_ANGLES[i % 4] || 0;
      const targetScale = 52 / (cardRect.width || 1);

      const dx = targetCenterX - cardCenterX;
      const dy = targetCenterY - cardCenterY;

      const reverseIndex = fannedWraps.length - 1 - i;
      const delay = reverseIndex * 24;

      wrap.style.transformOrigin = 'center center';
      wrap.style.zIndex = String(fannedWraps.length - i);
      wrap.style.transition = `transform 0.38s cubic-bezier(0.25, 1, 0.5, 1) ${delay}ms, opacity 0.3s ease ${delay}ms`;
      wrap.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${targetRot}deg) scale(${targetScale})`;
      if (i >= 4) {
        wrap.style.opacity = '0';
      }
    });

    const totalDuration = Math.min(550, (fannedWraps.length - 1) * 24 + 400);
    activeAnimTimeout = window.setTimeout(() => {
      isFanned.value = false;
      isCollapsing.value = false;

      if (rootRef.value) {
        rootRef.value.style.height = '';
        rootRef.value.style.overflow = '';
        rootRef.value.style.transition = '';
      }
      if (headerBar) {
        headerBar.style.transition = '';
        headerBar.style.transform = '';
        headerBar.style.opacity = '';
      }
      fannedWraps.forEach((wrap) => {
        wrap.style.transition = '';
        wrap.style.transform = '';
        wrap.style.opacity = '';
        wrap.style.transformOrigin = '';
        wrap.style.zIndex = '';
      });
      removeThumbs.forEach((thumb) => {
        thumb.style.transition = '';
        thumb.style.transform = '';
        thumb.style.opacity = '';
      });
      activeAnimTimeout = null;
    }, totalDuration);
  });
}

watch(
  () => props.fanned,
  (newVal) => {
    if (newVal === undefined) return;
    if (newVal && !isFanned.value) {
      expandToFanned();
    } else if (!newVal && isFanned.value) {
      collapseToStacked();
    }
  }
);

watch(
  () => props.items.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0)) {
      // Neu hochgeladene Dateien direkt aufgefächert anzeigen
      expandToFanned();
    } else if (newLen === 0) {
      clearActiveAnimation();
      isCollapsing.value = false;
      isFanned.value = false;
    }
  }
);

function isImage(item: AttachmentPreviewItem): boolean {
  if (item.mime_type && item.mime_type.startsWith('image/')) {
    return true;
  }
  const name = item.original_name || item.filename || '';
  return (
    /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(name) ||
    /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(item.url) ||
    item.url.startsWith('data:image/')
  );
}

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
    original_name:
      item.original_name ||
      item.filename ||
      (isImage(item as AttachmentPreviewItem) ? `Bild ${index + 1}` : `Anhang ${index + 1}`),
  };
}

const normalizedList = computed(() => props.items.map((item, idx) => normalize(item, idx)));

const ROTATIONS = [-2.5, 2, -1.5, 2.5, -2, 1.8];
function itemRotation(index: number): number {
  return ROTATIONS[index % ROTATIONS.length];
}

const stackTooltip = computed(() => {
  const count = props.items.length;
  if (!count) return '';
  return `${count} ${count === 1 ? 'Anhang' : 'Anhänge'} (Klicken zum Auffächern)`;
});
</script>

<template>
  <div v-if="normalizedList.length" ref="rootRef" class="attachment-thumbnails">
    <!-- 1. STATUS: GESTAPELT (Mini Polaroid Stack mit Büroklammer) -->
    <div v-if="!isFanned && !isCollapsing" class="thumbnails-stacked-container">
      <PolaroidStack
        :items="items"
        clipped
        size="sm"
        :title="stackTooltip"
        @click="expandToFanned"
      />
      <button
        type="button"
        class="stack-fan-pill"
        :title="stackTooltip"
        :aria-label="stackTooltip"
        @click="expandToFanned"
      >
        <span class="fan-pill-count">
          {{ items.length }} {{ items.length === 1 ? 'Anhang' : 'Anhänge' }}
        </span>
        <span class="fan-pill-action">
          <AppIcon :icon="ACTION_ICONS.chevronDown" :size="12" group="actions" />
          <span>Auffächern</span>
        </span>
      </button>
    </div>

    <!-- 2. STATUS: AUFGEFÄCHERT (Nebeneinander, leicht schräg, mit Lösch-Badges) -->
    <div v-else class="thumbnails-fanned-container">
      <div class="fanned-header-bar">
        <span class="fanned-header-count">
          {{ items.length }}
          {{ items.length === 1 ? 'Anhang aufgefächert' : 'Anhänge aufgefächert' }}
        </span>
        <button
          type="button"
          class="stack-collapse-btn"
          title="Anhänge wieder stapeln"
          aria-label="Anhänge wieder stapeln"
          @click="collapseToStacked"
        >
          <AppIcon :icon="ACTION_ICONS.chevronUp" :size="13" group="actions" />
          <span>Stapeln</span>
        </button>
      </div>

      <div class="fanned-list">
        <div
          v-for="(item, index) in normalizedList"
          :key="item.id ?? item.url ?? index"
          class="fanned-item-wrap"
          :style="{ '--item-rot': `${itemRotation(index)}deg` }"
        >
          <!-- FOTO: POLAROID-STIL -->
          <button
            v-if="isImage(item)"
            type="button"
            class="fanned-polaroid is-photo"
            :title="`${item.original_name} (Klicken für Vorschau)`"
            :aria-label="`Vorschau für ${item.original_name} anzeigen`"
            @click="emit('click', index)"
          >
            <div class="polaroid-photo-frame">
              <img
                :src="item.url"
                :alt="item.original_name"
                class="polaroid-photo"
                loading="lazy"
              />
            </div>
            <div class="polaroid-chin">
              <span class="polaroid-caption">{{ item.original_name }}</span>
            </div>
          </button>

          <!-- DOKUMENT / PDF: AUSGEDRUCKTER DIN-A4-ZETTEL -->
          <button
            v-else
            type="button"
            class="fanned-polaroid is-doc"
            :title="`${item.original_name}${item.size_bytes ? ' (' + formatFileSize(item.size_bytes) + ')' : ''} (Klicken für Vorschau)`"
            :aria-label="`Vorschau für ${item.original_name} anzeigen`"
            @click="emit('click', index)"
          >
            <div class="doc-sheet">
              <!-- Gefaltetes Eselsohr (Dog-ear) oben rechts -->
              <div class="doc-dogear" aria-hidden="true">
                <svg viewBox="0 0 8 8" fill="none" class="doc-dogear-svg">
                  <path d="M 0 0 L 8 8 H 0 Z" fill="rgba(0, 0, 0, 0.16)" />
                  <path
                    d="M 0 0 L 8 8 H 1 A 1 1 0 0 1 0 7 Z"
                    fill="#e2e8f0"
                    stroke="rgba(0, 0, 0, 0.08)"
                    stroke-width="0.5"
                  />
                </svg>
              </div>
              <div class="doc-badge-wrap">
                <FileFormatGraphic
                  :filename="item.original_name"
                  :mime-type="item.mime_type"
                  :size="26"
                />
              </div>
              <div class="doc-print-lines" aria-hidden="true">
                <span class="doc-line line-1" />
                <span class="doc-line line-2" />
                <span class="doc-line line-3" />
              </div>
              <div class="doc-footer">
                <span class="doc-title">{{ item.original_name }}</span>
              </div>
            </div>
          </button>

          <!-- Roter X-Löschen-Button am Polaroid -->
          <IconButton
            v-if="editable"
            size="sm"
            :icon="ACTION_ICONS.close"
            class="remove-thumb remove-btn"
            :title="removeTitle"
            :aria-label="removeAriaLabel"
            @click.stop="emit('remove', index)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attachment-thumbnails {
  margin-top: var(--space-2);
  margin-bottom: var(--space-3);
  position: relative;
  box-sizing: border-box;
}

/* ==========================================================================
   1. GESTAPELTER STATUS (Stacked Container)
   ========================================================================== */
.thumbnails-stacked-container {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  padding: 4px 0 6px 4px;
}

@keyframes fanPillPop {
  0% {
    opacity: 0;
    transform: translate3d(-8px, 0, 0) scale(0.92);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

.stack-fan-pill {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 6px 12px;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle, 8px);
  cursor: pointer;
  font: inherit;
  text-align: left;
  animation: fanPillPop 0.28s cubic-bezier(0.34, 1.35, 0.64, 1);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    transform 0.12s ease;
  user-select: none;
}

.stack-fan-pill:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-tint, rgba(59, 130, 246, 0.08));
  transform: translateY(-1px);
}

.stack-fan-pill:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.fan-pill-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}

.fan-pill-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-primary);
  line-height: 1;
}

/* ==========================================================================
   2. AUFGEFÄCHERTER STATUS (Fanned Container)
   ========================================================================== */
.thumbnails-fanned-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-1);
}

.fanned-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.fanned-header-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stack-collapse-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-tint, rgba(59, 130, 246, 0.1));
  border: 1px solid var(--color-primary-border, rgba(59, 130, 246, 0.2));
  border-radius: 999px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.12s ease;
  user-select: none;
}

.stack-collapse-btn:hover {
  background: var(--color-primary);
  color: #ffffff;
  transform: translateY(-1px);
}

.stack-collapse-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.fanned-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4) var(--space-3);
  padding: 8px 6px 12px 6px;
}

.fanned-item-wrap {
  position: relative;
  transform: rotate(var(--item-rot, 0deg));
  transform-origin: center bottom;
  transition:
    transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1),
    z-index 0.2s ease;
}

.fanned-item-wrap:hover {
  transform: rotate(var(--item-rot, 0deg)) scale(1.08) translateY(-3px);
  z-index: 10;
}

.fanned-item-wrap:hover .fanned-polaroid {
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.22),
    0 2px 6px rgba(0, 0, 0, 0.14);
}

/* Basis-Stile für beide Karten-Typen */
.fanned-polaroid {
  padding: 0;
  margin: 0;
  border: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: block;
  text-align: left;
  outline: none;
  transition: box-shadow 0.2s ease;
  user-select: none;
}

.fanned-polaroid:focus-visible {
  box-shadow:
    0 0 0 2px var(--color-background, #ffffff),
    0 0 0 4px var(--color-primary, #3b82f6);
}

/* ==========================================================================
   FOTO: POLAROID CARD
   ========================================================================== */
.fanned-polaroid.is-photo {
  width: 68px;
  height: 82px;
  background: #ffffff;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  padding: 3px 3px 8px 3px;
  box-sizing: border-box;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
}

:root[data-theme='dark'] .fanned-polaroid.is-photo {
  background: #2a2825;
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .fanned-polaroid.is-photo {
    background: #2a2825;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.25);
  }
}

.polaroid-photo-frame {
  width: 100%;
  height: 56px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.05));
}

.polaroid-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.polaroid-chin {
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 2px;
  overflow: hidden;
}

.polaroid-caption {
  font-size: 0.55rem;
  font-weight: 600;
  color: #334155;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
  text-align: center;
}

:root[data-theme='dark'] .polaroid-caption {
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-caption {
    color: #f2efe9;
  }
}

/* ==========================================================================
   DOKUMENT: DIN-A4-ZETTEL
   ========================================================================== */
.fanned-polaroid.is-doc {
  width: 58px;
  height: 82px;
  padding: 0;
  border-radius: 2px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.14);
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.18),
    0 1px 3px rgba(0, 0, 0, 0.12);
  display: block;
  overflow: visible;
}

:root[data-theme='dark'] .fanned-polaroid.is-doc {
  background: #f8fafc;
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.55),
    0 1px 3px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .fanned-polaroid.is-doc {
    background: #f8fafc;
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow:
      0 4px 14px rgba(0, 0, 0, 0.55),
      0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

.doc-sheet {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 5px 3px 3px 3px;
  box-sizing: border-box;
}

.doc-dogear {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 8px;
  height: 8px;
  pointer-events: none;
  z-index: 2;
}

.doc-dogear-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.doc-badge-wrap {
  margin-top: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-print-lines {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
  margin-top: 3px;
  pointer-events: none;
}

.doc-line {
  height: 1.5px;
  background: rgba(0, 0, 0, 0.16);
  border-radius: 1px;
}

.doc-line.line-1 {
  width: 80%;
}

.doc-line.line-2 {
  width: 90%;
}

.doc-line.line-3 {
  width: 60%;
}

.doc-footer {
  width: 100%;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 12px;
  overflow: hidden;
}

.doc-title {
  font-size: 0.52rem;
  font-weight: 600;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 52px;
  text-align: center;
}

/* ==========================================================================
   LÖSCHEN-BADGE (Rotes X oben rechts)
   ========================================================================== */
.remove-thumb {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  padding: 0;
  border-radius: 50%;
  corner-shape: round;
  border: 1.5px solid #ffffff;
  background: var(--color-danger, #c0392b);
  color: white;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  z-index: 12;
  transition:
    background-color 0.15s ease,
    transform 0.12s ease;
}

:root[data-theme='dark'] .remove-thumb {
  border-color: #2a2825;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .remove-thumb {
    border-color: #2a2825;
  }
}

.remove-thumb:hover {
  background: var(--color-danger-dark, #a93226);
  transform: scale(1.15);
}

@media (prefers-reduced-motion: reduce) {
  .stack-fan-pill,
  .fanned-item-wrap,
  .fanned-header-bar,
  .remove-thumb,
  .attachment-thumbnails {
    animation: none !important;
    transition: none !important;
  }
}
</style>
