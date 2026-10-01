<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from './Modal.vue';
import Input from './primitives/Input.vue';
import Button from './primitives/Button.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';
import { CATEGORY_ICON_PALETTE, type CategoryIconOption } from '../utils/categoryIcons';
import { useIconStyleStore, type IconStyle } from '../stores/iconStyle';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    selectedIconId?: string | null;
    title?: string;
  }>(),
  {
    selectedIconId: null,
    title: 'Kategorie-Icon wählen',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'select', option: CategoryIconOption): void;
}>();

const iconStyleStore = useIconStyleStore();

// Toggle-Modus: Initialisiert mit der aktuellen Benutzer-Präferenz für Kategorien
const displayMode = ref<IconStyle>(iconStyleStore.styleForGroup('categories'));

// Wenn der Dialog geöffnet wird, Suchfeld leeren und Stil ggf. auffrischen
const searchQuery = ref('');
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      searchQuery.value = '';
      displayMode.value = iconStyleStore.styleForGroup('categories');
    }
  }
);

const MODE_OPTIONS = [
  { value: 'icons', label: 'Symbol' },
  { value: 'emoji', label: 'Emoji' },
];

const filteredIcons = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return CATEGORY_ICON_PALETTE;

  return CATEGORY_ICON_PALETTE.filter((opt) => {
    if (opt.label.toLowerCase().includes(q)) return true;
    if (opt.id.toLowerCase().includes(q)) return true;
    if (opt.defaultEmoji.includes(q)) return true;
    if (opt.keywords && opt.keywords.some((k) => k.toLowerCase().includes(q))) return true;
    return false;
  });
});

function handleSelect(opt: CategoryIconOption) {
  emit('select', opt);
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="title"
    size="lg"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="category-icon-picker">
      <!-- Obere Leiste: Suchfeld und Umschalter Symbol vs. Emoji -->
      <div class="picker-toolbar">
        <div class="search-wrapper">
          <Input
            v-model="searchQuery"
            type="search"
            placeholder="Icons durchsuchen (z. B. Hotel, Essen, Zug)..."
            aria-label="Icons filtern"
            class="picker-search-input"
          />
        </div>
        <div class="toggle-wrapper">
          <SegmentedToggle v-model="displayMode" :options="MODE_OPTIONS" />
        </div>
      </div>

      <!-- Icon-Grid -->
      <div
        v-if="filteredIcons.length > 0"
        class="icon-grid"
        role="listbox"
        aria-label="Icon-Auswahl"
      >
        <button
          v-for="opt in filteredIcons"
          :key="opt.id"
          type="button"
          class="icon-grid-item"
          :class="{ 'is-selected': selectedIconId === opt.id }"
          :title="opt.label"
          :aria-label="opt.label"
          :aria-selected="selectedIconId === opt.id"
          @click="handleSelect(opt)"
        >
          <span class="icon-visual-wrapper">
            <AppIcon :icon="opt.tabler" group="categories" :force-style="displayMode" :size="26" />
          </span>
          <span class="grid-icon-label">{{ opt.label }}</span>
        </button>
      </div>

      <!-- Leer-Zustand -->
      <div v-else class="empty-state">
        <p class="empty-text">Keine Icons für „{{ searchQuery }}“ gefunden.</p>
        <Button variant="ghost" size="sm" @click="searchQuery = ''"> Filter zurücksetzen </Button>
      </div>

      <!-- Footer mit Zähler und Schließen -->
      <div class="picker-footer">
        <span class="count-hint">
          {{ filteredIcons.length }} {{ filteredIcons.length === 1 ? 'Icon' : 'Icons' }}
        </span>
        <Button type="button" variant="ghost" size="sm" @click="emit('update:modelValue', false)">
          Abbrechen
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.category-icon-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.picker-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: space-between;
}

.search-wrapper {
  flex: 1 1 200px;
}

.picker-search-input {
  width: 100%;
}

.toggle-wrapper {
  flex-shrink: 0;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
  gap: var(--space-2);
  max-height: min(52vh, 420px);
  overflow-y: auto;
  padding: 4px;
  border-radius: var(--radius-md);
}

.icon-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  cursor: pointer;
  min-height: 74px;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.icon-grid-item:hover {
  border-color: var(--color-primary);
  background: var(--color-hover);
  transform: translateY(-1px);
}

.icon-grid-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.icon-grid-item.is-selected {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface, #ffffff));
  box-shadow: 0 0 0 1px var(--color-primary);
}

.icon-visual-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
}

.grid-icon-label {
  font-size: 0.72rem;
  text-align: center;
  color: var(--color-text);
  line-height: 1.2;
  word-break: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-2);
  gap: var(--space-2);
  text-align: center;
}

.empty-text {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: var(--space-2);
  margin-top: var(--space-1);
}

.count-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
