<script setup lang="ts">
import { computed, ref } from 'vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import ImageUrlInput from './ImageUrlInput.vue';
import Modal from './Modal.vue';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    previewImage?: string | null;
    placeholderIcon?: IconDef;
    modalTitle?: string;
  }>(),
  {
    modelValue: '',
    previewImage: null,
    placeholderIcon: () => SECTION_ICON_DEFS.dashboard,
    modalTitle: 'Bild bearbeiten',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const showModal = ref(false);

const effectivePreview = computed(() => {
  if (props.modelValue) return props.modelValue;
  if (props.previewImage) return props.previewImage;
  return null;
});

function removeImage() {
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="cover-image-picker">
    <div
      class="form-image-banner"
      :style="effectivePreview ? { backgroundImage: `url(${effectivePreview})` } : {}"
    >
      <AppIcon
        v-if="!effectivePreview"
        class="placeholder"
        :size="35"
        :icon="placeholderIcon"
        group="navigation"
      />
      <div class="banner-actions">
        <Button type="button" variant="ghost" class="banner-edit-btn" @click="showModal = true">
          <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
          {{ modelValue ? 'Bild bearbeiten' : 'Bild hinzufügen' }}
        </Button>
        <Button
          v-if="modelValue"
          type="button"
          variant="ghost"
          class="banner-edit-btn remove"
          title="Bild entfernen"
          aria-label="Bild entfernen"
          @click="removeImage"
        >
          <AppIcon :icon="ACTION_ICONS.close" :size="13" group="actions" />
        </Button>
      </div>
    </div>

    <Modal
      :model-value="showModal"
      :title="modalTitle"
      @update:model-value="(v) => !v && (showModal = false)"
    >
      <div class="image-submodal">
        <ImageUrlInput
          :model-value="modelValue"
          @update:model-value="(val) => emit('update:modelValue', val)"
        />
        <ButtonGroup>
          <Button type="button" @click="showModal = false">Fertig</Button>
        </ButtonGroup>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.cover-image-picker {
  width: 100%;
}

.form-image-banner {
  position: relative;
  margin: 0 0 var(--space-2);
  height: 6rem;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  overflow: hidden;
}

.form-image-banner .placeholder {
  font-size: 2.5rem;
  margin: auto;
}

.form-image-banner .banner-actions {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  z-index: 1;
}

.banner-edit-btn {
  background: var(--color-surface) !important;
  color: var(--color-text) !important;
  font-size: 0.82rem;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.banner-edit-btn:hover {
  background: var(--color-hover) !important;
}

.banner-edit-btn.remove {
  color: var(--color-danger) !important;
}

.image-submodal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
