<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Budget } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';

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

const form = ref({
  name: '',
  kind: 'shared' as 'shared' | 'personal',
  target_amount: '',
});

const isEdit = computed(() => Boolean(props.budget));
const modalTitle = computed(() => (isEdit.value ? 'Budget bearbeiten' : 'Budget anlegen'));

watch(
  () => [props.modelValue, props.budget] as const,
  ([isOpen, budget]) => {
    if (isOpen) {
      if (budget) {
        form.value = {
          name:
            budget.name === 'Gemeinsames Budget' && budgetStore.users.length <= 1
              ? 'Hauptbudget'
              : budget.name,
          kind: budget.owner_id != null ? 'personal' : 'shared',
          target_amount: budget.target_amount != null ? String(budget.target_amount) : '',
        };
      } else {
        form.value = { name: '', kind: 'shared', target_amount: '' };
      }
    }
  },
  { immediate: true }
);

function handleClose() {
  emit('update:modelValue', false);
}

async function handleSubmit() {
  if (!form.value.name.trim()) return;

  if (isEdit.value && props.budget) {
    await budgetStore.updateBudget(props.budget.id, {
      name: form.value.name.trim(),
      owner_id: form.value.kind === 'personal' ? auth.user?.id : null,
      target_amount: form.value.target_amount ? Number(form.value.target_amount) : null,
    });
  } else {
    const tripId = tripStore.currentTripId as number;
    await budgetStore.addBudget(tripId, {
      name: form.value.name.trim(),
      owner_id: form.value.kind === 'personal' ? auth.user?.id : undefined,
      target_amount: form.value.target_amount ? Number(form.value.target_amount) : undefined,
    });
  }

  emit('update:modelValue', false);
  emit('saved');
}

async function handleDelete() {
  if (props.budget) {
    await budgetStore.removeBudget(props.budget.id);
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
    <form class="edit-form" @submit.prevent="handleSubmit">
      <FormField icon="title" label="Name" required v-slot="{ id }">
        <Input
          :id="id"
          v-model="form.name"
          type="text"
          placeholder="Name (z. B. Souvenirs)"
          required
        />
      </FormField>

      <div v-if="budgetStore.users.length > 1" class="row">
        <FormField icon="visibility" label="Sichtbarkeit" v-slot="{ id }">
          <Select :id="id" v-model="form.kind">
            <option value="shared">Geteilt (für alle im Urlaub sichtbar)</option>
            <option value="personal">Privat (nur für mich sichtbar)</option>
          </Select>
        </FormField>
      </div>

      <FormField icon="amount" label="Gesamtziel" v-slot="{ id }">
        <Input
          :id="id"
          v-model="form.target_amount"
          type="number"
          inputmode="decimal"
          step="0.01"
          placeholder="Gesamtziel €"
        />
      </FormField>

      <div class="actions-row">
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
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit">{{ isEdit ? 'Speichern' : 'Anlegen' }}</Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.edit-form {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.row > * {
  flex: 1;
  min-width: 140px;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.spacer {
  flex: 1;
}

@container (max-width: 360px) {
  .actions-row {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .actions-row > * {
    width: 100%;
  }

  .spacer {
    display: none;
  }
}
</style>
