<script setup lang="ts">
import { computed, useId } from 'vue';
import { FORM_FIELD_ICONS, type FormFieldIconKey } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';

// Einheitlicher Feld-Wrapper für Anlege-/Bearbeiten-Formulare: Icon + kleines Label bleiben auch
// dann sichtbar, wenn das Feld schon einen Wert trägt (reine Beschriftung per placeholder
// verschwindet dann, siehe CLAUDE.md-Feedback dazu) – Icon/Label sind rein zusätzlich, das
// Eingabefeld selbst behält wie bisher sein placeholder als Beispiel-/Hinweistext.
// icon: entweder ein Konzept-Key aus FORM_FIELD_ICONS (Normalfall) oder ein fertiges IconDef für
// Einzelfälle ohne geteiltes Konzept - bewusst kein roher Emoji-String mehr (siehe DESIGN.md
// "Formularfelder"), damit jede Aufrufstelle zwischen Emoji/Tabler-Icons umschaltbar bleibt.
const props = defineProps<{
  icon?: FormFieldIconKey | IconDef;
  label: string;
  required?: boolean;
  error?: string;
  invalid?: boolean;
  modified?: boolean;
}>();

const isRequired = computed(() => Boolean(props.required || props.label.trim().endsWith('*')));
const displayLabel = computed(() => {
  const trimmed = props.label.trim();
  return trimmed.endsWith('*') ? trimmed.slice(0, -1).trim() : props.label;
});

const resolvedIcon = computed<IconDef | undefined>(() => {
  if (!props.icon) return undefined;
  return typeof props.icon === 'string' ? FORM_FIELD_ICONS[props.icon] : props.icon;
});

const id = useId();
</script>

<template>
  <div
    class="form-field"
    :class="{ 'has-error': Boolean(error || invalid), 'is-modified': modified }"
  >
    <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
    <label :for="id" class="form-field-label">
      <AppIcon
        v-if="resolvedIcon"
        class="form-field-icon"
        :size="15"
        :icon="resolvedIcon"
        group="formFields"
      />
      {{ displayLabel
      }}<span v-if="isRequired" class="required-indicator" aria-hidden="true">*</span>
      <span v-if="modified" class="modified-dot" title="Geändert" aria-label="Geändert" />
    </label>
    <slot :id="id" :invalid="Boolean(invalid || error)" :modified="modified" />
    <p v-if="error" class="field-error-hint" role="alert">
      <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.form-field:focus-within {
  position: relative;
  z-index: 10;
}

.form-field-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-field-icon {
  font-size: 0.95rem;
  line-height: 1;
}

.required-indicator {
  color: var(--color-danger, #ef4444);
  font-weight: 700;
  margin-left: 1px;
}

.field-error-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 2px 0 0;
  font-size: 0.8rem;
  color: var(--color-danger, #ef4444);
  font-weight: 500;
}

.form-field.is-modified .form-field-label {
  color: var(--color-accent-dark, var(--color-accent));
}

.modified-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-accent);
  margin-left: var(--space-1);
  flex-shrink: 0;
}

.form-field.is-modified :deep(.input),
.form-field.is-modified :deep(.select),
.form-field.is-modified :deep(.textarea),
.form-field.is-modified :deep(input:not([type='checkbox']):not([type='radio'])),
.form-field.is-modified :deep(select),
.form-field.is-modified :deep(textarea) {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 1px var(--color-accent);
}
</style>
