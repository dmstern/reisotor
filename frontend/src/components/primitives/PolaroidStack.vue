<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import FileFormatGraphic from './FileFormatGraphic.vue';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';
import type { Attachment } from '../../api/types';
import type { AttachmentPreviewItem } from '../AttachmentPreviewModal.vue';

export interface PolaroidStationItem {
  key?: string | number;
  id?: string | number;
  title: string;
  imageUrl?: string | null;
  tabler?: IconDef;
  iconGroup?: IconGroup;
  color?: string;
  mimeType?: string;
}

export type PolaroidInputItem = PolaroidStationItem | Attachment | AttachmentPreviewItem | string;

export interface NormalizedPolaroid {
  key: string | number;
  title: string;
  imageUrl: string | null;
  isImage: boolean;
  isDocument: boolean;
  fileExt: string;
  mimeType?: string;
  tabler?: IconDef;
  iconGroup?: IconGroup;
  color?: string;
}

const props = withDefaults(
  defineProps<{
    items: PolaroidInputItem[];
    maxVisible?: number;
    clipped?: boolean;
    interactive?: boolean;
    expanded?: boolean;
    title?: string;
    size?: 'sm' | 'md';
    extraCount?: number;
  }>(),
  {
    maxVisible: 4,
    clipped: false,
    interactive: true,
    expanded: false,
    size: 'sm',
  }
);

const emit = defineEmits<{
  (e: 'click', index: number): void;
}>();

function fileExtension(name: string): string {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx === -1) return 'DATEI';
  return name
    .slice(dotIdx + 1)
    .toUpperCase()
    .slice(0, 4);
}

function checkIsImage(item: Record<string, unknown>, url: string | null): boolean {
  if (!url) return false;
  const mime = item.mime_type || item.mimeType;
  if (typeof mime === 'string' && mime.startsWith('image/')) {
    return true;
  }
  if (url.startsWith('data:image/')) return true;
  const name =
    (typeof item.original_name === 'string' && item.original_name) ||
    (typeof item.filename === 'string' && item.filename) ||
    (typeof item.title === 'string' && item.title) ||
    url;
  return /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(name);
}

function normalize(item: PolaroidInputItem, index: number): NormalizedPolaroid {
  if (typeof item === 'string') {
    const isImg = checkIsImage({}, item);
    return {
      key: `str-${index}-${item}`,
      title: isImg ? `Bild ${index + 1}` : 'Anhang',
      imageUrl: item,
      isImage: isImg,
      isDocument: !isImg,
      fileExt: fileExtension(item),
    };
  }

  const raw = item as unknown as Record<string, unknown>;
  const key = (raw.key as string | number) ?? (raw.id as string | number) ?? `item-${index}`;
  const title =
    (raw.title as string) ||
    (raw.original_name as string) ||
    (raw.filename as string) ||
    (raw.imageUrl ? `Bild ${index + 1}` : `Anhang ${index + 1}`);
  const url = (raw.url as string) || (raw.imageUrl as string) || null;
  const isImg = checkIsImage(raw, url);
  const isDoc = !isImg && !raw.tabler;
  const mimeType = (raw.mime_type as string) || (raw.mimeType as string) || undefined;

  return {
    key,
    title,
    imageUrl: url,
    isImage: isImg,
    isDocument: isDoc,
    fileExt: fileExtension(title),
    mimeType,
    tabler: raw.tabler as IconDef | undefined,
    iconGroup: raw.iconGroup as IconGroup | undefined,
    color: raw.color as string | undefined,
  };
}

const normalizedItems = computed<NormalizedPolaroid[]>(() =>
  props.items.map((it, idx) => normalize(it, idx))
);

const visibleItems = computed<NormalizedPolaroid[]>(() =>
  normalizedItems.value.slice(0, props.maxVisible)
);

const calculatedExtraCount = computed(() => {
  if (props.extraCount !== undefined) return props.extraCount;
  return Math.max(0, props.items.length - visibleItems.value.length);
});

