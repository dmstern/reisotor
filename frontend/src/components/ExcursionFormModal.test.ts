// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ExcursionFormModal from './ExcursionFormModal.vue';
import type { Excursion, User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: 10 }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('ExcursionFormModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const dummyUser: User = {
    id: 1,
    username: 'Max',
    avatar: '🦊',
    email: 'max@example.com',
  };

  const dummyExcursion: Excursion = {
    id: 20,
    trip_id: 1,
    title: 'Fahrradtour am Fluss',
    spot_ids: [1, 2],
    created_by: 1,
  } as unknown as Excursion;

  function mountModal(props: any) {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(ExcursionFormModal, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders "Neue Tour" modal when show is true and excursion is null', async () => {
    const { cleanUp } = mountModal({
      show: true,
      excursion: null,
      users: [dummyUser],
    });
    await nextTick();

    expect(document.body.textContent).toContain('Neue Tour');
    expect(document.body.textContent).toContain('🎒 Ausflug');
    expect(document.body.textContent).toContain('Hinzufügen');
    cleanUp();
  });

  it('renders "Tour bearbeiten" modal when editing an existing excursion', async () => {
    const { cleanUp } = mountModal({
      show: true,
      excursion: dummyExcursion,
      users: [dummyUser],
    });
    await nextTick();

    expect(document.body.textContent).toContain('Tour bearbeiten');
    expect(document.body.textContent).toContain('Speichern');
    expect(document.body.textContent).toContain('Löschen');
    cleanUp();
  });

  it('does not render modal content when show is false and excursion is null', async () => {
    const { cleanUp } = mountModal({
      show: false,
      excursion: null,
      users: [dummyUser],
    });
    await nextTick();

    expect(document.body.textContent).not.toContain('Tour bearbeiten');
    expect(document.body.textContent).not.toContain('Neue Tour');
    cleanUp();
  });
});
