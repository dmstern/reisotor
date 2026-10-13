<script setup lang="ts">
import { watch } from 'vue';
import type { SettlementSuggestion } from '../utils/budgetBalances';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { useBudgetStore } from '../stores/budget';
import { useBudgetTransferForm } from '../composables/useBudgetTransferForm';

const props = defineProps<{
  modelValue: boolean;
  suggestion?: SettlementSuggestion | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submitted'): void;
}>();

const budgetStore = useBudgetStore();
const {
  transferForm,
  showTransferDetails,
  submitTransfer,
  closeTransferForm,
  useSettlementSuggestion,
} = useBudgetTransferForm();

watch(
  () => [props.modelValue, props.suggestion] as const,
  ([isOpen, sugg]) => {
    if (isOpen) {
      if (sugg) {
        useSettlementSuggestion(sugg);
      }
    } else {
      closeTransferForm();
    }
  },
  { immediate: true }
);

function handleClose() {
  closeTransferForm();
  emit('update:modelValue', false);
}

async function handleSubmit() {
  await submitTransfer();
  emit('update:modelValue', false);
  emit('submitted');
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Überweisung eintragen"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form" @submit.prevent="handleSubmit">
      <div class="row">
        <FormField icon="person" label="Von" required v-slot="{ id }">
          <Select :id="id" v-model="transferForm.from_user_id" required>
            <option value="" disabled>Von…</option>
            <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
        <FormField icon="person" label="An" required v-slot="{ id }">
          <Select :id="id" v-model="transferForm.to_user_id" required>
            <option value="" disabled>An…</option>
            <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
      </div>

      <div class="row">
        <FormField icon="amount" label="Betrag" required v-slot="{ id }">
          <Input
            :id="id"
            v-model="transferForm.amount"
            type="number"
            inputmode="decimal"
            step="0.01"
            placeholder="Betrag €"
            required
          />
        </FormField>
        <FormField icon="date" label="Datum" v-slot="{ id }">
          <Input :id="id" v-model="transferForm.date" type="date" />
        </FormField>
      </div>

      <CollapsibleFieldset
        v-model="showTransferDetails"
        label="Weitere Angaben"
        :count="transferForm.note ? 1 : undefined"
        :icon="FORM_FIELD_ICONS.note"
        icon-group="formFields"
      >
        <FormField icon="note" label="Notiz" v-slot="{ id }">
          <Input :id="id" v-model="transferForm.note" type="text" placeholder="Notiz" />
        </FormField>
      </CollapsibleFieldset>

      <div class="actions-row">
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit">Eintragen</Button>
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
