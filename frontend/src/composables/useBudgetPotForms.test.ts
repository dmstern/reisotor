// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useBudgetPotForms } from './useBudgetPotForms';
import { useBudgetStore } from '../stores/budget';
import { useAuthStore } from '../stores/auth';
import type { Budget } from '../api/types';

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

describe('useBudgetPotForms', () => {
  let budgetStore: ReturnType<typeof useBudgetStore>;
  let authStore: ReturnType<typeof useAuthStore>;

  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    budgetStore = useBudgetStore();
    authStore = useAuthStore();

    authStore.user = {
      id: 7,
      email: 'test@example.com',
      username: 'TestUser',
      avatar: '✈️',
    } as any;

    vi.spyOn(budgetStore, 'addBudget').mockResolvedValue({} as any);
    vi.spyOn(budgetStore, 'updateBudget').mockResolvedValue({} as any);
    vi.spyOn(budgetStore, 'removeBudget').mockResolvedValue();
  });

  it('initializes with closed form and empty new budget state', () => {
    const potForms = useBudgetPotForms({ tripId: 123 });
    expect(potForms.showNewBudgetForm.value).toBe(false);
    expect(potForms.newBudgetForm.value).toEqual({
      name: '',
      kind: 'shared',
      target_amount: '',
    });
    expect(potForms.editingBudget.value).toBeNull();
  });

  it('adds a shared budget and resets form', async () => {
    const potForms = useBudgetPotForms({ tripId: 123 });
    potForms.showNewBudgetForm.value = true;
    potForms.newBudgetForm.value = {
      name: 'Eis & Snacks',
      kind: 'shared',
      target_amount: '50.50',
    };

    await potForms.addBudget();

    expect(budgetStore.addBudget).toHaveBeenCalledWith(123, {
      name: 'Eis & Snacks',
      owner_id: undefined,
      target_amount: 50.5,
    });
    expect(potForms.showNewBudgetForm.value).toBe(false);
    expect(potForms.newBudgetForm.value.name).toBe('');
  });

  it('adds a personal budget with auth owner_id', async () => {
    const potForms = useBudgetPotForms({ tripId: 123 });
    potForms.newBudgetForm.value = {
      name: 'Privates Shopping',
      kind: 'personal',
      target_amount: '',
    };

    await potForms.addBudget();

    expect(budgetStore.addBudget).toHaveBeenCalledWith(123, {
      name: 'Privates Shopping',
      owner_id: 7,
      target_amount: undefined,
    });
  });

  it('opens and populates edit form for an existing budget', () => {
    const potForms = useBudgetPotForms({ tripId: 123 });
    const mockBudget: Budget = {
      id: 10,
      trip_id: 123,
      name: 'Transport',
      owner_id: null,
      target_amount: 200,
    };

    potForms.startEditBudget(mockBudget);

    expect(potForms.editingBudget.value).toEqual(mockBudget);
    expect(potForms.editBudgetForm.value).toEqual({
      name: 'Transport',
      kind: 'shared',
      target_amount: '200',
    });
  });

  it('submits edit budget and closes form', async () => {
    const potForms = useBudgetPotForms({ tripId: 123 });
    const mockBudget: Budget = {
      id: 10,
      trip_id: 123,
      name: 'Transport',
      owner_id: null,
      target_amount: 200,
    };

    potForms.startEditBudget(mockBudget);
    potForms.editBudgetForm.value.name = 'Mobilität';
    potForms.editBudgetForm.value.target_amount = '250';

    await potForms.submitEditBudget();

    expect(budgetStore.updateBudget).toHaveBeenCalledWith(10, {
      name: 'Mobilität',
      owner_id: null,
      target_amount: 250,
    });
    expect(potForms.editingBudget.value).toBeNull();
  });

  it('deletes editing budget and closes edit modal', async () => {
    const potForms = useBudgetPotForms({ tripId: 123 });
    const mockBudget: Budget = {
      id: 10,
      trip_id: 123,
      name: 'Transport',
      owner_id: null,
      target_amount: 200,
    };

    potForms.startEditBudget(mockBudget);
    await potForms.deleteEditingBudget();

    expect(budgetStore.removeBudget).toHaveBeenCalledWith(10);
    expect(potForms.editingBudget.value).toBeNull();
  });
});
