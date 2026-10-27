<script setup lang="ts">
import { computed, watch } from 'vue';
import type { BudgetTransfer } from '../api/types';
import type { SettlementSuggestion } from '../utils/budgetBalances';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useBudgetStore } from '../stores/budget';
import { useBudgetTransferForm } from '../composables/useBudgetTransferForm';
import { useToast } from '../composables/useToast';
import { restoreTrashItem } from '../api/trash';

const props = defineProps<{
  modelValue: boolean;
  transfer?: BudgetTransfer | null;
  suggestion?: SettlementSuggestion | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submitted'): void;
  (e: 'saved'): void;
  (e: 'deleted'): void;
}>();

const budgetStore = useBudgetStore();
const { showToast } = useToast();
const {
  transferForm,
  showTransferDetails,
  initFromTransfer,
  submitTransfer,
  closeTransferForm,
  useSettlementSuggestion,
} = useBudgetTransferForm();

const isEdit = computed(() => Boolean(props.transfer));
const modalTitle = computed(() =>
  isEdit.value ? 'Überweisung bearbeiten' : 'Überweisung eintragen'
);

watch(
  () => [props.modelValue, props.transfer, props.suggestion] as const,
  ([isOpen, transfer, sugg]) => {
    if (isOpen) {
      if (transfer) {
        initFromTransfer(transfer);
      } else if (sugg) {
        useSettlementSuggestion(sugg);
      } else {
        closeTransferForm();
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
  const wasEdit = isEdit.value;
  const success = await submitTransfer();
  if (!success) return;
  showToast({
    message: wasEdit ? 'Überweisung aktualisiert.' : 'Überweisung eingetragen.',
    type: 'success',
  });
  emit('update:modelValue', false);
  emit('submitted');
  emit('saved');
}

async function handleDelete() {
  if (props.transfer) {
    const transferId = props.transfer.id;
    await budgetStore.removeTransfer(transferId);
    showToast({
      message: 'Überweisung gelöscht. Sie befindet sich nun im Papierkorb.',
      type: 'info',
      onRestore: async () => {
        await restoreTrashItem('budget_transfer', transferId);
        await budgetStore.load();
      },
    });
  }
  handleClose();
  emit('deleted');
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form add-form" @submit.prevent="handleSubmit">
      <div class="row">
        <FormField icon="person" label="Von" required v-slot="{ id }">
          <Select :id="id" v-model="transferForm.from_user_id" required>
            <option value="" disabled>Von…</option>
            <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
        <FormField
          icon="person"
          label="An"
          required
          :error="
            transferForm.from_user_id &&
            transferForm.to_user_id &&
            transferForm.from_user_id === transferForm.to_user_id
              ? 'Sender und Empfänger dürfen nicht identisch sein.'
              : undefined
          "
          v-slot="{ id }"
        >
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
        <Button type="submit">{{ isEdit ? 'Speichern' : 'Eintragen' }}</Button>
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
</style>
