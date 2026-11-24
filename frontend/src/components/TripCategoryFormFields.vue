<script setup lang="ts">
import {
  CATEGORY_COLOR_PALETTE,
  findCategoryIcon,
  getCategoryIconDef,
} from '../utils/categoryIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
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

const props = withDefaults(
  defineProps<{
    modelValue: CategoryFormData;
    activeType: 'expense' | 'spot';
    inputNameId?: string;
    showPreview?: boolean;
    modifiedFields?: {
      name?: boolean;
      icon?: boolean;
      color?: boolean;
    };
  }>(),
  {
    showPreview: true,
  }
);

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
    <div v-if="showPreview" class="preview-row">
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
      <FormField
        :id="inputNameId"
        v-slot="{ id: fieldId, modified }"
        icon="title"
        label="Name"
        required
        :modified="modifiedFields?.name"
      >
        <Input
          :id="fieldId"
          :model-value="modelValue.name"
          type="text"
          placeholder="z. B. Souvenirs oder Bootsverleih"
          required
          :modified="modified"
          @update:model-value="(val) => updateField('name', String(val))"
          @keydown.enter.prevent="$emit('submit')"
        />
      </FormField>

      <div class="icon-picker-field" :class="{ 'is-modified': modifiedFields?.icon }">
        <span class="field-label">
          Icon
          <span
            v-if="modifiedFields?.icon"
            class="modified-dot"
            title="Geändert"
            aria-label="Geändert"
          />
        </span>
        <Button
          variant="secondary"
          size="md"
          class="icon-selector-btn"
          :class="{ 'is-modified': modifiedFields?.icon }"
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
        </Button>
      </div>

      <div class="color-palette-field" :class="{ 'is-modified': modifiedFields?.color }">
        <span class="field-label">
          Farbe
          <span
            v-if="modifiedFields?.color"
            class="modified-dot"
            title="Geändert"
            aria-label="Geändert"
          />
        </span>
        <div class="color-swatch-wrap" :class="{ 'is-modified': modifiedFields?.color }">
          <ColorSwatchPicker
            :model-value="modelValue.color"
            :colors="CATEGORY_COLOR_PALETTE"
            @update:model-value="(val) => updateField('color', val)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
  @include surface-sunken-box;
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.icon-picker-field.is-modified .field-label,
.color-palette-field.is-modified .field-label {
  color: var(--color-success-dark, var(--color-success));
}

.modified-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background-color: var(--color-success);
  flex-shrink: 0;
}

.icon-picker-field,
.color-palette-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.icon-selector-btn.is-modified {
  @include control-modified-outline;
}

.color-swatch-wrap {
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: var(--space-xs);
}

.color-swatch-wrap.is-modified {
  @include control-modified-outline;
}

.icon-selector-btn {
  justify-content: flex-start;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  text-align: left;
  width: 100%;
}

.icon-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
