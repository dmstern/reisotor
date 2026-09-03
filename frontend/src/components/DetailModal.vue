<script setup lang="ts">
import Modal from './Modal.vue';
import SpotImageCollage from './SpotImageCollage.vue';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

const actionIcons = ACTION_ICONS;

// Dünner Wrapper um Modal.vue für Read-Only-Detail-Ansichten (Ausflug/Spot/Unterkunft/Reise):
// Bild als echtes Vollbild-Banner (Bleed über Modal.vue's eigenes Padding hinaus), Titel + optionale
// Meta-Infos (Autor, Status, Zeitraum, …) als Overlay darüber – wie beim Urlaubsbanner im
// Dashboard. Bearbeiten-Button links, Schließen-Button rechts (konsistent mit Spot-Cards und
// üblichen Dialog-Konventionen).
defineProps<{
  modelValue: boolean;
  title: string;
  imageUrl?: string | null;
  /** Fallback für Objekte ohne eigenes Bild (z. B. ein Ausflug ohne image_url): Foto-Collage aus
   *  den Bildern zugeordneter Spots (SpotImageCollage.vue) statt nur des Platzhalter-Icons – nur
   *  relevant, wenn imageUrl fehlt. */
  collageImages?: string[];
  placeholderIcon?: IconDef;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'edit'): void }>();
</script>

<template>
  <Modal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    hide-header
    :aria-label="title"
  >
    <template #default="{ close }">
      <div class="detail-hero" :style="imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}">
        <SpotImageCollage
          v-if="!imageUrl && collageImages && collageImages.length > 0"
          :images="collageImages"
        />
        <AppIcon
          v-else-if="!imageUrl && placeholderIcon"
          class="placeholder"
          :size="45"
          :icon="placeholderIcon"
          group="categories"
        />
        <IconButton
          variant="ghost"
          class="detail-edit-btn"
          :icon="actionIcons.edit"
          size="sm"
          title="Bearbeiten"
          aria-label="Bearbeiten"
          @click="emit('edit')"
        />
        <IconButton
          variant="ghost"
          class="detail-close-btn"
          :icon="actionIcons.close"
          size="sm"
          title="Schließen"
          aria-label="Schließen"
          @click="close"
        />
        <div class="detail-hero-overlay">
          <h2 class="detail-title">{{ title }}</h2>
          <div class="detail-meta" v-if="$slots.meta"><slot name="meta" /></div>
        </div>
      </div>
      <div class="detail-body">
        <slot />
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.detail-hero {
  position: relative;
  /* Bleed über Modal.vue's eigenes Padding (var(--space-4)) hinaus, damit das Bild wirklich
     randlos bis an Modal-Rand/-Ecken reicht statt mit Abstand ringsum zu "schweben". */
  margin: calc(-1 * var(--space-4)) calc(-1 * var(--space-4)) var(--space-3);
  height: 200px;
  background: var(--color-primary-tint) center/cover no-repeat;
  border-radius: var(--radius-md-squircle) var(--radius-md-squircle) 0 0;
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Dunkler Verlauf für Lesbarkeit von Titel/Meta – unabhängig davon, ob ein echtes Foto oder nur
   die Platzhalter-Fläche darunter liegt (gleicher Ansatz wie beim Urlaubsbanner im Dashboard). */
.detail-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05) 40%, rgba(0, 0, 0, 0.62));
}

.placeholder {
  position: relative;
  font-size: 2.8rem;
}

.detail-edit-btn,
.detail-close-btn {
  position: absolute;
  top: 10px;
  z-index: 1;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  corner-shape: round;
  border: none;
  background: rgba(35, 34, 32, 0.75);
  color: #f2efe9;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.95rem;
}

.detail-edit-btn:hover,
.detail-close-btn:hover {
  background: rgba(35, 34, 32, 0.92);
}

.detail-edit-btn {
  left: 10px;
}

.detail-close-btn {
  right: 10px;
}

.detail-hero-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: var(--space-3);
  padding-right: 44px;
  z-index: 1;
}

.detail-title {
  margin: 0 0 4px;
  font-size: 1.15rem;
  color: #fff;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  font-size: 0.8rem;
  color: #f2efe9;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