const stackTooltip = computed(() => {
  if (props.title) return props.title;
  if (!props.items.length) return '';
  if (props.items.length === 1) {
    return visibleItems.value[0].title;
  }
  return `${props.items.length} Anhänge (Klicken zum Durchblättern)`;
});

function polaroidTileStyle(idx: number, total: number) {
  if (total === 1) {
    return {
      transform: 'rotate(-2deg) translate(0px, 0px)',
      zIndex: 1,
    };
  }
  const angles = [-8, 6, -3, 7];
  const xOffsets = [-6, 4, 1, 6];
  const yOffsets = [2, -2, 1, 0];
  return {
    transform: `rotate(${angles[idx % angles.length]}deg) translate(${xOffsets[idx % xOffsets.length]}px, ${yOffsets[idx % yOffsets.length]}px)`,
    zIndex: idx + 1,
  };
}

function handleClick(e: Event) {
  if (!props.interactive) return;
  e.stopPropagation();
  emit('click', 0);
}
</script>

<template>
  <component
    :is="interactive ? 'button' : 'div'"
    v-if="visibleItems.length"
    :type="interactive ? 'button' : undefined"
    class="polaroid-stack"
    :class="[
      `polaroid-stack--${size}`,
      {
        'has-multiple': visibleItems.length > 1,
        'is-interactive': interactive,
        'is-expanded': expanded,
        'is-clipped': clipped,
      },
    ]"
    :title="stackTooltip"
    :aria-label="stackTooltip"
    @click="handleClick"
  >
    <div
      v-for="(tile, idx) in visibleItems"
      :key="tile.key"
      class="polaroid-tile"
      :class="{
        'is-doc': tile.isDocument,
        'is-photo': !tile.isDocument,
      }"
      :style="polaroidTileStyle(idx, visibleItems.length)"
    >
      <!-- ============================================== -->
      <!-- FALL A: Fotos oder Stationen -> Polaroid-Stil -->
      <!-- ============================================== -->
      <template v-if="!tile.isDocument">
        <div class="polaroid-photo-frame">
          <img
            v-if="tile.imageUrl && tile.isImage"
            :src="tile.imageUrl"
            class="polaroid-photo"
            :alt="tile.title"
            loading="lazy"
          />
          <!-- Station-Placeholder (Icons & Farbhintergrund) -->
          <div
            v-else-if="tile.tabler"
            class="polaroid-placeholder"
            :style="{ backgroundColor: tile.color || 'var(--color-primary-tint)' }"
          >
            <AppIcon :icon="tile.tabler" :size="16" :group="tile.iconGroup || 'categories'" />
          </div>
        </div>

        <div class="polaroid-chin">
          <span class="polaroid-caption">{{ tile.title }}</span>
        </div>
      </template>

      <!-- ============================================== -->
      <!-- FALL B: Dokumente -> Ausgedruckter DIN-A4-Zettel -->
      <!-- ============================================== -->
      <template v-else>
        <div class="doc-sheet polaroid-doc-placeholder">
          <!-- Gefaltetes Eselsohr (Dog-ear) oben rechts -->
          <div class="doc-dogear" aria-hidden="true">
            <svg
              viewBox="0 0 8 8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              class="doc-dogear-svg"
            >
              <path d="M 0 0 L 8 8 H 0 Z" fill="rgba(0, 0, 0, 0.16)" />
              <path
                d="M 0 0 L 8 8 H 1 A 1 1 0 0 1 0 7 Z"
                fill="#e2e8f0"
                stroke="rgba(0, 0, 0, 0.08)"
                stroke-width="0.5"
              />
            </svg>
          </div>

          <!-- Bunte, realistische Datei-Format-Grafik (SVG) -->
          <div class="doc-badge-wrap">
            <FileFormatGraphic
              :extension="tile.fileExt"
              :mime-type="tile.mimeType"
              :filename="tile.title"
              :size="size === 'md' ? 28 : 22"
            />
          </div>

          <!-- Gedruckte Text-Simulationszeilen (Print Skeleton) -->
          <div class="doc-print-lines" aria-hidden="true">
            <span class="doc-line line-1" />
            <span class="doc-line line-2" />
            <span class="doc-line line-3" />
          </div>

          <!-- Titel / Dateiname am unteren Zettelrand -->
          <div class="doc-footer">
            <span class="doc-title" :title="tile.title">{{ tile.title }}</span>
          </div>
        </div>
      </template>

      <!-- Badge für weitere Stationen / Anhänge (+N) -->
      <span
        v-if="idx === visibleItems.length - 1 && calculatedExtraCount > 0"
        class="polaroid-badge"
      >
        +{{ calculatedExtraCount }}
      </span>

      <!-- Büroklammer (Paperclip) auf der obersten Karte angeheftet -->
      <div
        v-if="clipped && idx === visibleItems.length - 1"
        class="polaroid-paperclip-wrap"
        :class="{ 'clipped-on-doc': tile.isDocument }"
        aria-hidden="true"
      >
        <svg
          class="polaroid-paperclip"
          viewBox="0 0 16 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <!-- Weicher Kontaktschatten -->
          <path
            d="M5 11v14c0 2.2 1.8 4 4 4s4-1.8 4-4V7c0-2.8-2.2-5-5-5s-5 2.2-5 5v17c0 1.7 1.3 3 3 3s3-1.3 3-3V11"
            stroke="rgba(0, 0, 0, 0.35)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            transform="translate(0.5, 1.2)"
          />
          <!-- Metallkörper mit Gradient -->
          <path
            d="M5 11v14c0 2.2 1.8 4 4 4s4-1.8 4-4V7c0-2.8-2.2-5-5-5s-5 2.2-5 5v17c0 1.7 1.3 3 3 3s3-1.3 3-3V11"
            stroke="url(#polaroid-paperclip-grad)"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <!-- Highlight-Kante -->
          <path
            d="M5 13v11c0 1.5 1.2 2.6 2.6 2.6"
            stroke="rgba(255, 255, 255, 0.85)"
            stroke-width="0.7"
            stroke-linecap="round"
          />
          <defs>
            <linearGradient id="polaroid-paperclip-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f8fafc" />
              <stop offset="30%" stop-color="#cbd5e1" />
              <stop offset="70%" stop-color="#94a3b8" />
              <stop offset="100%" stop-color="#64748b" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </component>
