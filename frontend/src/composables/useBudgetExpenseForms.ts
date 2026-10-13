import { computed, ref, watch, type Ref } from 'vue';
import type { BudgetExpense } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useDraftAutosave } from './useDraftAutosave';
import { useToast } from './useToast';
import { toLocalDateString } from '../utils/dateFormat';

export interface BudgetExpenseFormData {
  title: string;
  category: string;
  amount: string;
  paid_by_user_id: string;
  date: string;
  note: string;
  budget_id: string;
}

export function createEmptyExpenseForm(): BudgetExpenseFormData {
  return {
    title: '',
    category: '',
    amount: '',
    paid_by_user_id: '',
    date: toLocalDateString(new Date()),
    note: '',
    budget_id: '',
  };
}

export function useBudgetExpenseForms(options?: { tripId?: number | Ref<number> }) {
  const tripStore = useTripStore();
  const auth = useAuthStore();
  const budgetStore = useBudgetStore();
  const { showToast } = useToast();

  const getTripId = (): number => {
    if (options?.tripId !== undefined) {
      return typeof options.tripId === 'object' && 'value' in options.tripId
        ? options.tripId.value
        : options.tripId;
    }
    return (tripStore.currentTripId as number) || 0;
  };

  const showExpenseForm = ref(false);
  const showExpenseDetails = ref(false);
  const expenseForm = ref<BudgetExpenseFormData>(createEmptyExpenseForm());

  const editingExpense = ref<BudgetExpense | null>(null);
  const isExpenseUploadingAttachments = ref(false);
  const showEditExpenseDetails = ref(false);
  const editExpenseForm = ref<BudgetExpenseFormData>(createEmptyExpenseForm());

  const expenseDetailsCount = computed(() => {
    let count = 0;
    if (expenseForm.value.budget_id) count++;
    if (expenseForm.value.note) count++;
    return count > 0 ? count : undefined;
  });

  const editExpenseDetailsCount = computed(() => {
    let count = 0;
    if (editExpenseForm.value.budget_id) count++;
    if (editExpenseForm.value.note) count++;
    return count > 0 ? count : undefined;
  });

  const newExpenseDraft = useDraftAutosave('budgetExpense:new', expenseForm, showExpenseForm);
  const editExpenseDraft = useDraftAutosave(
    () => `budgetExpense:edit:${editingExpense.value?.id}`,
    editExpenseForm,
    computed(() => editingExpense.value !== null)
  );

  watch(
    () => [showExpenseForm.value, expenseForm.value.budget_id, expenseForm.value.note],
    ([isOpen, budgetId, note]) => {
      if (isOpen && (budgetId || note)) {
        showExpenseDetails.value = true;
      }
    }
  );

  function expenseToBody(f: BudgetExpenseFormData) {
    const fallbackPaidBy = budgetStore.users.length === 1 ? budgetStore.users[0].id : auth.user?.id;
    return {
      trip_id: getTripId(),
      title: f.title.trim(),
      category: f.category || undefined,
      amount: Number(f.amount),
      paid_by_user_id: f.paid_by_user_id ? Number(f.paid_by_user_id) : fallbackPaidBy,
      date: f.date || undefined,
      note: f.note || undefined,
      budget_id: f.budget_id ? Number(f.budget_id) : undefined,
    };
  }

  async function submitExpense() {
    if (!expenseForm.value.title.trim() || !expenseForm.value.amount) return;
    await budgetStore.submitExpense(expenseToBody(expenseForm.value));
    expenseForm.value = createEmptyExpenseForm();
    showExpenseForm.value = false;
    showExpenseDetails.value = false;
    newExpenseDraft.clear();
  }

  function closeExpenseForm() {
    showExpenseForm.value = false;
    showExpenseDetails.value = false;
    expenseForm.value = createEmptyExpenseForm();
    newExpenseDraft.clear();
  }

  function discardNewExpenseDraft() {
    expenseForm.value = createEmptyExpenseForm();
    showExpenseDetails.value = false;
    newExpenseDraft.clear();
    showToast({ message: 'Entwurf verworfen.', type: 'info' });
  }

  function startEditExpense(expense: BudgetExpense) {
    editExpenseForm.value = {
      title: expense.title,
      category: expense.category ?? '',
      amount: String(expense.amount),
      paid_by_user_id: expense.paid_by_user_id != null ? String(expense.paid_by_user_id) : '',
      date: expense.date ?? toLocalDateString(new Date()),
      note: expense.note ?? '',
      budget_id: expense.budget_id != null ? String(expense.budget_id) : '',
    };
    showEditExpenseDetails.value = Boolean(expense.budget_id || expense.note);
    editingExpense.value = expense;
  }

  async function submitEditExpense() {
    if (
      !editingExpense.value ||
      isExpenseUploadingAttachments.value ||
      !editExpenseForm.value.title.trim() ||
      !editExpenseForm.value.amount
    )
      return;
    await budgetStore.updateExpense(editingExpense.value.id, expenseToBody(editExpenseForm.value));
    editExpenseDraft.clear();
    editingExpense.value = null;
    showEditExpenseDetails.value = false;
  }

  function closeEditExpenseForm() {
    editExpenseDraft.clear();
    editingExpense.value = null;
    showEditExpenseDetails.value = false;
  }

  function discardEditExpenseDraft() {
    if (!editingExpense.value) return;
    startEditExpense(editingExpense.value);
    editExpenseDraft.clear();
    showToast({ message: 'Änderungen verworfen.', type: 'info' });
  }

  return {
    showExpenseForm,
    showExpenseDetails,
    expenseForm,
    editingExpense,
    isExpenseUploadingAttachments,
    showEditExpenseDetails,
    editExpenseForm,
    expenseDetailsCount,
    editExpenseDetailsCount,
    newExpenseDraft,
    editExpenseDraft,
    submitExpense,
    closeExpenseForm,
    discardNewExpenseDraft,
    startEditExpense,
    submitEditExpense,
    closeEditExpenseForm,
    discardEditExpenseDraft,
  };
}
