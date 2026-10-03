<script setup lang="ts">
import {
  CATEGORY_COLOR_PALETTE,
  findCategoryIcon,
  getCategoryIconDef,
} from '../utils/categoryIcons';
import AppIcon from './AppIcon.vue';
import Input from './primitives/Input.vue';
import FormField from './FormField.vue';
import CategoryChip from './CategoryChip.vue';
import ColorSwatchPicker from './primitives/ColorSwatchPicker.vue';

export interface CategoryFormData {
  name: string;
  icon: string;
  emoji: string;
  color: string;
}

const props = defineProps<{
  modelValue: CategoryFormData;
  activeType: 'expense' | 'spot';
  inputNameId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: CategoryFormData): void;
  (e: 'open-icon-picker'): void;
  (e: 'submit'): void;
}>();

function updateField<K extends keyof CategoryFormData>(field: K, val: CategoryFormData[K]) {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: val,
  });
}
</script>

<template>
  <div class="trip-category-form-fields">
    <!-- Vorschau-Zeile -->
    <div class="preview-row">
      <span class="preview-label">Vorschau:</span>
      <CategoryChip
        :category="modelValue.name || 'Kategorie-Name'"
        :type="activeType"
        :custom-meta="{
          label: modelValue.name || 'Kategorie-Name',
          icon: modelValue.emoji,
          color: modelValue.color,
          tabler: getCategoryIconDef(modelValue.icon, modelValue.emoji),
        }"
      />
    </div>

    <!-- Formular-Felder -->
    <div class="form-grid">
      <FormField v-slot="{ id: fieldId }" icon="title" label="Name" required>
        <Input
          :id="inputNameId || fieldId"
          :model-value="modelValue.name"
          type="text"
          placeholder="z. B. Souvenirs oder Bootsverleih"
          required
          @update:model-value="(val) => updateField('name', String(val))"
          @keydown.enter.prevent="$emit('submit')"
        />
      </FormField>

      <div class="icon-picker-field">
        <span class="field-label">Icon</span>
        <button
          type="button"
          class="icon-selector-btn"
          title="Icon auswählen"
          aria-label="Icon auswählen"
          @click="$emit('open-icon-picker')"
        >
          <AppIcon
            :icon="getCategoryIconDef(modelValue.icon, modelValue.emoji)"
            group="categories"
            :size="18"
          />
          <span class="icon-name">{{
            findCategoryIcon(modelValue.icon, modelValue.emoji)?.label ?? 'Icon auswählen'
          }}</span>
        </button>
      </div>

      <div class="color-palette-field">
        <span class="field-label">Farbe</span>
        <ColorSwatchPicker
          :model-value="modelValue.color"
          :colors="CATEGORY_COLOR_PALETTE"
          @update:model-value="(val) => updateField('color', val)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.trip-category-form-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-hover);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.preview-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-1);
  display: block;
}

.icon-picker-field,
.color-palette-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.icon-selector-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  min-height: 44px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  text-align: left;
  width: 100%;
  box-shadow: none;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.icon-selector-btn:hover {
  border-color: var(--color-primary);
  background: var(--color-hover);
  box-shadow: var(--shadow-sm);
}

.icon-selector-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.icon-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