</template>

<style scoped>
.polaroid-stack {
  position: relative;
  width: 58px;
  height: 68px;
  flex-shrink: 0;
  perspective: 600px;
  display: inline-block;
  vertical-align: middle;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  text-align: inherit;
  color: inherit;
}

.polaroid-stack.is-interactive {
  cursor: pointer;
}

.polaroid-stack.is-interactive:focus-visible {
  outline: none;
}

.polaroid-stack.is-interactive:focus-visible .polaroid-tile:last-child {
  box-shadow:
    0 0 0 2px var(--color-background, #ffffff),
    0 0 0 4px var(--color-primary, #3b82f6);
}

.polaroid-tile {
  position: absolute;
  top: 2px;
  left: 3px;
  width: 52px;
  height: 62px;
  background: #ffffff;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  padding: 3px 3px 10px 3px;
  box-sizing: border-box;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  transform-origin: center bottom;
  transition:
    transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1),
    box-shadow 0.25s ease,
    opacity 0.25s ease;
  user-select: none;
}

:root[data-theme='dark'] .polaroid-tile {
  background: #2a2825;
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-tile {
    background: #2a2825;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.25);
  }
}

.polaroid-photo-frame {
  width: 100%;
  height: 40px;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.05));
}

.polaroid-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.polaroid-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.polaroid-placeholder :deep(svg) {
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* ==========================================================================
   DIN-A4-Zettel (Dokumente, PDFs, Spreadsheets etc.)
   ========================================================================== */
.polaroid-tile.is-doc {
  width: 44px;
  height: 62px;
  left: 7px;
  top: 2px;
  padding: 0;
  border-radius: 2px;
  corner-shape: auto;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.14);
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.18),
    0 1px 3px rgba(0, 0, 0, 0.12);
  overflow: visible;
}

