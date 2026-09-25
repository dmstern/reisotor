<script setup lang="ts">
import { computed, ref } from 'vue';
import Combobox from './Combobox.vue';
import { useBudgetStore } from '../stores/budget';
import { useSpotsStore } from '../stores/spots';
import { expenseCategoryMeta, EXPENSE_CATEGORY_SUGGESTIONS } from '../utils/expenseCategory';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    type?: 'expense' | 'spot';
    options?: string[];
    placeholder?: string;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    required?: boolean;
    invalid?: boolean;
    id?: string;
    name?: string;
  }>(),
  {
    modelValue: '',
    type: 'expense',
    size: 'md',
    disabled: false,
    required: false,
    invalid: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', value: string): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
}>();

const comboboxRef = ref<InstanceType<typeof Combobox> | null>(null);

const budgetStore = useBudgetStore();
const spotsStore = useSpotsStore();

const computedOptions = computed(() => {
  if (props.options) return props.options;
  if (props.type === 'expense') {
    return budgetStore.expenseCategories.length > 0
      ? budgetStore.expenseCategories
      : EXPENSE_CATEGORY_SUGGESTIONS;
  }
  const used = spotsStore.spots.map((s) => s.category).filter((c): c is string => !!c);
  return [...new Set([...SPOT_CATEGORY_SUGGESTIONS, ...used])];
});

function iconDefFor(category: string) {
  return props.type === 'expense'
    ? expenseCategoryMeta(category).tabler
    : spotCategoryMeta(category).tabler;
}

function colorFor(category: string) {
  return props.type === 'expense'
    ? expenseCategoryMeta(category).color
    : spotCategoryMeta(category).color;
}

const computedPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder;
  return props.type === 'expense'
    ? 'Kategorie (z. B. Essen & Trinken, Unterkunft)'
    : 'Kategorie (z. B. Restaurant – oder eigene erstellen)';
});

defineExpose({
  close: () => comboboxRef.value?.close(),
  focus: () => comboboxRef.value?.focus(),
});

defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <Combobox
    ref="comboboxRef"
    v-bind="$attrs"
    :id="id"
    :name="name"
    :model-value="modelValue"
    :options="computedOptions"
    :icon-def-for="iconDefFor"
    :color-for="colorFor"
    :placeholder="computedPlaceholder"
    :size="size"
    :disabled="disabled"
    :required="required"
    :invalid="invalid"
    @update:model-value="emit('update:modelValue', $event)"
    @select="emit('select', $event)"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  />
</template>
