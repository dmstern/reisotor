<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{ modelValue: string; options: string[]; placeholder?: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

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
  open.value = false;
}

function onBlur() {
  // Verzögert schließen: blur feuert vor dem click der Dropdown-Optionen, ohne die Verzögerung
  // würde die Liste verschwinden, bevor der Klick auf eine Option registriert wird.
  window.setTimeout(() => {
    open.value = false;
  }, 150);
}
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
}

.options li {
  padding: 6px 10px;
  font-size: 0.9rem;
  cursor: pointer;
}

.options li:hover {
  background: var(--color-hover);
}
</style>
