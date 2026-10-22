// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PendingSyncCard from './PendingSyncCard.vue';
import { clearOutbox, enqueue, getOutbox, updateOutboxEntry } from '../../api/offline';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe('PendingSyncCard', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const memory = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: memory,
      configurable: true,
      writable: true,
    });
    clearOutbox();

    const pinia = createPinia();
    setActivePinia(pinia);

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  function mountComponent() {
    app = createApp(
      defineComponent({
        render: () => h(PendingSyncCard),
      })
    );
    app.use(createPinia());
    app.mount(container);
  }

  it('renders empty state when outbox is empty', async () => {
    mountComponent();
    await nextTick();

    expect(container.textContent).toContain('Nicht-synchronisierte Inhalte');
    expect(container.textContent).toContain('Alle Daten synchron');
  });

  it('renders list of pending items with human-readable titles', async () => {
    enqueue('POST', '/todos', { title: 'Strandtuch kaufen' });
    enqueue('PUT', '/budget/10', { title: 'Abendessen', amount: 35.5 });

    mountComponent();
    await nextTick();

    expect(container.textContent).toContain('2 ausstehend');
    expect(container.textContent).toContain('Strandtuch kaufen');
    expect(container.textContent).toContain('Abendessen');
  });

  it('displays error alert when an entry has lastError', async () => {
    enqueue('POST', '/budget', { amount: 10, title: 'Snacks' });
    const entries = getOutbox();
    updateOutboxEntry(entries[0].id, {
      body: entries[0].body,
    });
    // Set lastError directly
    const stored = getOutbox();
    stored[0].lastError = {
      status: 500,
      message: 'Internal Server Error on dev backend',
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('reisotor-outbox', JSON.stringify(stored));

    mountComponent();
    await nextTick();

    expect(container.textContent).toContain('Fehler bei Übertragung (HTTP 500)');
    expect(container.textContent).toContain('Internal Server Error on dev backend');
  });

  it('removes item when discard is confirmed', async () => {
    enqueue('POST', '/notes', { title: 'Wichtige Notiz' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    mountComponent();
    await nextTick();

    expect(container.textContent).toContain('Wichtige Notiz');

    const deleteBtn = container.querySelector(
      'button[aria-label*="Wichtige Notiz"]'
    ) as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();
    await nextTick();

    expect(getOutbox()).toHaveLength(0);
    expect(container.textContent).toContain('Alle Daten synchron');
  });
});
