<script setup lang="ts">
import Modal from './Modal.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{
  modelValue: boolean;
  category?: string;
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
  <Modal :model-value="modelValue" title="Als Heimatort festlegen?" @update:model-value="close">
    <div class="home-region-warning-modal">
      <div class="home-region-warning-icon-wrap" aria-hidden="true">
        <span class="icon-bubble icon-bubble--warning">
          <AppIcon :icon="ACTION_ICONS.home" :size="24" group="actions" />
        </span>
      </div>
      <p class="home-region-warning-intro">
        Orte der Kategorie <strong>{{ category || 'Unterkunft' }}</strong> liegen üblicherweise an
        deinem Reiseziel in der Urlaubsregion.
      </p>
      <p class="home-region-warning-desc">
        Ein <strong>Heimatort</strong> wird in Reisotor als Start- oder Endpunkt (z.&nbsp;B. für An-
        und Abreise) außerhalb des Reiseziels behandelt. Er wird auf der Übersichtskarte separat
        geführt und nicht zum Urlaubsort gezählt.
      </p>
      <p class="home-region-warning-question">
        Möchtest du diesen Ort wirklich als Heimatort außerhalb der Urlaubsregion festlegen?
      </p>
      <ButtonGroup>
        <Button type="button" variant="secondary" class="btn-cancel" @click="close">
          Abbrechen
        </Button>
        <Button type="button" variant="primary" @click="handleConfirm">
          Ja, als Heimatort festlegen
        </Button>
      </ButtonGroup>
    </div>
  </Modal>
</template>

<style scoped>
.home-region-warning-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: center;
  padding: var(--space-2) 0;
}

.home-region-warning-icon-wrap {
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

.home-region-warning-intro {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--color-text);
}

.home-region-warning-desc {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.home-region-warning-question {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
}
</style>
