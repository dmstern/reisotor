// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PackingEditModal from './PackingEditModal.vue';
import { useAuthStore } from '../stores/auth';
import type { PackingItem, User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: 10 }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

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
  };
}

describe('PackingEditModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const dummyItem: PackingItem = {
    id: 15,
    trip_id: 1,
    label: 'Badehose',
    category: 'Kleidung',
    subcategory: 'Schwimmsachen',
    quantity: 2,
    laid_out_count: 1,
    packed_count: 1,
    owner_id: 1,
  };

  const dummyUsers: User[] = [
    { id: 1, username: 'tester', email: 'tester@example.com', avatar: '🐱' },
  ];

  function mountModal(props: Partial<InstanceType<typeof PackingEditModal>['$props']> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const authStore = useAuthStore();
    authStore.user = dummyUsers[0];

    let emittedSubmit: unknown = null;
    let emittedClose = false;

    const fullProps = {
      item: dummyItem,
      users: dummyUsers,
      categories: ['Kleidung', 'Elektronik'],
      subcategories: ['Schwimmsachen'],
      categoryRequired: false,
      onSubmit: (...args: unknown[]) => {
        emittedSubmit = args;
      },
      onClose: () => {
        emittedClose = true;
      },
      ...props,
    };

    const app = createApp({
      render: () => h(PackingEditModal, fullProps),
    });
    app.use(pinia);
    app.mount(container);

    return {
      getEmittedSubmit: () => emittedSubmit,
      getEmittedClose: () => emittedClose,
    };
  }

  it('rendert die vorhandenen Daten des Gegenstands', async () => {
    mountModal();
    await nextTick();

    const titleInput = document.body.querySelector(
      'input[placeholder="Gegenstand"]'
    ) as HTMLInputElement;
    expect(titleInput).not.toBeNull();
    expect(titleInput.value).toBe('Badehose');
  });

  it('übermittelt beim Speichern die aktualisierten Daten', async () => {
    const { getEmittedSubmit, getEmittedClose } = mountModal();
    await nextTick();

    const titleInput = document.body.querySelector(
      'input[placeholder="Gegenstand"]'
    ) as HTMLInputElement;
    titleInput.value = 'Badehose rot';
    titleInput.dispatchEvent(new Event('input'));
    await nextTick();

    const form = document.body.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await nextTick();

    expect(getEmittedSubmit()).toEqual([
      15,
      {
        label: 'Badehose rot',
        category: 'Kleidung',
        subcategory: 'Schwimmsachen',
        quantity: 2,
        ownerId: '1',
      },
      1,
      1,
    ]);
    expect(getEmittedClose()).toBe(true);
  });
});
