<script setup lang="ts">
import { computed, ref } from 'vue';
import Combobox from './Combobox.vue';
import AppIcon from './AppIcon.vue';
import { useBudgetStore } from '../stores/budget';
import { useSpotsStore } from '../stores/spots';
import { useTripCategoriesStore } from '../stores/tripCategories';
import { useTripStore } from '../stores/trip';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

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
    showManageLink?: boolean;
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
    showManageLink: true,
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
const tripCategoriesStore = useTripCategoriesStore();
const tripStore = useTripStore();

function onManageCategories() {
  comboboxRef.value?.close();
  tripStore.requestEditTrip('categories', props.type);
}

const computedOptions = computed(() => {
  if (props.options) return props.options;
  if (props.type === 'expense') {
    return budgetStore.expenseCategories.length > 0
      ? budgetStore.expenseCategories
      : tripCategoriesStore.activeExpenseCategories;
  }
  return spotsStore.spotCategories.length > 0
    ? spotsStore.spotCategories
    : tripCategoriesStore.activeSpotCategories;
});

function iconDefFor(category: string) {
  return tripCategoriesStore.categoryMeta(category, props.type).tabler;
}

function colorFor(category: string) {
  return tripCategoriesStore.categoryMeta(category, props.type).color;
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
  >
    <template v-if="showManageLink && tripStore.currentTrip" #footer>
      <button
        type="button"
        class="category-combobox-manage-btn"
        data-testid="category-combobox-manage-btn"
        @mousedown.prevent="onManageCategories"
        @click="onManageCategories"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.category" :size="14" group="formFields" />
        <span>Kategorien verwalten</span>
      </button>
    </template>
  </Combobox>
</template>

<style scoped>
.category-combobox-manage-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  box-shadow: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.category-combobox-manage-btn:hover,
.category-combobox-manage-btn:focus-visible {
  background: var(--color-hover);
  color: var(--color-text);
  outline: none;
}
</style>
