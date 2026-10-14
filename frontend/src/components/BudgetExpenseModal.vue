<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { BudgetExpense } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import CategoryCombobox from './CategoryCombobox.vue';
import FileAttachments from './FileAttachments.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useBudgetStore } from '../stores/budget';
import { useTripStore } from '../stores/trip';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useToast } from '../composables/useToast';
import { toLocalDateString } from '../utils/dateFormat';

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Ausgabe', icon: ACTION_ICONS.moneybagMinus },
  { value: 'income', label: 'Einnahme', icon: ACTION_ICONS.moneybagPlus },
];

const props = defineProps<{
  modelValue: boolean;
  expense?: BudgetExpense | null;
  initialType?: 'expense' | 'income';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
  (e: 'deleted'): void;
}>();

const budgetStore = useBudgetStore();
const tripStore = useTripStore();
const { showToast } = useToast();

const form = ref<{
  type: 'expense' | 'income';
  title: string;
  category: string;
  amount: string;
  paid_by_user_id: string;
  date: string;
  note: string;
  budget_id: string;
}>({
  type: 'expense',
  title: '',
  category: '',
  amount: '',
  paid_by_user_id: '',
  date: toLocalDateString(new Date()),
  note: '',
  budget_id: '',
});

const showDetails = ref(false);
const isUploading = ref(false);

const isEdit = computed(() => Boolean(props.expense));
const isIncome = computed(() => form.value.type === 'income');
const modalTitle = computed(() => {
  if (isEdit.value) {
    return isIncome.value ? 'Einnahme bearbeiten' : 'Ausgabe bearbeiten';
  }
  return isIncome.value ? 'Einnahme eintragen' : 'Ausgabe eintragen';
});

const submitLabel = computed(() => {
  if (isEdit.value) return 'Speichern';
  return isIncome.value ? 'Einnahme eintragen' : 'Ausgabe eintragen';
});

const detailsCount = computed(() => {
  let count = 0;
  if (form.value.budget_id) count++;
  if (form.value.note) count++;
  return count > 0 ? count : undefined;
});

const draft = useDraftAutosave(
  () => (props.expense ? `budgetExpense:edit:${props.expense.id}` : 'budgetExpense:new'),
  form,
  () => props.modelValue
);

watch(
  () => [props.modelValue, props.expense] as const,
  ([isOpen, exp]) => {
    if (isOpen) {
      if (exp) {
        const income = exp.amount < 0;
        form.value = {
          type: income ? 'income' : 'expense',
          title: exp.title,
          category: exp.category ?? '',
          amount: String(Math.abs(exp.amount)),
          paid_by_user_id: exp.paid_by_user_id != null ? String(exp.paid_by_user_id) : '',
          date: exp.date ?? toLocalDateString(new Date()),
          note: exp.note ?? '',
          budget_id: exp.budget_id != null ? String(exp.budget_id) : '',
        };
        showDetails.value = Boolean(exp.budget_id || exp.note);
      } else {
        form.value = {
          type: props.initialType ?? 'expense',
          title: '',
          category: '',
          amount: '',
          paid_by_user_id: '',
          date: toLocalDateString(new Date()),
          note: '',
          budget_id: '',
        };
        showDetails.value = false;
      }
    }
  },
  { immediate: true }
);

watch(
  () => [props.modelValue, form.value.budget_id, form.value.note],
  ([isOpen, budgetId, note]) => {
    if (isOpen && (budgetId || note)) {
      showDetails.value = true;
    }
  }
);

function handleClose() {
  draft.clear();
  emit('update:modelValue', false);
}

function discardDraft() {
  if (props.expense) {
    const exp = props.expense;
    const income = exp.amount < 0;
    form.value = {
      type: income ? 'income' : 'expense',
      title: exp.title,
      category: exp.category ?? '',
      amount: String(Math.abs(exp.amount)),
      paid_by_user_id: exp.paid_by_user_id != null ? String(exp.paid_by_user_id) : '',
      date: exp.date ?? toLocalDateString(new Date()),
      note: exp.note ?? '',
      budget_id: exp.budget_id != null ? String(exp.budget_id) : '',
    };
    draft.clear();
    showToast({ message: 'Änderungen verworfen.', type: 'info' });
  } else {
    form.value = {
      type: props.initialType ?? 'expense',
      title: '',
      category: '',
      amount: '',
      paid_by_user_id: '',
      date: toLocalDateString(new Date()),
      note: '',
      budget_id: '',
    };
    showDetails.value = false;
    draft.clear();
    showToast({ message: 'Entwurf verworfen.', type: 'info' });
  }
}