/* Im Dark Mode: Realistisches helles Papier auf dem dunklen Untergrund */
:root[data-theme='dark'] .polaroid-tile.is-doc {
  background: #f8fafc;
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.55),
    0 1px 3px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-tile.is-doc {
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
  padding: 4px 3px 3px 3px;
  box-sizing: border-box;
}

/* Eselsohr (Dog-ear) in der oberen rechten Ecke */
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

/* Gedruckte Zeilen auf dem Zettel (Print Skeleton) */
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

/* Footer mit Dateiname auf dem Papier */
.doc-footer {
  width: 100%;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  height: 10px;
  padding: 0 1px;
}

.doc-title {
  font-size: 0.44rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
  font-family: inherit;
}

/* Büroklammer leicht nach innen versetzt bei Dokumenten */
.polaroid-paperclip-wrap.clipped-on-doc {
  left: 4px;
}

.polaroid-chin {
  height: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 1px;
  margin-top: 1px;
}

.polaroid-caption {
  font-size: 0.45rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1;
}

:root[data-theme='dark'] .polaroid-caption {
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-caption {
    color: #f2efe9;
  }
}

.polaroid-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--polaroid-badge-color, var(--excursion-theme-color, var(--color-tour, #2563eb)));
  color: #ffffff;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1.5px solid #ffffff;
  z-index: 5;
}

/* Büroklammer am oberen Rand */
.polaroid-paperclip-wrap {
  position: absolute;
  top: -8px;
  left: 6px;
  width: 13px;
  height: 27px;
  z-index: 7;
  pointer-events: none;
  transform: rotate(-6deg);
}

.polaroid-paperclip {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.25));
}

/* Hover-Effekt: Sanftes Auffächern */
.polaroid-stack.is-interactive:hover .polaroid-tile:nth-child(1) {
  transform: rotate(-12deg) translate(-7px, 2px) scale(1.02);
}
.polaroid-stack.is-interactive:hover .polaroid-tile:nth-child(2) {
  transform: rotate(8deg) translate(6px, -2px) scale(1.02);
}
.polaroid-stack.is-interactive:hover .polaroid-tile:nth-child(3) {
  transform: rotate(-4deg) translate(2px, 0px) scale(1.03);
}
.polaroid-stack.is-interactive:hover .polaroid-tile:nth-child(4) {
  transform: rotate(11deg) translate(9px, -1px) scale(1.03);
}

/* Morph-Animation beim Aufklappen */
.polaroid-stack.is-expanded .polaroid-tile {
  transform: translateY(32px) rotate(0deg) scale(1.15) !important;
  opacity: 0;
  pointer-events: none;
}

/* Größe md (optional) */
.polaroid-stack--md {
  width: 76px;
  height: 90px;
}
.polaroid-stack--md .polaroid-tile {
  width: 70px;
  height: 82px;
  padding: 4px 4px 12px 4px;
}
.polaroid-stack--md .polaroid-photo-frame {
  height: 54px;
}
.polaroid-stack--md .polaroid-chin {
  height: 12px;
}
.polaroid-stack--md .polaroid-caption {
  font-size: 0.6rem;
}
.polaroid-stack--md .polaroid-paperclip-wrap {
  top: -10px;
  left: 8px;
  width: 16px;
  height: 32px;
}

.polaroid-stack--md .polaroid-tile.is-doc {
  width: 58px;
  height: 82px;
  left: 9px;
  top: 3px;
  border-radius: 3px;
}

.polaroid-stack--md .doc-sheet {
  padding: 6px 4px 4px 4px;
}

.polaroid-stack--md .doc-dogear {
  width: 10px;
  height: 10px;
}

.polaroid-stack--md .doc-print-lines {
  margin-top: 4px;
  gap: 2.5px;
}

.polaroid-stack--md .doc-line {
  height: 2px;
}

.polaroid-stack--md .doc-footer {
  height: 12px;
}

.polaroid-stack--md .doc-title {
  font-size: 0.52rem;
}

.polaroid-stack--md .polaroid-paperclip-wrap.clipped-on-doc {
  left: 6px;
}
</style>
