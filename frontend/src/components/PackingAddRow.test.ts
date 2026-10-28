// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PackingAddRow from './PackingAddRow.vue';
import { useAuthStore } from '../stores/auth';
import type { PackingListGroup } from '../composables/usePackingList';
import type { User } from '../api/types';

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

describe('PackingAddRow', () => {
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

  const mockList: PackingListGroup = {
    key: 'user-1',
    title: 'Meine Packliste',
    ownerId: 1,
    items: [],
  };

  function mountComponent(props: Partial<InstanceType<typeof PackingAddRow>['$props']> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const authStore = useAuthStore();
    authStore.user = { id: 1, username: 'tester' } as unknown as User;

    let emittedSubmit: unknown = null;

    const fullProps = {
      list: mockList,
      categories: ['Kleidung', 'Elektronik'],
      subcategories: ['Oberteile'],
      categoryRequired: false,
      onSubmit: (payload: unknown) => {
        emittedSubmit = payload;
      },
      ...props,
    };

    const app = createApp({
      render: () => h(PackingAddRow, fullProps),
    });
    app.use(pinia);
    app.mount(container);

    return {
      getEmittedSubmit: () => emittedSubmit,
    };
  }

  it('rendert das Eingabefeld und Vorbelegungen', async () => {
    mountComponent();
    await nextTick();

    const input = container.querySelector('input.label-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.placeholder).toBe('Neuer Gegenstand');
  });

  it('übermittelt beim Absenden das eingegebene Item', async () => {
    const { getEmittedSubmit } = mountComponent();
    await nextTick();

    const input = container.querySelector('input.label-input') as HTMLInputElement;
    input.value = 'Sonnenbrille';
    input.dispatchEvent(new Event('input'));
    await nextTick();

    const form = container.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    await nextTick();

    expect(getEmittedSubmit()).toEqual({
      label: 'Sonnenbrille',
      category: undefined,
      subcategory: undefined,
      quantity: 1,
    });
  });

  it('belegt Kategorie bei Pflichtfeld vor', async () => {
    mountComponent({ categoryRequired: true });
    await nextTick();

    const categoryInput = container.querySelector(
      '.pack-quick-extra .combobox-input'
    ) as HTMLInputElement;
    expect(categoryInput.value).toBe('Sonstiges');
  });
});
