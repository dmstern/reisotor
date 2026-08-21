<script setup lang="ts">
import { computed, ref } from 'vue';

// modelValue optional mit Default '': Aufrufer wie PackingListView.vue binden ein Record<string,
// string>, dessen Schlüssel erst existiert, sobald einmal in das jeweilige Feld reingetippt wurde –
// bis dahin liefert der Zugriff undefined. Als Pflicht-String deklariert warf .trim() darauf und riss
// das Rendering der Komponente ab (sichtbar als spontan verschwindendes/springendes Formularfeld).
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: string[];
    placeholder?: string;
    // Optionales Icon je Option (z. B. ein Kategorie-Icon aus spotCategory.ts) - rein für die
    // Dropdown-Liste, der gespeicherte Wert selbst bleibt reiner Text (kein eingebettetes Emoji),
    // damit ein case-insensitiver Lookup weiterhin einfach greift.
    iconFor?: (option: string) => string;
  }>(),
  { modelValue: '' },
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  // Zusätzlich zum modelValue-Update: erlaubt Aufrufern wie TourAssignPicker.vue, eine Auswahl aus
  // der Liste (im Gegensatz zu laufendem Freitext-Tippen) direkt zu übernehmen, ohne dafür einen
  // eigenen Bestätigen-Button vorzuhalten.
  (e: 'select', value: string): void;
}>();

const open = ref(false);

// Zeigt beim Klick auf das Feld sofort alle vorhandenen Kategorien an (statt wie beim alten
// <datalist>-Ansatz erst nach Tippen) und filtert dann live weiter, sobald getippt wird.
const filteredOptions = computed(() => {
  const q = props.modelValue.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.toLowerCase().includes(q));
});

function selectOption(option: string) {
  emit('update:modelValue', option);
  emit('select', option);
  open.value = false;
}

function onBlur() {
  // Verzögert schließen: blur feuert vor dem click der Dropdown-Optionen, ohne die Verzögerung
  // würde die Liste verschwinden, bevor der Klick auf eine Option registriert wird.
  window.setTimeout(() => {
    open.value = false;
  }, 150);
}

// Erlaubt Aufrufern wie TourAssignPicker.vue, die Liste nach einem per Enter übernommenen Eintrag
// aktiv zu schließen (#207) - ohne Fokuswechsel bliebe "open" sonst true und die Liste würde beim
// Zurücksetzen von modelValue auf '' erneut ungefiltert alle Optionen zeigen und darunterliegende
// Elemente überdecken.
defineExpose({ close: () => { open.value = false; } });
</script>

<template>
  <div class="combobox">
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @focus="open = true"
      @blur="onBlur"
    />
    <ul class="options" v-if="open && filteredOptions.length">
      <li v-for="option in filteredOptions" :key="option" @mousedown.prevent="selectOption(option)">
        <span v-if="iconFor" class="option-icon">{{ iconFor(option) }}</span>
        {{ option }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.combobox {
  position: relative;
  flex: 1;
  min-width: 140px;
}

.combobox input {
  width: 100%;
}

.options {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
}

.options li {
  padding: 6px 10px;
  font-size: 0.9rem;
  cursor: pointer;
}

.option-icon {
  display: inline-block;
  width: 1.3em;
}

.options li:hover {
  background: var(--color-hover);
}
</style>
