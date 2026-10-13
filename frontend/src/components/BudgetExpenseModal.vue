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
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useToast } from '../composables/useToast';
import { toLocalDateString } from '../utils/dateFormat';

const props = defineProps<{
  modelValue: boolean;
  expense?: BudgetExpense | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved'): void;
}>();

const budgetStore = useBudgetStore();
const auth = useAuthStore();
const tripStore = useTripStore();
const { showToast } = useToast();

const form = ref({
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
const modalTitle = computed(() => (isEdit.value ? 'Ausgabe bearbeiten' : 'Ausgabe eintragen'));

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
        form.value = {
          title: exp.title,
          category: exp.category ?? '',
          amount: String(exp.amount),
          paid_by_user_id: exp.paid_by_user_id != null ? String(exp.paid_by_user_id) : '',
          date: exp.date ?? toLocalDateString(new Date()),
          note: exp.note ?? '',
          budget_id: exp.budget_id != null ? String(exp.budget_id) : '',
        };
        showDetails.value = Boolean(exp.budget_id || exp.note);
      } else {
        form.value = {
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
    form.value = {
      title: exp.title,
      category: exp.category ?? '',
      amount: String(exp.amount),
      paid_by_user_id: exp.paid_by_user_id != null ? String(exp.paid_by_user_id) : '',
      date: exp.date ?? toLocalDateString(new Date()),
      note: exp.note ?? '',
      budget_id: exp.budget_id != null ? String(exp.budget_id) : '',
    };
    draft.clear();
    showToast({ message: 'Änderungen verworfen.', type: 'info' });
  } else {
    form.value = {
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
  if (!form.value.title.trim() || !form.value.amount || isUploading.value) return;

  const fallbackPaidBy = budgetStore.users.length === 1 ? budgetStore.users[0].id : auth.user?.id;

  const body = {
    trip_id: tripStore.currentTripId as number,
    title: form.value.title.trim(),
    category: form.value.category || undefined,
    amount: Number(form.value.amount),
    paid_by_user_id: form.value.paid_by_user_id
      ? Number(form.value.paid_by_user_id)
      : fallbackPaidBy,
    date: form.value.date || undefined,
    note: form.value.note || undefined,
    budget_id: form.value.budget_id ? Number(form.value.budget_id) : undefined,
  };

  if (isEdit.value && props.expense) {
    await budgetStore.updateExpense(props.expense.id, body);
  } else {
    await budgetStore.submitExpense(body);
  }

  draft.clear();
  emit('update:modelValue', false);
  emit('saved');
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    :confirm-close="draft.isDirty.value"
    :confirm-close-mode="isEdit ? undefined : 'draft'"
    confirm-close-entity="Ausgabe"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form" @submit.prevent="handleSubmit">
      <FormField icon="title" label="Titel" required v-slot="{ id }">
        <Input
          :id="id"
          v-model="form.title"
          type="text"
          placeholder="Titel (z. B. Restaurant, Tickets)"
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
          label="Bezahlt von"
          required
          v-slot="{ id }"
        >
          <Select :id="id" v-model="form.paid_by_user_id" required>
            <option value="" disabled>Bezahlt von…</option>
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
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="isUploading">
          {{ isEdit ? 'Speichern' : 'Eintragen' }}
        </Button>
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
