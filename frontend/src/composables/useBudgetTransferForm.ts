import { ref, type Ref } from 'vue';
import type { BudgetTransfer } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import { useTripStore } from '../stores/trip';
import { useToast } from './useToast';
import { toLocalDateString } from '../utils/dateFormat';
import type { SettlementSuggestion } from '../utils/budgetBalances';

export interface BudgetTransferFormData {
  from_user_id: string;
  to_user_id: string;
  amount: string;
  date: string;
  note: string;
}

export function createEmptyTransferForm(): BudgetTransferFormData {
  return {
    from_user_id: '',
    to_user_id: '',
    amount: '',
    date: toLocalDateString(new Date()),
    note: '',
  };
}

export function useBudgetTransferForm(options?: { tripId?: number | Ref<number> }) {
  const tripStore = useTripStore();
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

  const showTransferForm = ref(false);
  const showTransferDetails = ref(false);
  const editingTransfer = ref<BudgetTransfer | null>(null);
  const transferForm = ref<BudgetTransferFormData>(createEmptyTransferForm());

  async function submitTransfer(): Promise<boolean> {
    if (
      !transferForm.value.from_user_id ||
      !transferForm.value.to_user_id ||
      !transferForm.value.amount
    )
      return false;
    if (transferForm.value.from_user_id === transferForm.value.to_user_id) {
      showToast({
        message: 'Sender und Empfänger dürfen nicht identisch sein.',
        type: 'warning',
      });
      return false;
    }

    if (editingTransfer.value) {
      await budgetStore.updateTransfer(editingTransfer.value.id, {
        from_user_id: Number(transferForm.value.from_user_id),
        to_user_id: Number(transferForm.value.to_user_id),
        amount: Number(transferForm.value.amount),
        date: transferForm.value.date || undefined,
        note: transferForm.value.note || undefined,
      });
    } else {
      await budgetStore.submitTransfer({
        trip_id: getTripId(),
        from_user_id: Number(transferForm.value.from_user_id),
        to_user_id: Number(transferForm.value.to_user_id),
        amount: Number(transferForm.value.amount),
        date: transferForm.value.date || undefined,
        note: transferForm.value.note || undefined,
      });
    }

    editingTransfer.value = null;
    transferForm.value = createEmptyTransferForm();
    showTransferForm.value = false;
    showTransferDetails.value = false;
    return true;
  }

  function closeTransferForm() {
    editingTransfer.value = null;
    showTransferForm.value = false;
    showTransferDetails.value = false;
    transferForm.value = createEmptyTransferForm();
  }

  function initFromTransfer(transfer: BudgetTransfer) {
    editingTransfer.value = transfer;
    transferForm.value = {
      from_user_id: String(transfer.from_user_id),
      to_user_id: String(transfer.to_user_id),
      amount: String(transfer.amount),
      date: transfer.date ?? toLocalDateString(new Date()),
      note: transfer.note ?? '',
    };
    showTransferDetails.value = Boolean(transfer.note);
    showTransferForm.value = true;
  }

  function useSettlementSuggestion(suggestion: SettlementSuggestion) {
    editingTransfer.value = null;
    transferForm.value = {
      from_user_id: String(suggestion.from.id),
      to_user_id: String(suggestion.to.id),
      amount: suggestion.amount.toFixed(2),
      date: toLocalDateString(new Date()),
      note: '',
    };
    showTransferDetails.value = false;
    showTransferForm.value = true;
  }

  return {
    showTransferForm,
    showTransferDetails,
    editingTransfer,
    transferForm,
    initFromTransfer,
    submitTransfer,
    closeTransferForm,
    useSettlementSuggestion,
  };
}
