<script setup lang="ts">
import { computed, useId } from 'vue';
import { FORM_FIELD_ICONS, type FormFieldIconKey } from '../utils/formFieldIcons';
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
  <div class="form-field">
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
    </label>
    <slot :id="id" />
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-field:focus-within {
  position: relative;
  z-index: 10;
}

.form-field-label {
  display: flex;
  align-items: center;
  gap: 4px;
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
</style>
