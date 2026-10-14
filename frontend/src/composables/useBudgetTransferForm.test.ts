// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useBudgetTransferForm } from './useBudgetTransferForm';
import { useBudgetStore } from '../stores/budget';

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

describe('useBudgetTransferForm', () => {
  let budgetStore: ReturnType<typeof useBudgetStore>;

  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    budgetStore = useBudgetStore();

    vi.spyOn(budgetStore, 'submitTransfer').mockResolvedValue({} as any);
    vi.spyOn(budgetStore, 'updateTransfer').mockResolvedValue({} as any);
  });

  it('initializes with closed form and empty fields', () => {
    const transferForm = useBudgetTransferForm({ tripId: 123 });
    expect(transferForm.showTransferForm.value).toBe(false);
    expect(transferForm.transferForm.value.from_user_id).toBe('');
    expect(transferForm.transferForm.value.to_user_id).toBe('');
    expect(transferForm.transferForm.value.amount).toBe('');
  });

  it('submits a transfer and resets form', async () => {
    const transferForm = useBudgetTransferForm({ tripId: 123 });
    transferForm.showTransferForm.value = true;
    transferForm.transferForm.value = {
      from_user_id: '1',
      to_user_id: '2',
      amount: '50.00',
      date: '2026-07-10',
      note: 'Ausgleich Hotel',
    };

    await transferForm.submitTransfer();

    expect(budgetStore.submitTransfer).toHaveBeenCalledWith({
      trip_id: 123,
      from_user_id: 1,
      to_user_id: 2,
      amount: 50,
      date: '2026-07-10',
      note: 'Ausgleich Hotel',
    });
    expect(transferForm.showTransferForm.value).toBe(false);
    expect(transferForm.transferForm.value.amount).toBe('');
  });

  it('ignores submission when sender and receiver are the same user', async () => {
    const transferForm = useBudgetTransferForm({ tripId: 123 });
    transferForm.transferForm.value = {
      from_user_id: '1',
      to_user_id: '1',
      amount: '50.00',
      date: '2026-07-10',
      note: 'Self transfer',
    };

    await transferForm.submitTransfer();
    expect(budgetStore.submitTransfer).not.toHaveBeenCalled();
  });

  it('applies settlement suggestion directly into the form and opens it', () => {
    const transferForm = useBudgetTransferForm({ tripId: 123 });
    const suggestion = {
      from: { id: 1, username: 'Alice', avatar: '👩' } as any,
      to: { id: 2, username: 'Bob', avatar: '👨' } as any,
      amount: 42.5,
    };

    transferForm.useSettlementSuggestion(suggestion);

    expect(transferForm.showTransferForm.value).toBe(true);
    expect(transferForm.transferForm.value.from_user_id).toBe('1');
    expect(transferForm.transferForm.value.to_user_id).toBe('2');
    expect(transferForm.transferForm.value.amount).toBe('42.50');
  });

  it('populates form from existing transfer and updates it on submit', async () => {
    const transferForm = useBudgetTransferForm({ tripId: 123 });
    const existingTransfer = {
      id: 99,
      trip_id: 123,
      from_user_id: 1,
      to_user_id: 2,
      amount: 80,
      date: '2026-08-01',
      note: 'Mietwagenanteil',
    };

    transferForm.initFromTransfer(existingTransfer);

    expect(transferForm.showTransferForm.value).toBe(true);
    expect(transferForm.showTransferDetails.value).toBe(true);
    expect(transferForm.transferForm.value.from_user_id).toBe('1');
    expect(transferForm.transferForm.value.to_user_id).toBe('2');
    expect(transferForm.transferForm.value.amount).toBe('80');
    expect(transferForm.transferForm.value.date).toBe('2026-08-01');
    expect(transferForm.transferForm.value.note).toBe('Mietwagenanteil');

    transferForm.transferForm.value.amount = '95.50';
    await transferForm.submitTransfer();

    expect(budgetStore.updateTransfer).toHaveBeenCalledWith(99, {
      from_user_id: 1,
      to_user_id: 2,
      amount: 95.5,
      date: '2026-08-01',
      note: 'Mietwagenanteil',
    });
    expect(transferForm.showTransferForm.value).toBe(false);
    expect(transferForm.editingTransfer.value).toBeNull();
  });
});
