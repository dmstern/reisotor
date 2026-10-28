// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DiaryNewModal from './DiaryNewModal.vue';
import { useAuthStore } from '../stores/auth';
import type { User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: 10 }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('DiaryNewModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const authStore = useAuthStore();
    authStore.user = { id: 1, username: 'tester', restricted: false } as unknown as User;

    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function mountModal(
    props: InstanceType<typeof DiaryNewModal>['$props'],
    initialUser?: Partial<User>
  ) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const authStore = useAuthStore(pinia);
    authStore.user = (initialUser ?? {
      id: 1,
      username: 'tester',
      restricted: false,
    }) as unknown as User;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(DiaryNewModal, props),
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

  it('rendert Dialog mit Titel und Formularfeldern', async () => {
    const { cleanUp } = mountModal({
      modelValue: true,
      tripId: 1,
    });
    await nextTick();

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain('Neuer Tagebucheintrag');
    expect(bodyHtml).toContain('Datum');
    expect(bodyHtml).toContain('Titel');
    expect(bodyHtml).toContain('Eintrag');
    expect(bodyHtml).toContain('Eintragen');
    expect(bodyHtml).toContain('Abbrechen');
    cleanUp();
  });

  it('zeigt Bilder hinzufügen Button, wenn Nutzer nicht restricted ist', async () => {
    const { cleanUp } = mountModal({
      modelValue: true,
      tripId: 1,
    });
    await nextTick();

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain('Bilder hinzufügen');
    cleanUp();
  });

  it('zeigt Bilder hinzufügen Button mit Plus-Badge auch wenn Nutzer restricted ist', async () => {
    const { cleanUp } = mountModal(
      {
        modelValue: true,
        tripId: 1,
      },
      { id: 2, username: 'basis', restricted: true }
    );
    await nextTick();

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain('Bilder hinzufügen');
    expect(bodyHtml).toContain('Plus');
    cleanUp();
  });
});
