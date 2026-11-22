<script setup lang="ts">
import Modal from './Modal.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';

import CheckboxCard from './primitives/CheckboxCard.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { usePersistedRef } from '../composables/usePersistedRef';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm'): void;
}>();

const trackWarningDismissed = usePersistedRef<boolean>(
  'reisotor-track-recording-warning-acknowledged',
  false
);

function close() {
  emit('update:modelValue', false);
}

function handleConfirm() {
  emit('confirm');
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal :model-value="modelValue" title="Weg aufzeichnen" @update:model-value="close">
    <div class="track-warning-modal">
      <p class="track-warning-intro">
        Reisotor zeichnet deinen Weg während des Ausflugs auf. Bitte beachte:
      </p>
      <div class="track-warning-points">
        <div class="track-warning-point">
          <h4>
            <AppIcon :icon="ACTION_ICONS.myLocation" :size="15" group="actions" />
            Standort-Berechtigung
          </h4>
          <p>Dein Browser benötigt die Berechtigung, auf deinen Standort zuzugreifen.</p>
        </div>
        <div class="track-warning-point">
          <h4>
            <AppIcon :icon="ACTION_ICONS.history" :size="15" group="actions" /> App geöffnet lassen
          </h4>
          <p>
            Reisotor hält den Bildschirm während der Aufzeichnung automatisch aktiv (Wake Lock).
            Wird der Bildschirm manuell gesperrt oder die App beendet, kann die Aufzeichnung vom
            Browser unterbrochen werden.
          </p>
        </div>
      </div>
      <CheckboxCard
        id="auto-id-1788301175439-10"
        v-model="trackWarningDismissed"
        label="Diesen Hinweis nicht mehr anzeigen"
        variant="card"
        class="track-warning-dismiss"
      />
      <ButtonGroup no-margin class="actions-row">
        <Button type="button" variant="secondary" class="btn-cancel" @click="close">
          Abbrechen
        </Button>
        <Button type="button" @click="handleConfirm"> Aufzeichnung starten </Button>
      </ButtonGroup>
    </div>
  </Modal>
</template>

<style lang="scss" scoped>
.track-warning-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.track-warning-modal .track-warning-intro {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text);
}

.track-warning-modal .track-warning-points {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin: 0;
}

.track-warning-dismiss.checkbox-card--card {
  margin: 0;
  padding: var(--space-lg);
}

.track-warning-modal .track-warning-point h4 {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.track-warning-modal .track-warning-point p {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text-muted);
}
</style>
