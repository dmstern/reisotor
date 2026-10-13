import { ref, type Ref } from 'vue';
import type { Budget } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';

export interface BudgetPotFormData {
  name: string;
  kind: 'shared' | 'personal';
  target_amount: string;
}

export function useBudgetPotForms(options?: { tripId?: number | Ref<number> }) {
  const tripStore = useTripStore();
  const auth = useAuthStore();
  const budgetStore = useBudgetStore();

  const getTripId = (): number => {
    if (options?.tripId !== undefined) {
      return typeof options.tripId === 'object' && 'value' in options.tripId
        ? options.tripId.value
        : options.tripId;
    }
    return (tripStore.currentTripId as number) || 0;
  };

  const newBudgetForm = ref<BudgetPotFormData>({
    name: '',
    kind: 'shared',
    target_amount: '',
  });
  const showNewBudgetForm = ref(false);

  async function addBudget() {
    if (!newBudgetForm.value.name.trim()) return;
    const tid = getTripId();
    await budgetStore.addBudget(tid, {
      name: newBudgetForm.value.name.trim(),
      owner_id: newBudgetForm.value.kind === 'personal' ? auth.user?.id : undefined,
      target_amount: newBudgetForm.value.target_amount
        ? Number(newBudgetForm.value.target_amount)
        : undefined,
    });
    newBudgetForm.value = { name: '', kind: 'shared', target_amount: '' };
    showNewBudgetForm.value = false;
  }

  function closeNewBudgetForm() {
    showNewBudgetForm.value = false;
    newBudgetForm.value = { name: '', kind: 'shared', target_amount: '' };
  }

  const editingBudget = ref<Budget | null>(null);
  const editBudgetForm = ref<BudgetPotFormData>({
    name: '',
    kind: 'shared',
    target_amount: '',
  });

  function startEditBudget(budget: Budget) {
    editingBudget.value = budget;
    editBudgetForm.value = {
      name:
        budget.name === 'Gemeinsames Budget' && budgetStore.users.length <= 1
          ? 'Hauptbudget'
          : budget.name,
      kind: budget.owner_id != null ? 'personal' : 'shared',
      target_amount: budget.target_amount != null ? String(budget.target_amount) : '',
    };
  }

  function closeEditBudgetForm() {
    editingBudget.value = null;
    editBudgetForm.value = { name: '', kind: 'shared', target_amount: '' };
  }

  async function submitEditBudget() {
    if (!editingBudget.value || !editBudgetForm.value.name.trim()) return;
    await budgetStore.updateBudget(editingBudget.value.id, {
      name: editBudgetForm.value.name.trim(),
      owner_id: editBudgetForm.value.kind === 'personal' ? auth.user?.id : null,
      target_amount: editBudgetForm.value.target_amount
        ? Number(editBudgetForm.value.target_amount)
        : null,
    });
    editingBudget.value = null;
  }

  async function deleteEditingBudget() {
    if (!editingBudget.value) return;
    const id = editingBudget.value.id;
    editingBudget.value = null;
    await budgetStore.removeBudget(id);
  }

  return {
    newBudgetForm,
    showNewBudgetForm,
    addBudget,
    closeNewBudgetForm,
    editingBudget,
    editBudgetForm,
    startEditBudget,
    closeEditBudgetForm,
    submitEditBudget,
    deleteEditingBudget,
  };
}
