// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetPotModal from './BudgetPotModal.vue';
import { useBudgetStore } from '../stores/budget';
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

describe('BudgetPotModal', () => {
  beforeEach(() => {
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
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(BudgetPotModal, props),
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
});
