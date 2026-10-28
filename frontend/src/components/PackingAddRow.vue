<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PackingListGroup } from '../composables/usePackingList';
import { useAuthStore } from '../stores/auth';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useToast } from '../composables/useToast';
import QuickAddRow from './QuickAddRow.vue';
import Combobox from './Combobox.vue';
import Input from './primitives/Input.vue';
import DraftStatusBar from './DraftStatusBar.vue';

const props = withDefaults(
  defineProps<{
    list: PackingListGroup;
    placeholder?: string;
    categories: string[];
    subcategories: string[];
    categoryRequired?: boolean;
    defaultCategory?: string;
  }>(),
  {
    placeholder: 'Neuer Gegenstand',
    categoryRequired: false,
    defaultCategory: 'Sonstiges',
  }
);

const emit = defineEmits<{
  (
    e: 'submit',
    payload: {
      label: string;
      category?: string;
      subcategory?: string;
      quantity: number;
    }
  ): void;
}>();

const auth = useAuthStore();
const { showToast } = useToast();

const label = ref('');
const category = ref(props.categoryRequired ? (props.defaultCategory ?? 'Sonstiges') : '');
const subcategory = ref('');
const quantity = ref(1);

watch(
  () => props.categoryRequired,
  (req) => {
    if (req && !category.value) {
      category.value = props.defaultCategory ?? 'Sonstiges';
    }
  },
  { immediate: true }
);

const formBundle = computed<Record<string, unknown>>({
  get: () => ({
    label: label.value,
    category: category.value,
    subcategory: subcategory.value,
    quantity: quantity.value,
  }),
  set: (v) => {
    label.value = (v.label as string) ?? '';
    category.value =
      (v.category as string) ??
      (props.categoryRequired ? (props.defaultCategory ?? 'Sonstiges') : '');
    subcategory.value = (v.subcategory as string) ?? '';
    quantity.value = typeof v.quantity === 'number' ? v.quantity : 1;
  },
});

const draftKey = computed(() => {
  if (props.list.ownerId != null && props.list.ownerId === auth.user?.id) {
    return 'packing:new';
  }
  if (props.list.key === 'shared') {
    return 'packing:new:shared';
  }
  return `packing:new:${props.list.key}`;
});

const draft = useDraftAutosave(draftKey, formBundle, ref(true));

function handleSubmit(submittedLabel: string) {
  const trimmed = submittedLabel.trim();
  if (!trimmed) return;
  const cat = category.value.trim();
  if (props.categoryRequired && !cat) return;

  emit('submit', {
    label: trimmed,
    category: cat || undefined,
    subcategory: subcategory.value.trim() || undefined,
    quantity: Math.max(1, Math.round(quantity.value) || 1),
  });

  label.value = '';
  subcategory.value = '';
  quantity.value = 1;
  draft.clear();
}

function discardDraft() {
  label.value = '';
  subcategory.value = '';
  quantity.value = 1;
  category.value = props.categoryRequired ? (props.defaultCategory ?? 'Sonstiges') : '';
  draft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
}
</script>

<template>
  <QuickAddRow
    v-model="label"
    class="card add-form"
    :placeholder="placeholder"
    :force-expanded="draft.isDirty.value || draft.status.value !== 'idle'"
    @submit="handleSubmit"
  >
    <template #extra>
      <div class="pack-quick-extra">
        <Combobox v-model="category" :options="categories" placeholder="Kategorie" size="sm" />
        <Combobox
          v-model="subcategory"
          :options="subcategories"
          placeholder="Unterkategorie"
          size="sm"
        />
        <label :for="`quick-add-qty-${list.key}`" class="qty-field quick-add-qty">
          <Input
            :id="`quick-add-qty-${list.key}`"
            v-model.number="quantity"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            placeholder="1"
            size="sm"
          />
        </label>
      </div>
    </template>
    <template #footer>
      <DraftStatusBar
        :status="draft.status.value"
        :restored="draft.restored.value"
        :can-discard="true"
        @discard="discardDraft"
      />
    </template>
  </QuickAddRow>
</template>

<style scoped>
.pack-quick-extra {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  width: 100%;
}

.pack-quick-extra :deep(.combobox) {
  flex: 1 1 110px;
  min-width: 90px;
}

.quick-add-qty {
  flex: 0 0 auto;
  margin: 0;
}

.quick-add-qty input,
.quick-add-qty :deep(input) {
  width: 56px;
  height: 36px;
  min-height: 36px;
  padding: 4px 8px;
  font-size: 0.85rem;
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-sizing: border-box;
}

.quick-add-qty input:focus,
.quick-add-qty :deep(input:focus) {
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 1px;
}
</style>
