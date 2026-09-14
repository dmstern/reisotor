<script setup lang="ts">
import { computed } from 'vue';
import Modal from './Modal.vue';
import SpotImageCollage from './SpotImageCollage.vue';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

const actionIcons = ACTION_ICONS;

/**
 * DetailModal: Elegante Read-Only-Detailansicht für Kalender-Termine, Reise-Etappen und Entitäten.
 * Basiert auf dem Polaroid-/Framed-Photo-Stil von Reisotor:
 * - Oben ein aufgeräumter Header-Balken mit Kategorie-Badge links und Schließen-/Bearbeiten-Aktionen rechts
 * - Ein gerahmter Polaroid-Hero (Squircle-Border, dezente Schatten, kein Vollflächen-Bleed mehr)
 * - Kompakter, charmanter Platzhalter-Hero mit schwebender Icon-Kachel, wenn kein Foto hinterlegt ist
 * - Titel und Metadaten sitzen typografisch klar und unbeeinträchtigt unter dem Foto (kein dunkler Textverlauf)
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    imageUrl?: string | null;
    /** Fallback für Objekte ohne eigenes Bild: Foto-Collage aus den Bildern zugeordneter Spots */
    collageImages?: string[];
    placeholderIcon?: IconDef;
    /** Optionales Label für die Kategorie/den Typ im oberen Header-Balken (z. B. "Tour", "Ort", "Flug") */
    categoryLabel?: string;
    /** Optionales Icon für das Kategorie-Label */
    categoryIcon?: IconDef;
    /** Steuert, ob der Bearbeiten-Button angezeigt wird (Standard: true) */
    editable?: boolean;
    /** Theme-Farbe für Akzente und Hero-Glow (z. B. var(--color-tour)) */
    themeColor?: string;
    /** Theme-Hintergrundtönung (z. B. var(--color-tour-tint)) */
    themeTint?: string;
  }>(),
  {
    imageUrl: null,
    collageImages: () => [],
    editable: true,
    categoryLabel: undefined,
    categoryIcon: undefined,
    themeColor: undefined,
    themeTint: undefined,
  }
);

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'edit'): void }>();

const hasPhoto = computed(() => {
  return !!props.imageUrl || (props.collageImages && props.collageImages.length > 0);
});
</script>

<template>
  <Modal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    hide-header
    :aria-label="title"
  >
    <template #default="{ close }">
      <div
        class="detail-modal-card"
        :style="{
          '--detail-theme-color': themeColor || 'var(--color-primary)',
          '--detail-theme-tint': themeTint || 'var(--color-primary-tint)',
        }"
      >
        <!-- 1. Header-Balken: Kategorie-Badge links, Bearbeiten & Schließen rechts -->
        <header class="detail-modal-header">
          <div class="detail-header-badge-wrap">
            <slot name="badge">
              <span v-if="categoryLabel" class="detail-category-pill">
                <AppIcon v-if="categoryIcon" :icon="categoryIcon" :size="13" group="categories" />
                {{ categoryLabel }}
              </span>
            </slot>
          </div>
          <div class="detail-header-actions">
            <IconButton
              v-if="editable"
              variant="ghost"
              class="detail-action-btn edit"
              :icon="actionIcons.edit"
              size="sm"
              title="Bearbeiten"
              aria-label="Bearbeiten"
              @click="emit('edit')"
            />
            <IconButton
              variant="ghost"
              class="detail-action-btn close"
              :icon="actionIcons.close"
              size="sm"
              title="Schließen"
              aria-label="Schließen"
              @click="close"
            />
          </div>
        </header>

        <!-- 2. Polaroid / Gerahmter Media-Hero -->
        <div
          class="detail-polaroid-frame"
          :class="{
            'has-photo': hasPhoto,
            'is-placeholder': !hasPhoto,
          }"
        >
          <div class="detail-polaroid-inner">
            <!-- Echtes Bild -->
            <div
              v-if="imageUrl"
              class="detail-photo"
              :style="{ backgroundImage: `url(${imageUrl})` }"
              role="img"
              :aria-label="title"
            />
            <!-- Foto-Collage -->
            <SpotImageCollage
              v-else-if="collageImages && collageImages.length > 0"
              :images="collageImages"
            />
            <!-- Platzhalter mit zentrierter, schwebender Icon-Kachel -->
            <div v-else class="detail-placeholder-hero">
              <div class="detail-placeholder-icon-tile">
                <AppIcon
                  v-if="placeholderIcon"
                  class="placeholder-icon"
                  :size="30"
                  :icon="placeholderIcon"
                  group="categories"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Titel- & Meta-Block (klare Typografie unter dem Foto statt Text-Overlay auf Bild) -->
        <div class="detail-title-block">
          <h2 class="detail-title">{{ title }}</h2>
          <div v-if="$slots.meta" class="detail-meta">
            <slot name="meta" />
          </div>
        </div>

        <!-- 4. Detail-Inhalt (Zeit, Ort, Notizen, verknüpfte Tour/Spot, Anhänge, Maps) -->
        <div class="detail-body">
          <slot />
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.detail-modal-card {
  display: flex;
  flex-direction: column;
}

