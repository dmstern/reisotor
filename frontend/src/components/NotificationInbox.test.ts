// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { renderToString } from 'vue/server-renderer';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

import NotificationInbox from './NotificationInbox.vue';
import { useNotificationsStore } from '../stores/notifications';
import { usePwaUpdateStore } from '../stores/pwaUpdate';
import { usePwaInstallStore } from '../stores/pwaInstall';

describe('NotificationInbox', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: ReturnType<typeof createRouter>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    });
    await router.push('/');
    await router.isReady();
    localStorage.clear();
  });

  async function renderInbox() {
    const app = createApp({
      render: () => h(NotificationInbox),
    });
    app.use(pinia);
    app.use(router);
    return renderToString(app);
  }

  it('renders no badge and no dot when there are no unread items or system notices', async () => {
    const pwaInstall = usePwaInstallStore();
    pwaInstall.isStandalone = true; // no install notice

    const html = await renderInbox();
    expect(html).not.toContain('unread-badge');
    expect(html).not.toContain('bell-dot');
    expect(html).not.toContain('unseen-dot');
    expect(html).toContain('aria-label="Benachrichtigungen"');
  });

  it('renders unseen-dot (roter Punkt) when system notices exist and unreadCount is 0', async () => {
    const pwaInstall = usePwaInstallStore();
    pwaInstall.isStandalone = false;
    pwaInstall.dismissed = false; // "Als App installierbar" active

    const html = await renderInbox();
    expect(html).not.toContain('unread-badge');
    expect(html).toContain('bell-dot');
    expect(html).toContain('unseen-dot');
    expect(html).toContain('aria-label="Benachrichtigungen (Neuigkeiten verfügbar)"');
  });

  it('renders unseen-dot when pwa update needRefresh is true', async () => {
    const pwaInstall = usePwaInstallStore();
    pwaInstall.isStandalone = true;
    const pwaUpdate = usePwaUpdateStore();
    pwaUpdate.needRefresh = true;

    const html = await renderInbox();
    expect(html).not.toContain('unread-badge');
    expect(html).toContain('bell-dot');
    expect(html).toContain('unseen-dot');
  });

  it('renders unread-badge with count when notifications.unreadCount > 0', async () => {
    const notifications = useNotificationsStore();
    notifications.items = [
      {
        id: 1,
        trip_id: 1,
        domain: 'packing',
        entity_id: null,
        action: 'create',
        action_label: 'etwas geändert',
        domain_label: 'Packliste',
        created_at: new Date().toISOString(),
        read: false,
        actor: { id: 2, username: 'Alice', avatar: null },
      },
    ];

    const html = await renderInbox();
    expect(html).toContain('unread-badge');
    expect(html).toContain('>1<');
    expect(html).not.toContain('bell-dot');
    expect(html).toContain('aria-label="Benachrichtigungen (1 ungelesen)"');
  });
});
