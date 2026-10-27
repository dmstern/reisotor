// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetExpenseModal from './BudgetExpenseModal.vue';
import { useBudgetStore } from '../stores/budget';
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

describe('BudgetExpenseModal', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountModal(props: {
    modelValue: boolean;
    expense?: BudgetExpense | null;
    initialType?: 'expense' | 'income';
    'onUpdate:modelValue'?: (v: boolean) => void;
    onSaved?: () => void;
    onDeleted?: () => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetExpenseModal, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders "Ausgabe eintragen" title in create mode', async () => {
    const { cleanUp } = mountModal({ modelValue: true, expense: null });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Ausgabe eintragen');
    cleanUp();
  });

  it('renders "Ausgabe bearbeiten" and populates fields in edit mode', async () => {
    const mockExpense: BudgetExpense = {
      id: 88,
      trip_id: 1,
      title: 'Konzertkarten',
      amount: 75,
      category: 'Kultur',
      paid_by_user_id: 1,
      date: '2026-07-12',
      note: 'Stehplatz',
      budget_id: null,
    };

    const { cleanUp } = mountModal({ modelValue: true, expense: mockExpense });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Ausgabe bearbeiten');

    const titleInput = document.querySelector('input[placeholder*="Titel"]') as HTMLInputElement;
    expect(titleInput?.value).toBe('Konzertkarten');

    const deleteBtn = document.querySelector('button.btn--danger');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toContain('Löschen');

    cleanUp();
  });

  it('calls removeExpense and emits deleted when clicking delete button', async () => {
    const store = useBudgetStore();
    const removeSpy = vi.spyOn(store, 'removeExpense').mockResolvedValue(undefined);
    const onDeleted = vi.fn();

    const mockExpense: BudgetExpense = {
      id: 88,
      trip_id: 1,
      title: 'Konzertkarten',
      amount: 75,
      category: 'Kultur',
      paid_by_user_id: 1,
      date: '2026-07-12',
      note: 'Stehplatz',
      budget_id: null,
    };

    const { cleanUp } = mountModal({
      modelValue: true,
      expense: mockExpense,
      onDeleted,
    });
    await nextTick();

    const deleteBtn = document.querySelector('button.btn--danger') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();
    await nextTick();

    expect(removeSpy).toHaveBeenCalledWith(88);
    expect(onDeleted).toHaveBeenCalled();

    cleanUp();
  });

  it('renders "Einnahme bearbeiten" and shows positive amount when expense has amount < 0', async () => {
    const mockIncome: BudgetExpense = {
      id: 99,
      trip_id: 1,
      title: 'Zuschuss Oma',
      amount: -100,
      category: 'Zuschuss',
      paid_by_user_id: 1,
      date: '2026-07-12',
      note: 'Viel Spaß im Urlaub!',
      budget_id: null,
    };

    const { cleanUp } = mountModal({ modelValue: true, expense: mockIncome });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Einnahme bearbeiten');

    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    expect(amountInput?.value).toBe('100');

    cleanUp();
  });

  it('renders "Einnahme eintragen" when initialType is income', async () => {
    const { cleanUp } = mountModal({
      modelValue: true,
      expense: null,
      initialType: 'income',
    });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Einnahme eintragen');

    cleanUp();
  });

  it('allows choosing "Gemeinsam (Reisekasse / Barkasse)" for expenses and submits with paid_by_user_id null', async () => {
    const store = useBudgetStore();
    store.users = [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
    ];
    const submitSpy = vi
      .spyOn(store, 'submitExpense')
      .mockResolvedValue({} as unknown as BudgetExpense);

    const { cleanUp } = mountModal({ modelValue: true, expense: null });
    await nextTick();

    const titleInput = document.querySelector('input[placeholder*="Titel"]') as HTMLInputElement;
    titleInput.value = 'Gruppentickets';
    titleInput.dispatchEvent(new Event('input'));

    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    amountInput.value = '60';
    amountInput.dispatchEvent(new Event('input'));

    const paidBySelect = document.querySelectorAll('select')[0] as HTMLSelectElement;
    expect(paidBySelect).not.toBeNull();
    // Prüfen, ob die Option für gemeinsame Reisekasse/Barkasse vorhanden ist
    const jointOption = Array.from(paidBySelect.options).find((opt) => opt.value === '');
    expect(jointOption?.text).toContain('Gemeinsam (Reisekasse / Barkasse)');

    paidBySelect.value = '';
    paidBySelect.dispatchEvent(new Event('change'));

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await nextTick();

    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Gruppentickets',
        amount: 60,
        paid_by_user_id: null,
      })
    );

    cleanUp();
  });

  it('locks paid_by_user_id to owner and disables the select when a private pot is selected', async () => {
    const store = useBudgetStore();
    store.users = [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
    ];
    store.budgets = [
      { id: 10, trip_id: 1, name: 'Bobs Taschengeld', owner_id: 2, target_amount: 100 },
    ];
    const submitSpy = vi
      .spyOn(store, 'submitExpense')
      .mockResolvedValue({} as unknown as BudgetExpense);

    const { cleanUp } = mountModal({ modelValue: true, expense: null });
    await nextTick();

    const titleInput = document.querySelector('input[placeholder*="Titel"]') as HTMLInputElement;
    titleInput.value = 'Souvenir für Bob';
    titleInput.dispatchEvent(new Event('input'));

    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    amountInput.value = '25';
    amountInput.dispatchEvent(new Event('input'));

    // Details ausklappen und Budget 10 auswählen
    const budgetSelect = document.querySelectorAll('select')[1] as HTMLSelectElement;
    expect(budgetSelect).not.toBeNull();
    budgetSelect.value = '10';
    budgetSelect.dispatchEvent(new Event('change'));
    await nextTick();

    // Der "Bezahlt von"-Select muss nun auf Bob (User 2) fixiert und disabled sein
    const paidBySelect = document.querySelectorAll('select')[0] as HTMLSelectElement;
    expect(paidBySelect.disabled).toBe(true);
    expect(paidBySelect.value).toBe('2');

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await nextTick();

    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Souvenir für Bob',
        amount: 25,
        paid_by_user_id: 2,
        budget_id: 10,
      })
    );

    cleanUp();
  });
});