/* 1. Header-Balken */
.detail-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.detail-header-badge-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
}

.detail-category-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
  background: var(--detail-theme-tint, var(--color-primary-tint));
  color: var(--detail-theme-color, var(--color-primary));
  border: 1px solid
    color-mix(in srgb, var(--detail-theme-color, var(--color-primary)) 25%, transparent);
  letter-spacing: 0.02em;
}

.detail-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.detail-action-btn {
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.detail-action-btn:hover {
  transform: translateY(-1px);
}

/* 2. Polaroid / Gerahmter Media-Hero */
.detail-polaroid-frame {
  position: relative;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: 6px;
  box-shadow:
    0 3px 10px rgba(0, 0, 0, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.04);
  margin-bottom: var(--space-3);
  box-sizing: border-box;
}

.detail-polaroid-inner {
  position: relative;
  width: 100%;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  overflow: hidden;
}

.detail-polaroid-frame.has-photo .detail-polaroid-inner {
  height: 200px;
  background: var(--color-hover);
}

.detail-photo {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.3s ease;
}

.detail-polaroid-frame.has-photo:hover .detail-photo {
  transform: scale(1.02);
}

.detail-polaroid-frame.is-placeholder .detail-polaroid-inner {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    ellipse at 50% 35%,
    var(--detail-theme-tint, var(--color-primary-tint)) 0%,
    var(--color-surface) 100%
  );
}

.detail-placeholder-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.detail-placeholder-icon-tile {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--detail-theme-color, var(--color-primary));
  transform: rotate(-2.5deg);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.detail-polaroid-frame:hover .detail-placeholder-icon-tile {
  transform: rotate(0deg) scale(1.08);
}

.placeholder-icon {
  font-size: 1.85rem;
}

/* 3. Titel- & Meta-Block */
.detail-title-block {
  margin-bottom: var(--space-3);
}

.detail-title {
  margin: 0 0 6px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.3;
  word-break: break-word;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.detail-meta :deep(.detail-badge),
.detail-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-hover);
  padding: 3px 9px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1px solid var(--color-border);
}

/* 4. Detail-Inhalt */
.detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Dark-Mode Anpassungen für den Polaroid-Frame */
:root[data-theme='dark'] .detail-polaroid-frame {
  background: #2a2825;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.35),
    0 1px 4px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.12);
}

:root[data-theme='dark'] .detail-polaroid-frame.is-placeholder .detail-polaroid-inner {
  background: radial-gradient(
    ellipse at 50% 35%,
    color-mix(in srgb, var(--detail-theme-color, var(--color-primary)) 20%, #1e1d1b) 0%,
    #1e1d1b 100%
  );
}

:root[data-theme='dark'] .detail-placeholder-icon-tile {
  background: #2a2825;
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}

:root[data-theme='dark'] .detail-category-pill {
  background: color-mix(in srgb, var(--detail-theme-color, var(--color-primary)) 22%, transparent);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .detail-polaroid-frame {
    background: #2a2825;
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.35),
      0 1px 4px rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.12);
  }

  :root:not([data-theme='light']) .detail-polaroid-frame.is-placeholder .detail-polaroid-inner {
    background: radial-gradient(
      ellipse at 50% 35%,
      color-mix(in srgb, var(--detail-theme-color, var(--color-primary)) 20%, #1e1d1b) 0%,
      #1e1d1b 100%
    );
  }

  :root:not([data-theme='light']) .detail-placeholder-icon-tile {
    background: #2a2825;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  }

  :root:not([data-theme='light']) .detail-category-pill {
    background: color-mix(
      in srgb,
      var(--detail-theme-color, var(--color-primary)) 22%,
      transparent
    );
  }
}
</style>