async function handleSubmit() {
  const numericAmount = Math.abs(Number(form.value.amount));
  if (!form.value.title.trim()) {
    showToast({ message: 'Bitte einen Titel eingeben.', type: 'warning' });
    return;
  }
  if (!form.value.amount || isNaN(numericAmount) || numericAmount <= 0) {
    showToast({ message: 'Bitte einen Betrag größer als 0 eingeben.', type: 'warning' });
    return;
  }
  if (isUploading.value) return;

  const fallbackPaidBy = budgetStore.users.length === 1 ? budgetStore.users[0].id : null;
  const paidBy = form.value.paid_by_user_id ? Number(form.value.paid_by_user_id) : fallbackPaidBy;

  const finalAmount = isIncome.value ? -numericAmount : numericAmount;

  const body = {
    trip_id: tripStore.currentTripId as number,
    title: form.value.title.trim(),
    category: form.value.category || undefined,
    amount: finalAmount,
    paid_by_user_id: paidBy,
    date: form.value.date || undefined,
    note: form.value.note || undefined,
    budget_id: form.value.budget_id ? Number(form.value.budget_id) : undefined,
  };

  try {
    if (isEdit.value && props.expense) {
      await budgetStore.updateExpense(props.expense.id, body);
      showToast({
        message: isIncome.value ? 'Einnahme aktualisiert.' : 'Ausgabe aktualisiert.',
        type: 'success',
      });
    } else {
      await budgetStore.submitExpense(body);
      showToast({
        message: isIncome.value ? 'Einnahme eingetragen.' : 'Ausgabe eingetragen.',
        type: 'success',
      });
    }

    draft.clear();
    emit('update:modelValue', false);
    emit('saved');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fehler beim Speichern';
    showToast({ message, type: 'error' });
  }
}

async function handleDelete() {
  if (props.expense) {
    try {
      await budgetStore.removeExpense(props.expense.id);
      showToast({
        message: isIncome.value
          ? 'Einnahme gelöscht. Sie befindet sich nun im Papierkorb.'
          : 'Ausgabe gelöscht. Sie befindet sich nun im Papierkorb.',
        type: 'info',
      });
      draft.clear();
      emit('update:modelValue', false);
      emit('deleted');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Löschen';
      showToast({ message, type: 'error' });
    }
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    :confirm-close="draft.isDirty.value"
    :confirm-close-mode="isEdit ? undefined : 'draft'"
    :confirm-close-entity="isIncome ? 'Einnahme' : 'Ausgabe'"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form" @submit.prevent="handleSubmit">
      <div class="type-toggle-wrapper">
        <SegmentedToggle v-model="form.type" :options="TYPE_OPTIONS" class="type-toggle" />
      </div>

      <FormField icon="title" label="Titel" required v-slot="{ id }">
        <Input
          :id="id"
          v-model="form.title"
          type="text"
          :placeholder="
            isIncome
              ? 'Titel (z. B. Zuschuss Oma, Pfand, Verkauf)'
              : 'Titel (z. B. Restaurant, Tickets)'
          "
          required
        />
      </FormField>

      <div class="row">
        <FormField icon="amount" label="Betrag" required v-slot="{ id }">
          <Input
            :id="id"
            v-model="form.amount"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0.01"
            placeholder="Betrag €"
            required
          />
        </FormField>
        <FormField icon="category" label="Kategorie" v-slot="{ id }">
          <CategoryCombobox
            :id="id"
            v-model="form.category"
            type="expense"
            placeholder="Kategorie"
          />
        </FormField>
      </div>

      <div class="row">
        <FormField
          v-if="budgetStore.users.length > 1"
          icon="shared"
          :label="isIncome ? 'Eingegangen bei' : 'Bezahlt von'"
          :required="!isIncome"
          v-slot="{ id }"
        >
          <Select :id="id" v-model="form.paid_by_user_id" :required="!isIncome">
            <option v-if="!isIncome" value="" disabled>Bezahlt von…</option>
            <option v-else value="">🤝 Gemeinsam (Reisekasse / alle)</option>
            <option
              v-if="
                isEdit &&
                form.paid_by_user_id &&
                !budgetStore.users.some((u) => String(u.id) === String(form.paid_by_user_id))
              "
              :value="String(form.paid_by_user_id)"
              disabled
            >
              👤 Ehemaliges Mitglied
            </option>
            <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
        <FormField icon="date" label="Datum" v-slot="{ id }">
          <Input :id="id" v-model="form.date" type="date" />
        </FormField>
      </div>

      <CollapsibleFieldset
        v-model="showDetails"
        label="Weitere Angaben"
        :count="detailsCount"
        :icon="FORM_FIELD_ICONS.pot"
        icon-group="formFields"
      >
        <FormField icon="pot" label="Budget-Topf" v-slot="{ id }">
          <Select :id="id" v-model="form.budget_id">
            <option value="">Kein Budget</option>
            <option v-for="b in budgetStore.budgets" :key="b.id" :value="String(b.id)">
              {{ b.name }} ({{ budgetStore.budgetLabel(b) }})
            </option>
          </Select>
        </FormField>
        <FormField icon="note" label="Notiz" v-slot="{ id }">
          <Input :id="id" v-model="form.note" type="text" placeholder="Notiz" />
        </FormField>
      </CollapsibleFieldset>

      <FileAttachments
        v-if="isEdit && expense"
        domain="budget"
        :entity-id="expense.id"
        v-model:uploading="isUploading"
      />

      <DraftStatusBar
        :status="draft.status.value"
        :restored="draft.restored.value"
        :can-discard="true"
        :mode="isEdit ? 'edit' : 'create'"
        @discard="discardDraft"
      />

      <div class="actions-row">
        <Button
          v-if="isEdit"
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          :disabled="isUploading"
          @click="handleDelete"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="isUploading">
          {{ submitLabel }}
        </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.type-toggle-wrapper {
  margin-bottom: var(--space-1);
}

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
