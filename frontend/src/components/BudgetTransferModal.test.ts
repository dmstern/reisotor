// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import BudgetTransferModal from './BudgetTransferModal.vue';
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

describe('BudgetTransferModal', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    const store = useBudgetStore();
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
    suggestion?: any;
    'onUpdate:modelValue'?: (v: boolean) => void;
    onSubmitted?: () => void;
  }) {
    const pinia = createPinia();
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
});
