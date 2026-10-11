// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import DiaryEditModal from './DiaryEditModal.vue';
import { useAuthStore } from '../stores/auth';
import type { DiaryEntry, User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: 10 }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('DiaryEditModal', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const dummyEntry: DiaryEntry = {
    id: 42,
    trip_id: 1,
    author_id: 1,
    title: 'Tolles Erlebnis',
    content: '<p>Heute waren wir am Strand.</p>',
    content_format: 'html',
    images: [],
    excursion_ids: [],
    spot_ids: [],
    editor_ids: [],
    date: '2026-07-20',
    is_draft: 0,
    created_at: '2026-07-20T10:00:00Z',
    updated_at: null,
  };

  function mountModal(props: InstanceType<typeof DiaryEditModal>['$props']) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const authStore = useAuthStore();
    authStore.user = { id: 1, username: 'tester', restricted: false } as unknown as User;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(DiaryEditModal, props),
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

  it('rendert Dialog mit Titel und Löschen-Button für den Autor', async () => {
    const { cleanUp } = mountModal({
      entry: dummyEntry,
    });
    await nextTick();

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain('Eintrag bearbeiten');
    expect(bodyHtml).toContain('Löschen');
    expect(bodyHtml).toContain('Speichern');
    expect(bodyHtml).toContain('Abbrechen');
    cleanUp();
  });

  it('zeigt Veröffentlichen-Button bei Entwürfen', async () => {
    const { cleanUp } = mountModal({
      entry: { ...dummyEntry, is_draft: 1 },
    });
    await nextTick();

    const bodyHtml = document.body.innerHTML;
    expect(bodyHtml).toContain('Eintrag anlegen');
    expect(bodyHtml).toContain('Veröffentlichen');
    cleanUp();
  });
});
