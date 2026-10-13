import { ref, type Ref } from 'vue';
import { useBudgetStore } from '../stores/budget';
import { useTripStore } from '../stores/trip';
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
  const transferForm = ref<BudgetTransferFormData>(createEmptyTransferForm());

  async function submitTransfer() {
    if (
      !transferForm.value.from_user_id ||
      !transferForm.value.to_user_id ||
      !transferForm.value.amount
    )
      return;
    if (transferForm.value.from_user_id === transferForm.value.to_user_id) return;

    await budgetStore.submitTransfer({
      trip_id: getTripId(),
      from_user_id: Number(transferForm.value.from_user_id),
      to_user_id: Number(transferForm.value.to_user_id),
      amount: Number(transferForm.value.amount),
      date: transferForm.value.date || undefined,
      note: transferForm.value.note || undefined,
    });

    transferForm.value = createEmptyTransferForm();
    showTransferForm.value = false;
    showTransferDetails.value = false;
  }

  function closeTransferForm() {
    showTransferForm.value = false;
    showTransferDetails.value = false;
    transferForm.value = createEmptyTransferForm();
  }

  function useSettlementSuggestion(suggestion: SettlementSuggestion) {
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
    transferForm,
    submitTransfer,
    closeTransferForm,
    useSettlementSuggestion,
  };
}
