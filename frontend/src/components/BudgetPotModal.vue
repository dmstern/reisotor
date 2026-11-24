<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Budget } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useToast } from '../composables/useToast';

const props = defineProps<{
  modelValue: boolean;
  budget?: Budget | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
  (e: 'deleted'): void;
}>();

const budgetStore = useBudgetStore();
const auth = useAuthStore();
const tripStore = useTripStore();
const { showToast } = useToast();

const form = ref({
  name: '',
  kind: 'shared' as 'shared' | 'personal',
  target_amount: '',
});

const initialSnapshot = ref<{
  name: string;
  kind: 'shared' | 'personal';
  target_amount: string;
} | null>(null);

const isEdit = computed(() => Boolean(props.budget));
const modalTitle = computed(() => (isEdit.value ? 'Budget bearbeiten' : 'Budget anlegen'));

watch(
  () => [props.modelValue, props.budget] as const,
  ([isOpen, budget]) => {
    if (isOpen) {
      if (budget) {
        const initial = {
          name:
            budget.name === 'Gemeinsames Budget' && budgetStore.users.length <= 1
              ? 'Hauptbudget'
              : budget.name,
          kind: (budget.owner_id != null ? 'personal' : 'shared') as 'shared' | 'personal',
          target_amount: budget.target_amount != null ? String(budget.target_amount) : '',
        };
        form.value = { ...initial };
        initialSnapshot.value = initial;
      } else {
        form.value = { name: '', kind: 'shared', target_amount: '' };
        initialSnapshot.value = null;
      }
    } else {
      initialSnapshot.value = null;
    }
  },
  { immediate: true }
);

const isNameModified = computed(
  () => initialSnapshot.value !== null && form.value.name !== initialSnapshot.value.name
);
const isKindModified = computed(
  () => initialSnapshot.value !== null && form.value.kind !== initialSnapshot.value.kind
);
const isTargetAmountModified = computed(
  () =>
    initialSnapshot.value !== null &&
    String(form.value.target_amount) !== String(initialSnapshot.value.target_amount)
);

function handleClose() {
  emit('update:modelValue', false);
}

async function handleSubmit() {
  if (!form.value.name.trim()) {
    return;
  }

  if (isEdit.value && props.budget) {
    await budgetStore.updateBudget(props.budget.id, {
      name: form.value.name.trim(),
      owner_id: form.value.kind === 'personal' ? auth.user?.id : null,
      target_amount: form.value.target_amount ? Number(form.value.target_amount) : null,
    });
    showToast({ message: 'Budget aktualisiert.', type: 'success' });
  } else {
    const tripId = tripStore.currentTripId as number;
    await budgetStore.addBudget(tripId, {
      name: form.value.name.trim(),
      owner_id: form.value.kind === 'personal' ? auth.user?.id : undefined,
      target_amount: form.value.target_amount ? Number(form.value.target_amount) : undefined,
    });
    showToast({ message: 'Budget angelegt.', type: 'success' });
  }

  emit('update:modelValue', false);
  emit('saved');
}

async function handleDelete() {
  if (props.budget) {
    await budgetStore.removeBudget(props.budget.id);
    showToast({
      message: 'Budget gelöscht. Es befindet sich nun im Papierkorb.',
      type: 'info',
    });
  }

  emit('update:modelValue', false);
  emit('deleted');
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form add-form new-budget-form" @submit.prevent="handleSubmit">
      <FormField
        icon="title"
        label="Name"
        required
        :modified="isNameModified"
        v-slot="{ id, modified }"
      >
        <Input
          :id="id"
          v-model="form.name"
          type="text"
          placeholder="Name (z. B. Souvenirs)"
          required
          :modified="modified"
        />
      </FormField>

      <FormField
        v-if="budgetStore.users.length > 1"
        icon="visibility"
        label="Sichtbarkeit"
        :modified="isKindModified"
        v-slot="{ id, modified }"
      >
        <Select :id="id" v-model="form.kind" :modified="modified">
          <option value="shared">Geteilt (für alle im Urlaub sichtbar)</option>
          <option value="personal">Privat (nur für mich sichtbar)</option>
        </Select>
      </FormField>

      <FormField
        icon="amount"
        label="Gesamtziel"
        :modified="isTargetAmountModified"
        v-slot="{ id, modified }"
      >
        <Input
          :id="id"
          v-model="form.target_amount"
          type="number"
          inputmode="decimal"
          step="0.01"
          placeholder="Gesamtziel €"
          :modified="modified"
        />
      </FormField>

      <ButtonGroup no-margin class="actions-row">
        <Button
          v-if="isEdit"
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          @click="handleDelete"
        >
          Löschen
        </Button>
        <div v-if="isEdit" class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit">{{ isEdit ? 'Speichern' : 'Anlegen' }}</Button>
      </ButtonGroup>
    </form>
  </Modal>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-width: 0;
}
</style>
