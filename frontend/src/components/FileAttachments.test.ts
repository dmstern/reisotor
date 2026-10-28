// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import FileAttachments from './FileAttachments.vue';
import type { Attachment, User } from '../api/types';
import { api, ApiError } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useAccountTierModal } from '../composables/useAccountTierModal';

function createTestApp(
  rootComponent: Component,
  props: Record<string, unknown> = {},
  initialUser?: Partial<User>
) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const authStore = useAuthStore(pinia);
  if (initialUser) {
    authStore.user = initialUser as User;
  }
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  return app;
}

const mockAttachments: Attachment[] = [
  {
    id: 1,
    trip_id: 1,
    domain: 'spots',
    entity_id: 10,
    filename: 'beach.jpg',
    original_name: 'Strand.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 500000,
    uploaded_by: 1,
    created_at: '2026-06-01T10:00:00Z',
    url: 'https://example.com/beach.jpg',
  },
  {
    id: 2,
    trip_id: 1,
    domain: 'spots',
    entity_id: 10,
    filename: 'tickets.pdf',
    original_name: 'Tickets.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1200000,
    uploaded_by: 1,
    created_at: '2026-06-01T10:05:00Z',
    url: '/api/uploads/tickets.pdf',
  },
];

describe('FileAttachments component', () => {
  it('renders nothing visible when editable=false and attachments list is empty', async () => {
    const app = createTestApp(FileAttachments, {
      domain: 'spots',
      entityId: 10,
      editable: false,
      initialAttachments: [],
    });
    const html = await renderToString(app);
    expect(html).not.toContain('file-attachments');
    expect(html).not.toContain('attachments-badge');
    expect(html).not.toContain('heading');
  });

  it('renders a paperclip badge with count in collapsed view mode', async () => {
    const app = createTestApp(FileAttachments, {
      domain: 'spots',
      entityId: 10,
      editable: false,
      collapsed: true,
      initialAttachments: mockAttachments,
    });
    const html = await renderToString(app);

    expect(html).toContain('attachments-badge');
    expect(html).toContain('attachments-badge-count');
    expect(html).toContain('>2<');
    expect(html).toContain('2 Anhänge (Klicken für Vorschau)');
    // In collapsed mode, full stack and heading should not be rendered
    expect(html).not.toContain('polaroid-stack');
    expect(html).not.toContain('<h4 class="heading">');
  });

  it('renders single attachment count with singular tooltip in collapsed mode', async () => {
    const app = createTestApp(FileAttachments, {
      domain: 'spots',
      entityId: 10,
      editable: false,
      collapsed: true,
      initialAttachments: [mockAttachments[0]],
    });
    const html = await renderToString(app);

    expect(html).toContain('attachments-badge');
    expect(html).toContain('>1<');
    expect(html).toContain('1 Anhang (Klicken für Vorschau)');
  });

  it('renders full PolaroidStack when not collapsed in view mode', async () => {
    const app = createTestApp(FileAttachments, {
      domain: 'spots',
      entityId: 10,
      editable: false,
      collapsed: false,
      initialAttachments: mockAttachments,
    });
    const html = await renderToString(app);

    expect(html).toContain('heading');
    expect(html).toContain('Anhänge');
    expect(html).toContain('polaroid-stack');
    expect(html).not.toContain('attachments-badge');
  });

  it('handles api.get failure during load() gracefully without unhandled rejection (#527)', async () => {
    const unhandledRejections: unknown[] = [];
    const onUnhandled = (e: PromiseRejectionEvent) => {
      unhandledRejections.push(e.reason);
    };
    window.addEventListener('unhandledrejection', onUnhandled);

    vi.spyOn(api, 'get').mockRejectedValue(
      new ApiError(502, 'Bad Gateway (Server nicht erreichbar)')
    );

    const container = document.createElement('div');
    const app = createTestApp(FileAttachments, {
      domain: 'ideas',
      entityId: 14,
      editable: false,
    });
    app.mount(container);

    await new Promise((r) => setTimeout(r, 50));

    expect(unhandledRejections).toHaveLength(0);
    app.unmount();
    window.removeEventListener('unhandledrejection', onUnhandled);
  });

  it('shows file upload button with Plus badge for restricted user and opens modal on click', async () => {
    const { isOpen, highlightedFeature, closeAccountTierModal } = useAccountTierModal();
    closeAccountTierModal();

    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createTestApp(
      FileAttachments,
      {
        domain: 'spots',
        entityId: 10,
        editable: true,
        initialAttachments: [],
      },
      { id: 2, username: 'restricted', restricted: true }
    );
    app.mount(container);

    expect(container.textContent).toContain('Datei hinzufügen');
    expect(container.textContent).toContain('Plus');

    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Datei hinzufügen')
    );
    expect(button).toBeDefined();
    button?.click();

    expect(isOpen.value).toBe(true);
    expect(highlightedFeature.value).toBe('uploads');

    app.unmount();
    container.remove();
  });
});
