<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from './primitives/Button.vue';
import Accordion from './primitives/Accordion.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Wiederverwendbare Inline-Quick-Add-Zeile für Listen (Einkauf, ToDo, Packliste):
// Im Ruhezustand eine dezente, einladende Eingabekapsel mit Plus-Icon.
// Bei Fokus/Eingabe expandiert die Zeile zu einem voll bedienbaren Formularfeld inklusive
// integriertem Papierflieger-Absenden-Button (ACTION_ICONS.send) und optionalen Zusatzfeldern
// (Slot "extra", z. B. Shop/Zeitraum bei Einkauf, Zuweisung/Priorität bei ToDo) mit sauber
// an der linken Fluchtlinie ausgerichteten Dropdowns (siehe DESIGN.md).
const props = withDefaults(defineProps<{ placeholder?: string; disabled?: boolean }>(), {
  placeholder: 'Hinzufügen…',
  disabled: false,
});
const emit = defineEmits<{ (e: 'submit', label: string): void }>();

const label = ref('');
const focused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const formRef = ref<HTMLFormElement | null>(null);

const expanded = computed(() => focused.value || label.value.trim().length > 0);

function submit() {
  const trimmed = label.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed);
  label.value = '';
  inputRef.value?.focus();
}

function onBlur(event: FocusEvent) {
  // Springt der Fokus direkt auf ein Zusatzfeld im "extra"-Slot (z. B. Kategorie/Unterkategorie),
  // trägt relatedTarget das bereits - dann sofort nicht einklappen. Ohne diese Prüfung riss ein
  // Klick/Tab direkt in ein noch-leeres Zusatzfeld (Label selbst noch nie befüllt) die Zeile wieder
  // ein, noch bevor der Timeout unten greifen konnte, und das gerade fokussierte Feld verschwand samt
  // Fokus mitten in der Eingabe (siehe Bug 126).
  const next = event.relatedTarget as Node | null;
  if (next && formRef.value?.contains(next)) return;
  // Leichte Verzögerung: ein Klick auf ein Zusatzfeld im "extra"-Slot (z. B. ein <select>) löst vorher
  // ein blur auf diesem Eingabefeld aus - ohne Verzögerung würde die Zeile schon einklappen, bevor
  // die Auswahl im Zusatzfeld ankommt.
  window.setTimeout(() => {
    if (!label.value.trim() && !formRef.value?.contains(document.activeElement))
      focused.value = false;
  }, 150);
}
</script>

<template>
  <form ref="formRef" class="quick-add-row" :class="{ expanded }" @submit.prevent="submit">
    <div class="input-container">
      <AppIcon
        :icon="ACTION_ICONS.add"
        :size="16"
        group="actions"
        class="leading-icon"
        aria-hidden="true"
      />
      <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
      <input
        ref="inputRef"
        v-model="label"
        type="text"
        class="label-input"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @focus="focused = true"
        @blur="onBlur"
      />
      <Transition name="quick-add-btn">
        <Button
          v-if="expanded"
          type="submit"
          class="submit-btn"
          variant="primary"
          size="sm"
          :icon="ACTION_ICONS.send"
          :disabled="!label.trim()"
          aria-label="Hinzufügen"
          title="Hinzufügen"
        />
      </Transition>
    </div>

    <!-- Eigene Zeile für Zusatzfelder (Kategorie/Shop/Zeitraum/…):
         Bei Fokus sanft eingeblendet, bündig an der linken Fluchtlinie der Eingabekapsel ausgerichtet. -->
    <Accordion v-if="$slots.extra" :expanded="expanded" class="extra-fields-accordion">
      <div class="extra-fields">
        <slot name="extra" />
      </div>
    </Accordion>
  </form>
</template>

<style scoped>
.quick-add-row {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  transition:
    padding 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.quick-add-row.expanded {
  padding: 12px 14px;
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 42px;
  background: var(--color-hover);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.input-container:hover {
  border-color: var(--color-border-strong);
}

.quick-add-row.expanded .input-container,
.input-container:focus-within {
  background: var(--color-surface);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.leading-icon {
  margin-left: 10px;
  margin-right: 2px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  opacity: 0.65;
  transition:
    color 0.15s ease,
    opacity 0.15s ease;
}

.quick-add-row.expanded .leading-icon,
.input-container:focus-within .leading-icon {
  color: var(--color-primary);
  opacity: 1;
}

.label-input {
  flex: 1;
  min-width: 80px;
  border: none;
  background: transparent;
  padding: 9px 8px;
  /* Mindestens 16px (1rem, siehe style.css's globale input-Regel) - iOS Safari zoomt beim
     Fokussieren eines Eingabefelds automatisch rein, sobald dessen font-size darunter liegt. */
  font-size: 1rem;
  line-height: 1.4;
  color: var(--color-text);
  outline: none;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
}

.label-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.65;
}

.quick-add-row.expanded .label-input {
  /* Raum für den integrierten Absenden-Button auf der rechten Seite */
  padding-right: 42px;
}

.submit-btn {
  position: absolute;
  right: 5px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  translate: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    scale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.submit-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.submit-btn:hover:not(:disabled) {
  translate: none;
  scale: 1.05;
}

.submit-btn:active:not(:disabled) {
  translate: none;
  transform: none;
  scale: 0.95;
}

.quick-add-btn-enter-active,
.quick-add-btn-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    scale 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.quick-add-btn-enter-from,
.quick-add-btn-leave-to {
  opacity: 0;
  scale: 0.85;
}

.extra-fields-accordion {
  min-width: 0;
  width: 100%;
}

.extra-fields {
  display: flex;
  align-items: center;
  column-gap: var(--space-2);
  row-gap: var(--space-2);
  flex-wrap: wrap;
  /* Bündig an der linken Fluchtlinie der Eingabekapsel ausgerichtet */
  margin-left: 0;
  margin-top: var(--space-2);
  padding-top: 2px;
  padding-bottom: 2px;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.quick-add-row.expanded .extra-fields {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s,
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s;
}

@media (prefers-reduced-motion: reduce) {
  .quick-add-row,
  .submit-btn,
  .quick-add-btn-enter-active,
  .quick-add-btn-leave-active,
  .extra-fields {
    transition: none !important;
    transform: none !important;
    scale: 1 !important;
    opacity: 1 !important;
  }
}

.extra-fields :deep(select),
.extra-fields :deep(.select) {
  font-size: 0.85rem;
  height: 36px;
  min-height: 36px;
  padding: 6px 30px 6px 10px;
  background-position: right 8px center;
  background-size: 14px 14px;
  min-width: 0;
  width: auto;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.extra-fields :deep(.combobox) {
  min-width: 0;
  flex: 0 1 auto;
}

.extra-fields :deep(.combobox-input),
.extra-fields :deep(.combobox input),
.extra-fields :deep(.combobox .input) {
  font-size: 0.85rem;
  height: 36px;
  min-height: 36px;
  padding: 6px 28px 6px 10px;
  width: 100%;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.extra-fields :deep(.combobox-caret) {
  right: 8px;
}
</style>
