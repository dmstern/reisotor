// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetExpenseModal from './BudgetExpenseModal.vue';
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
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountModal(props: {
    modelValue: boolean;
    expense?: BudgetExpense | null;
    'onUpdate:modelValue'?: (v: boolean) => void;
    onSaved?: () => void;
  }) {
    const pinia = createPinia();
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

    cleanUp();
  });
});
