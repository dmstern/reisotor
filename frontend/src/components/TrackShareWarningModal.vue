<script setup lang="ts">
import Modal from './Modal.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{
  modelValue: boolean;
  trackTitle?: string | null;
  tourTitle?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();

function close() {
  emit('update:modelValue', false);
}

function handleConfirm() {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Aufzeichnung für Mitreisende freigeben"
    @update:model-value="close"
  >
    <div class="track-share-warning-modal">
      <div class="track-share-warning-icon-wrap" aria-hidden="true">
        <span class="icon-bubble icon-bubble--warning">
          <AppIcon :icon="ACTION_ICONS.shared" :size="24" group="actions" />
        </span>
      </div>
      <p class="track-share-warning-intro">
        Diese Aufzeichnung ist aktuell <strong>privat</strong> (nur für dich sichtbar).
      </p>
      <p class="track-share-warning-desc">
        Touren sind für alle Mitreisenden dieses Urlaubs einsehbar. Wenn du
        <template v-if="trackTitle">„{{ trackTitle }}“</template>
        <template v-else>diese Aufzeichnung</template>
        <template v-if="tourTitle"> der Tour „{{ tourTitle }}“</template>
        zuordnest, wird sie <strong>für alle Mitreisenden sichtbar</strong>.
      </p>
      <ButtonGroup>
        <Button type="button" variant="secondary" class="btn-cancel" @click="close">
          Abbrechen
        </Button>
        <Button type="button" @click="handleConfirm"> Verknüpfen & Teilen </Button>
      </ButtonGroup>
    </div>
  </Modal>
</template>

<style scoped>
.track-share-warning-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: center;
  padding: var(--space-2) 0;
}

.track-share-warning-icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-1);
}

.icon-bubble {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-full);
  background: var(--color-primary-tint);
  color: var(--color-primary);
}

.track-share-warning-intro {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--color-text);
}

.track-share-warning-desc {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
