<script setup lang="ts">
import { computed, useId } from 'vue';
import type { TrackVisibility } from '../api/types';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import Alert from './primitives/Alert.vue';
import Badge from './primitives/Badge.vue';
import RadioCard from './primitives/RadioCard.vue';

// ItemVisibilitySettings.vue: Wiederverwendbare Berechtigungs- und Sichtbarkeits-Einstellung
// für Urlaubs-Objekte (Aufzeichnungen/Tracks, Spots, Touren etc.). Nutzt die Primitives
// RadioCard, Badge und Alert für einheitliche Farben, Abstände und Barrierefreiheit.

export interface ItemVisibilityOption {
  value: TrackVisibility;
  label: string;
  description: string;
  badge: string;
  icon: IconDef;
}

const props = withDefaults(
  defineProps<{
    modelValue: TrackVisibility;
    itemLabel?: string;
    disabled?: boolean;
    showHint?: boolean;
    modified?: boolean;
  }>(),
  {
    itemLabel: 'Aufzeichnung',
    disabled: false,
    showHint: true,
    modified: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: TrackVisibility): void;
  (e: 'change', value: TrackVisibility): void;
}>();

const groupName = `visibility-${useId()}`;

const options = computed<ItemVisibilityOption[]>(() => [
  {
    value: 'private',
    label: 'Nur für mich sichtbar',
    description: `Nur du kannst diese ${props.itemLabel} sehen und verwalten. Mitreisende haben keinen Zugriff darauf.`,
    badge: 'Privat',
    icon: ACTION_ICONS.private,
  },
  {
    value: 'shared',
    label: 'Für alle Mitreisenden sichtbar',
    description: `Alle Mitglieder dieses Urlaubs können diese ${props.itemLabel} auf der Karte und in Touren sehen.`,
    badge: 'Geteilt',
    icon: ACTION_ICONS.shared,
  },
]);

function onSelect(val: unknown) {
  if (props.disabled || (val !== 'private' && val !== 'shared')) {
    return;
  }

  if (props.modelValue === val) {
    return;
  }

  emit('update:modelValue', val);
  emit('change', val);
}
</script>

<template>
  <div class="visibility-settings" role="radiogroup" aria-label="Sichtbarkeit auswählen">
    <div class="visibility-intro">
      <span class="visibility-intro-title">Sichtbarkeit in der Reisegruppe</span>
      <p class="visibility-intro-desc">
        Lege fest, wer in deiner Reisegruppe Zugriff auf diese {{ itemLabel }} hat.
      </p>
    </div>

    <div class="visibility-cards">
      <RadioCard
        v-for="opt in options"
        :key="opt.value"
        :model-value="modelValue"
        :name="groupName"
        :value="opt.value"
        :label="opt.label"
        :description="opt.description"
        :icon="opt.icon"
        :disabled="disabled"
        variant="card"
        radio-position="right"
        radio-size="sm"
        class="visibility-card"
        @update:model-value="onSelect"
      >
        <template #badge>
          <Badge :variant="modelValue === opt.value ? 'primary' : 'default'" size="sm">
            {{ opt.badge }}
          </Badge>
        </template>
      </RadioCard>
    </div>

    <Alert
      v-if="showHint"
      variant="info"
      size="md"
      :icon="ACTION_ICONS.history"
      class="visibility-hint-alert"
    >
      Private Aufzeichnungen können jederzeit nachträglich für Mitreisende freigegeben werden.
    </Alert>
  </div>
</template>

<style scoped lang="scss">
.visibility-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.visibility-intro {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.visibility-intro-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.visibility-intro-desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.visibility-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.visibility-hint-alert {
  padding: var(--space-3) var(--space-4);
}
</style>
