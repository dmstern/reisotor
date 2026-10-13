// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useBudgetExpenseForms } from './useBudgetExpenseForms';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import type { BudgetExpense } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve({ categories: [] });
      return Promise.resolve([]);
    }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

describe('useBudgetExpenseForms', () => {
  let budgetStore: ReturnType<typeof useBudgetStore>;
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    budgetStore = useBudgetStore();
    authStore = useAuthStore();

    authStore.user = { id: 7, email: 'test@example.com', username: 'TestUser' } as any;
    budgetStore.users = [
      { id: 7, username: 'TestUser', avatar: '✈️' },
      { id: 8, username: 'Partner', avatar: '🚂' },
    ] as any;

    vi.spyOn(budgetStore, 'submitExpense').mockResolvedValue({} as any);
    vi.spyOn(budgetStore, 'updateExpense').mockResolvedValue({} as any);
  });

  it('initializes with closed form and empty state', () => {
    const forms = useBudgetExpenseForms({ tripId: 123 });
    expect(forms.showExpenseForm.value).toBe(false);
    expect(forms.editingExpense.value).toBeNull();
    expect(forms.expenseForm.value.title).toBe('');
    expect(forms.expenseDetailsCount.value).toBeUndefined();
  });

  it('submits a new expense and resets form', async () => {
    const forms = useBudgetExpenseForms({ tripId: 123 });
    forms.showExpenseForm.value = true;
    forms.expenseForm.value = {
      title: 'Restaurant Abendessen',
      category: 'Essen',
      amount: '45.80',
      paid_by_user_id: '7',
      date: '2026-07-05',
      note: 'Leckere Pizza',
      budget_id: '1',
    };

    await forms.submitExpense();

    expect(budgetStore.submitExpense).toHaveBeenCalledWith({
      trip_id: 123,
      title: 'Restaurant Abendessen',
      category: 'Essen',
      amount: 45.8,
      paid_by_user_id: 7,
      date: '2026-07-05',
      note: 'Leckere Pizza',
      budget_id: 1,
    });
    expect(forms.showExpenseForm.value).toBe(false);
    expect(forms.expenseForm.value.title).toBe('');
  });

  it('correctly tracks details count when budget_id or note are present', () => {
    const forms = useBudgetExpenseForms({ tripId: 123 });
    expect(forms.expenseDetailsCount.value).toBeUndefined();

    forms.expenseForm.value.budget_id = '2';
    expect(forms.expenseDetailsCount.value).toBe(1);

    forms.expenseForm.value.note = 'Etwas Text';
    expect(forms.expenseDetailsCount.value).toBe(2);
  });

  it('starts edit expense with populated values', () => {
    const forms = useBudgetExpenseForms({ tripId: 123 });
    const mockExpense: BudgetExpense = {
      id: 99,
      trip_id: 123,
      title: 'Museumstickets',
      amount: 30,
      category: 'Kultur',
      paid_by_user_id: 8,
      date: '2026-07-08',
      note: 'Audioguide inklusive',
      budget_id: 3,
    };

    forms.startEditExpense(mockExpense);

    expect(forms.editingExpense.value).toEqual(mockExpense);
    expect(forms.editExpenseForm.value.title).toBe('Museumstickets');
    expect(forms.editExpenseForm.value.amount).toBe('30');
    expect(forms.editExpenseForm.value.paid_by_user_id).toBe('8');
    expect(forms.showEditExpenseDetails.value).toBe(true);
  });

  it('submits edit expense and clears editing state', async () => {
    const forms = useBudgetExpenseForms({ tripId: 123 });
    const mockExpense: BudgetExpense = {
      id: 99,
      trip_id: 123,
      title: 'Museumstickets',
      amount: 30,
      category: 'Kultur',
      paid_by_user_id: 8,
      date: '2026-07-08',
      note: '',
      budget_id: null,
    };

    forms.startEditExpense(mockExpense);
    forms.editExpenseForm.value.amount = '35';

    await forms.submitEditExpense();

    expect(budgetStore.updateExpense).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        amount: 35,
      })
    );
    expect(forms.editingExpense.value).toBeNull();
  });
});
