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
    } as unknown as typeof ResizeObserver;
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

  it('pre-fills role and title when defaultRole and defaultTitle are passed', async () => {
    const { cleanUp } = mountModal({
      show: true,
      excursion: null,
      defaultRole: 'arrival',
      defaultTitle: 'Anreise',
      users: [dummyUser],
    });
    await nextTick();

    const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput.value).toBe('Anreise');

    const roleSelect = document.querySelector('select') as HTMLSelectElement;
    expect(roleSelect.value).toBe('arrival');
    cleanUp();
  });

  it('places the date field below the role field and renders an editable Gemacht status toggle', async () => {
    const { cleanUp } = mountModal({
      show: true,
      excursion: { ...dummyExcursion, done: 1 },
      users: [dummyUser],
    });
    await nextTick();

    const roleSelect = document.querySelector('select') as HTMLSelectElement;
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(roleSelect).not.toBeNull();
    expect(dateInput).not.toBeNull();
    // Datum-Feld steht im DOM nach dem Rollen-Feld
    expect(
      roleSelect.compareDocumentPosition(dateInput) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const doneToggle = document.querySelector('.done-toggle') as HTMLButtonElement;
    expect(doneToggle).not.toBeNull();
    expect(doneToggle.textContent).toContain('Gemacht');
    expect(doneToggle.getAttribute('aria-pressed')).toBe('true');

    doneToggle.click();
    await nextTick();
    expect(doneToggle.getAttribute('aria-pressed')).toBe('false');
    cleanUp();
  });
});
