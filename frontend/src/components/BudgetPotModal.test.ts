// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetPotModal from './BudgetPotModal.vue';
import type { Budget } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import { useTripStore } from '../stores/trip';

const mockShowToast = vi.fn();
vi.mock('../composables/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

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

describe('BudgetPotModal', () => {
  beforeEach(() => {
    mockShowToast.mockClear();
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountModal(props: {
    modelValue: boolean;
    budget?: Budget | null;
    'onUpdate:modelValue'?: (v: boolean) => void;
    onSaved?: () => void;
    onDeleted?: () => void;
  }) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useBudgetStore();
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetPotModal, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      store,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders "Budget anlegen" title when creating a new budget', async () => {
    const { cleanUp } = mountModal({ modelValue: true, budget: null });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Budget anlegen');
    cleanUp();
  });

  it('renders "Budget bearbeiten" and delete button when editing an existing budget', async () => {
    const mockBudget: Budget = {
      id: 5,
      trip_id: 1,
      name: 'Verpflegung',
      owner_id: null,
      target_amount: 300,
    };

    const { cleanUp } = mountModal({ modelValue: true, budget: mockBudget });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Budget bearbeiten');

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(nameInput?.value).toBe('Verpflegung');

    const deleteBtn = document.querySelector('button.btn--danger');
    expect(deleteBtn).not.toBeNull();

    cleanUp();
  });

  it('renders currency-neutral coins icon for Gesamtziel instead of a dollar sign', async () => {
    const { cleanUp } = mountModal({ modelValue: true, budget: null });
    await nextTick();

    const coinsIcon = document.querySelector('.tabler-icon-coins');
    expect(coinsIcon).not.toBeNull();

    // Ensure legacy dollar icon (tabler-icon-coin) is NOT present
    const dollarIcon = document.querySelector('.tabler-icon-coin');
    expect(dollarIcon).toBeNull();

    cleanUp();
  });

  it('shows toast "Budget angelegt." when submitting a new budget', async () => {
    const onSaved = vi.fn();
    const { cleanUp, store } = mountModal({ modelValue: true, budget: null, onSaved });
    const addSpy = vi.spyOn(store, 'addBudget').mockResolvedValue({ id: 10 } as unknown as Budget);
    await nextTick();

    const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    nameInput.value = 'Mietwagen';
    nameInput.dispatchEvent(new Event('input'));
    await nextTick();

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();

    expect(addSpy).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Budget angelegt.',
      type: 'success',
    });

    cleanUp();
  });

  it('shows toast "Budget aktualisiert." when updating an existing budget', async () => {
    const mockBudget: Budget = {
      id: 5,
      trip_id: 1,
      name: 'Verpflegung',
      owner_id: null,
      target_amount: 300,
    };
    const onSaved = vi.fn();
    const { cleanUp, store } = mountModal({ modelValue: true, budget: mockBudget, onSaved });
    const updateSpy = vi
      .spyOn(store, 'updateBudget')
      .mockResolvedValue({ id: 5 } as unknown as Budget);
    await nextTick();

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();

    expect(updateSpy).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Budget aktualisiert.',
      type: 'success',
    });

    cleanUp();
  });

  it('shows toast "Budget gelöscht. Es befindet sich nun im Papierkorb." when deleting a budget', async () => {
    const mockBudget: Budget = {
      id: 5,
      trip_id: 1,
      name: 'Verpflegung',
      owner_id: null,
      target_amount: 300,
    };
    const onDeleted = vi.fn();
    const { cleanUp, store } = mountModal({ modelValue: true, budget: mockBudget, onDeleted });
    const removeSpy = vi.spyOn(store, 'removeBudget').mockResolvedValue(undefined);
    await nextTick();

    const deleteBtn = document.querySelector('button.btn--danger') as HTMLButtonElement;
    deleteBtn.click();
    await nextTick();

    expect(removeSpy).toHaveBeenCalledWith(5);
    expect(onDeleted).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Budget gelöscht. Es befindet sich nun im Papierkorb.',
      type: 'info',
    });

    cleanUp();
  });
});
