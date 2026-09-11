<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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

const internalFanned = ref(false);

const isFanned = computed({
  get: () => (props.fanned !== undefined ? props.fanned : internalFanned.value),
  set: (val: boolean) => {
    internalFanned.value = val;
    emit('update:fanned', val);
  },
});

watch(
  () => props.items.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0)) {
      // Neu hochgeladene Dateien direkt aufgefächert anzeigen
      isFanned.value = true;
    } else if (newLen === 0) {
      isFanned.value = false;
    }
  }
);

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
  <div v-if="normalizedList.length" class="attachment-thumbnails">
    <!-- 1. STATUS: GESTAPELT (Mini Polaroid Stack mit Büroklammer) -->
    <div v-if="!isFanned" class="thumbnails-stacked-container">
      <PolaroidStack
        :items="items"
        clipped
        size="sm"
        :title="stackTooltip"
        @click="isFanned = true"
      />
      <button
        type="button"
        class="stack-fan-pill"
        :title="stackTooltip"
        :aria-label="stackTooltip"
        @click="isFanned = true"
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
          @click="isFanned = false"
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
</style>
