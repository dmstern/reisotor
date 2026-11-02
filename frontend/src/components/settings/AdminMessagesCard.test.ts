// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import AdminMessagesCard from './AdminMessagesCard.vue';
import { api, ApiError } from '../../api/client';
import type { AdminMessage } from '../../api/types';

const sampleMessages: AdminMessage[] = [
  {
    id: 1,
    type: 'registration_help',
    name: 'Anna Schmidt',
    email: 'anna@example.com',
    username: 'anna',
    message: 'Ich kann mich nicht registrieren.',
    status: 'unread',
    created_at: new Date().toISOString(),
    matchedUser: {
      id: 10,
      username: 'anna',
      is_email_verified: false,
    },
  },
  {
    id: 2,
    type: 'login_help',
    name: 'Ben',
    email: 'ben@example.com',
    username: 'ben',
    message: 'Alles erledigt.',
    status: 'resolved',
    created_at: new Date().toISOString(),
    matchedUser: null,
  },
];

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
  },
}));

describe('AdminMessagesCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  function mountComponent() {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(AdminMessagesCard),
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

  it('loads and renders admin messages with unread badge and actions', async () => {
    vi.mocked(api.get).mockResolvedValue({
      messages: structuredClone(sampleMessages),
      unreadCount: 1,
    });

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(api.get).toHaveBeenCalledWith('/admin/messages');
    expect(container.textContent).toContain('Kontaktanfragen & Anmeldeprobleme');
    expect(container.textContent).toContain('1 ungelesen');
    expect(container.textContent).toContain('Anna Schmidt');
    expect(container.textContent).toContain('Ich kann mich nicht registrieren.');

    // Matched user box with unverified badge and action
    expect(container.textContent).toContain('Gefundenes Konto: anna');
    expect(container.textContent).toContain('E-Mail unbestätigt');
    expect(container.textContent).toContain('Account freischalten');

    cleanUp();
  });

  it('allows verifying matched user account and marks as resolved', async () => {
    vi.mocked(api.get).mockResolvedValue({
      messages: structuredClone(sampleMessages),
      unreadCount: 1,
    });
    vi.mocked(api.post).mockResolvedValue({ success: true });
    vi.mocked(api.put).mockResolvedValue({ success: true });

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    const verifyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Account freischalten')
    );
    expect(verifyBtn).toBeDefined();

    verifyBtn!.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(api.post).toHaveBeenCalledWith('/users/10/verify-email');
    expect(api.put).toHaveBeenCalledWith('/admin/messages/1/status', { status: 'resolved' });

    cleanUp();
  });

  it('displays action error banner when status update or verify fails', async () => {
    vi.mocked(api.get).mockResolvedValue({
      messages: structuredClone(sampleMessages),
      unreadCount: 1,
    });
    vi.mocked(api.post).mockRejectedValue(new ApiError(500, 'Serverfehler beim Freischalten'));

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    const verifyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Account freischalten')
    );
    expect(verifyBtn).toBeDefined();

    verifyBtn!.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelector('.error-banner')?.textContent).toContain(
      'Serverfehler beim Freischalten'
    );

    cleanUp();
  });
});
