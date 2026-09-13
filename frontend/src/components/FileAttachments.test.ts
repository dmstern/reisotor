import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import FileAttachments from './FileAttachments.vue';
import type { Attachment } from '../api/types';

function createTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
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
});
