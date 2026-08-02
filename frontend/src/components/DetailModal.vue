<script setup lang="ts">
import Modal from './Modal.vue';
import SpotImageCollage from './SpotImageCollage.vue';

// Dünner Wrapper um Modal.vue für Read-Only-Detail-Ansichten (Ausflug/Spot/Unterkunft/Reise):
// Bild als echtes Vollbild-Banner (Bleed über Modal.vue's eigenes Padding hinaus), Titel + optionale
// Meta-Infos (Autor, Status, Zeitraum, …) als Overlay darüber – wie beim Urlaubsbanner im
// Dashboard. Bearbeiten-Button schwebt fest oben rechts übers Bild, konsistent in allen vier
// Detail-Dialogen (Ausflug/Spot/Unterkunft/Reise), statt an jeder Verwendungsstelle einzeln in
// den Aktionen unten zu stehen.
defineProps<{
  modelValue: boolean;
  title: string;
  imageUrl?: string | null;
  /** Fallback für Objekte ohne eigenes Bild (z. B. ein Ausflug ohne image_url): Foto-Collage aus
   *  den Bildern zugeordneter Spots (SpotImageCollage.vue) statt nur des Platzhalter-Icons – nur
   *  relevant, wenn imageUrl fehlt. */
  collageImages?: string[];
  placeholderIcon?: string;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void; (e: 'edit'): void }>();
</script>

<template>
  <Modal :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)" hide-header>
    <template #default="{ close }">
      <div class="detail-hero" :style="imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}">
        <SpotImageCollage v-if="!imageUrl && collageImages && collageImages.length > 0" :images="collageImages" />
        <span v-else-if="!imageUrl" class="placeholder">{{ placeholderIcon }}</span>
        <button type="button" class="detail-close-btn" title="Schließen" aria-label="Schließen" @click="close">✕</button>
        <button type="button" class="detail-edit-btn" title="Bearbeiten" aria-label="Bearbeiten" @click="emit('edit')">
          ✎
        </button>
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
  border-radius: var(--radius-md) var(--radius-md) 0 0;
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
  right: 10px;
}

/* Links statt rechts (üblicher Platz für einen Schließen-Button): Modal.vue's eigener Close-Button
   ist hier bewusst ausgeblendet (hide-header), da die normale .modal-head-Zeile eine Lücke über
   dem randlosen Bild-Banner offen ließe – dieser Button übernimmt seine Funktion. Rechts oben
   bleibt für den Bearbeiten-Button reserviert (App-weite Konvention, siehe DetailModal-Header-
   Kommentar oben). */
.detail-close-btn {
  left: 10px;
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
