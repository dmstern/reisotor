<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BudgetTransfer } from '../api/types';
import type { SettlementSuggestion } from '../utils/budgetBalances';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
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

const initialSnapshot = ref<{
  from_user_id: string;
  to_user_id: string;
  amount: string;
  date: string;
  note: string;
} | null>(null);

watch(
  () => [props.modelValue, props.transfer, props.suggestion] as const,
  ([isOpen, transfer, sugg]) => {
    if (isOpen) {
      if (transfer) {
        initFromTransfer(transfer);
        initialSnapshot.value = {
          from_user_id: String(transferForm.value.from_user_id),
          to_user_id: String(transferForm.value.to_user_id),
          amount: String(transferForm.value.amount),
          date: transferForm.value.date ?? '',
          note: transferForm.value.note ?? '',
        };
      } else if (sugg) {
        useSettlementSuggestion(sugg);
        initialSnapshot.value = null;
      } else {
        closeTransferForm();
        initialSnapshot.value = null;
      }
    } else {
      closeTransferForm();
      initialSnapshot.value = null;
    }
  },
  { immediate: true }
);

const isFromModified = computed(
  () =>
    initialSnapshot.value !== null &&
    String(transferForm.value.from_user_id) !== initialSnapshot.value.from_user_id
);
const isToModified = computed(
  () =>
    initialSnapshot.value !== null &&
    String(transferForm.value.to_user_id) !== initialSnapshot.value.to_user_id
);
const isAmountModified = computed(
  () =>
    initialSnapshot.value !== null &&
    String(transferForm.value.amount) !== initialSnapshot.value.amount
);
const isDateModified = computed(
  () =>
    initialSnapshot.value !== null && (transferForm.value.date ?? '') !== initialSnapshot.value.date
);
const isNoteModified = computed(
  () =>
    initialSnapshot.value !== null && (transferForm.value.note ?? '') !== initialSnapshot.value.note
);

function handleClose() {
  closeTransferForm();
  emit('update:modelValue', false);
}

async function handleSubmit() {
  const wasEdit = isEdit.value;
  const success = await submitTransfer();

  if (!success) {
    return;
  }

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
        <FormField
          icon="person"
          label="Von"
          required
          :modified="isFromModified"
          v-slot="{ id, modified }"
        >
          <Select :id="id" v-model="transferForm.from_user_id" required :modified="modified">
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
          :modified="isToModified"
          :error="
            transferForm.from_user_id &&
            transferForm.to_user_id &&
            transferForm.from_user_id === transferForm.to_user_id
              ? 'Sender und Empfänger dürfen nicht identisch sein.'
              : undefined
          "
          v-slot="{ id, modified }"
        >
          <Select :id="id" v-model="transferForm.to_user_id" required :modified="modified">
            <option value="" disabled>An…</option>
            <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
      </div>

      <div class="row">
        <FormField
          icon="amount"
          label="Betrag"
          required
          :modified="isAmountModified"
          v-slot="{ id, modified }"
        >
          <Input
            :id="id"
            v-model="transferForm.amount"
            type="number"
            inputmode="decimal"
            step="0.01"
            placeholder="Betrag €"
            required
            :modified="modified"
          />
        </FormField>
        <FormField icon="date" label="Datum" :modified="isDateModified" v-slot="{ id, modified }">
          <Input :id="id" v-model="transferForm.date" type="date" :modified="modified" />
        </FormField>
      </div>

      <CollapsibleFieldset
        v-model="showTransferDetails"
        label="Weitere Angaben"
        :count="transferForm.note ? 1 : undefined"
        :icon="FORM_FIELD_ICONS.note"
        icon-group="formFields"
      >
        <FormField icon="note" label="Notiz" :modified="isNoteModified" v-slot="{ id, modified }">
          <Input
            :id="id"
            v-model="transferForm.note"
            type="text"
            placeholder="Notiz"
            :modified="modified"
          />
        </FormField>
      </CollapsibleFieldset>

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
        <Button type="submit">{{ isEdit ? 'Speichern' : 'Eintragen' }}</Button>
      </ButtonGroup>
    </form>
  </Modal>
</template>

<style scoped lang="scss">
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-width: 0;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.row > * {
  flex: 1 1 140px;
  min-width: 0;
}

@include container-down('modal', 'mobile-sm') {
  .row {
    flex-direction: column;
    gap: var(--space-lg);
  }

  .row > * {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>
