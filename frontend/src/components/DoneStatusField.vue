<script setup lang="ts">
import FormField from './FormField.vue';
import DoneToggle from './primitives/DoneToggle.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

withDefaults(
  defineProps<{
    /** Ob das Element als erledigt/besucht markiert ist */
    done: boolean;
    /** Ob das Element teilweise besucht ist (z. B. 1 von 2 Besuchstagen bei Spots) */
    partiallyDone?: boolean;
    /** Ob mindestens ein Datum eingeplant ist */
    planned?: boolean;
    /** Label des Formularfelds (Standard: "Status") */
    fieldLabel?: string;
    /** Beschriftung des Toggle-Buttons (z. B. "Gemacht" oder "Besucht") */
    toggleLabel: string;
    /** Optionaler kurzer Kontext-Hinweis neben dem Toggle */
    statusHint?: string;
    /** Ob der Status gegenüber dem gespeicherten Stand geändert wurde */
    modified?: boolean;
    /** Deaktiviert das Umschalten (z. B. wenn der Status über eine erledigte Tour vorgegeben ist) */
    disabled?: boolean;
    /** Barrierefreie Beschreibung des Buttons */
    ariaLabel?: string;
    /** Tooltip für den Button */
    title?: string;
  }>(),
  {
    partiallyDone: false,
    planned: false,
    fieldLabel: 'Status',
    statusHint: undefined,
    modified: false,
    disabled: false,
    ariaLabel: undefined,
    title: undefined,
  }
);

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();
</script>

<template>
  <FormField
    :icon="ACTION_ICONS.done"
    :label="fieldLabel"
    :modified="modified"
    class="done-status-field"
    v-slot="{ id }"
  >
    <div class="done-status-field-row">
      <DoneToggle
        :id="id"
        size="field"
        :done="done"
        :partially-done="partiallyDone"
        :planned="planned"
        :disabled="disabled"
        :aria-label="ariaLabel"
        :title="title"
        @click="emit('toggle')"
      >
        {{ toggleLabel }}
      </DoneToggle>
      <span v-if="statusHint" class="done-status-field-hint">{{ statusHint }}</span>
    </div>
  </FormField>
</template>

<style scoped lang="scss">
.done-status-field-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
}

.done-status-field-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.35;
  min-width: 0;
}
</style>
