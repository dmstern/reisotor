// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetTransferModal from './BudgetTransferModal.vue';
import { useBudgetStore } from '../stores/budget';

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

describe('BudgetTransferModal', () => {
  let pinia: ReturnType<typeof createPinia>;
  let store: ReturnType<typeof useBudgetStore>;

  beforeEach(() => {
    mockShowToast.mockClear();
    vi.stubGlobal('EventSource', MockEventSource);
    pinia = createPinia();
    setActivePinia(pinia);
    store = useBudgetStore();
    store.users = [
      { id: 1, username: 'Alice', avatar: '👩' },
      { id: 2, username: 'Bob', avatar: '👨' },
    ] as any;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountModal(props: {
    modelValue: boolean;
    transfer?: any;
    suggestion?: any;
    'onUpdate:modelValue'?: (v: boolean) => void;
    onSubmitted?: () => void;
    onSaved?: () => void;
    onDeleted?: () => void;
  }) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetTransferModal, props),
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

  it('renders "Überweisung eintragen" title', async () => {
    const { cleanUp } = mountModal({ modelValue: true });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Überweisung eintragen');
    cleanUp();
  });

  it('populates fields when settlement suggestion is passed', async () => {
    const suggestion = {
      from: { id: 1, username: 'Alice', avatar: '👩' },
      to: { id: 2, username: 'Bob', avatar: '👨' },
      amount: 45.5,
    };

    const { cleanUp } = mountModal({ modelValue: true, suggestion });
    await nextTick();

    const amountInput = document.querySelector('input[placeholder*="Betrag"]') as HTMLInputElement;
    expect(amountInput?.value).toBe('45.50');

    cleanUp();
  });

  it('renders "Überweisung bearbeiten" and delete button when editing an existing transfer', async () => {
    const transfer = {
      id: 12,
      trip_id: 1,
      from_user_id: 1,
      to_user_id: 2,
      amount: 120,
      date: '2026-11-01',
      note: 'Teilausgleich für Hotel',
    };

    const { cleanUp } = mountModal({ modelValue: true, transfer });
    await nextTick();

    const titleEl = document.querySelector('.modal-head h2');
    expect(titleEl?.textContent).toContain('Überweisung bearbeiten');

    const amountInput = document.querySelector('input[placeholder*="Betrag"]') as HTMLInputElement;
    expect(amountInput?.value).toBe('120');

    const deleteBtn = document.querySelector('button.btn--danger');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toContain('Löschen');

    cleanUp();
  });

  it('calls removeTransfer and emits deleted when clicking delete button', async () => {
    const transfer = {
      id: 12,
      trip_id: 1,
      from_user_id: 1,
      to_user_id: 2,
      amount: 120,
      date: '2026-11-01',
      note: 'Teilausgleich für Hotel',
    };
    const removeSpy = vi.spyOn(store, 'removeTransfer').mockResolvedValue(undefined as any);
    const onDeleted = vi.fn();

    const { cleanUp } = mountModal({ modelValue: true, transfer, onDeleted });
    await nextTick();

    const deleteBtn = document.querySelector('button.btn--danger') as HTMLButtonElement;
    deleteBtn.click();
    await nextTick();

    expect(removeSpy).toHaveBeenCalledWith(12);
    expect(onDeleted).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Überweisung gelöscht. Sie befindet sich nun im Papierkorb.',
      type: 'info',
    });

    cleanUp();
  });

  it('shows toast "Überweisung eingetragen." when submitting a new transfer', async () => {
    const submitSpy = vi.spyOn(store, 'submitTransfer').mockResolvedValue({ id: 99 } as any);
    const onSaved = vi.fn();

    const { cleanUp } = mountModal({
      modelValue: true,
      suggestion: {
        from: { id: 1, username: 'Alice', avatar: '👩' },
        to: { id: 2, username: 'Bob', avatar: '👨' },
        amount: 25,
      },
      onSaved,
    });
    await nextTick();

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));

    expect(submitSpy).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Überweisung eingetragen.',
      type: 'success',
    });

    cleanUp();
  });

  it('shows toast "Überweisung aktualisiert." when submitting an edited transfer', async () => {
    const transfer = {
      id: 12,
      trip_id: 1,
      from_user_id: 1,
      to_user_id: 2,
      amount: 120,
      date: '2026-11-01',
      note: 'Hotel',
    };
    const updateSpy = vi.spyOn(store, 'updateTransfer').mockResolvedValue({ id: 12 } as any);
    const onSaved = vi.fn();

    const { cleanUp } = mountModal({ modelValue: true, transfer, onSaved });
    await nextTick();

    const form = document.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((r) => setTimeout(r, 10));

    expect(updateSpy).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith({
      message: 'Überweisung aktualisiert.',
      type: 'success',
    });

    cleanUp();
  });
});
