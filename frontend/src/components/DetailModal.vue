<script setup lang="ts">
import Modal from './Modal.vue';

// Dünner Wrapper um Modal.vue für Read-Only-Detail-Ansichten (Ausflug/Spot/Unterkunft/Reise):
// Bild-Banner (oder Platzhalter-Icon) + Titel als erste Inhalte, danach der restliche
// Read-Only-Inhalt per Slot. Modal.vue bekommt bewusst keinen eigenen title, damit dort nur der
// Schließen-Button im Kopf erscheint – Bild+Titel sind hier stattdessen Teil des Bodys, damit das
// Bild randlos über die volle Modal-Breite reichen kann.
defineProps<{ modelValue: boolean; title: string; imageUrl?: string | null; placeholderIcon?: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>

<template>
  <Modal :model-value="modelValue" @update:model-value="(v) => emit('update:modelValue', v)">
    <div
      class="detail-image-banner"
      v-if="imageUrl || placeholderIcon"
      :style="imageUrl ? { backgroundImage: `url(${imageUrl})` } : {}"
    >
      <span v-if="!imageUrl" class="placeholder">{{ placeholderIcon }}</span>
    </div>
    <h2 class="detail-title">{{ title }}</h2>
    <slot />
  </Modal>
</template>
