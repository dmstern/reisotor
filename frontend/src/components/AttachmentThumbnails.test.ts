import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import AttachmentThumbnails from './AttachmentThumbnails.vue';

function createTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  return app;
}

describe('AttachmentThumbnails', () => {
  it('renders nothing when items is empty', async () => {
    const app = createTestApp(AttachmentThumbnails, { items: [] });
    const html = await renderToString(app);
    expect(html).toBe('<!---->');
  });

  it('renders mini Polaroid stack and fan pill in stacked state', async () => {
    const app = createTestApp(AttachmentThumbnails, {
      items: [
        'https://example.com/photo1.jpg',
        {
          id: 2,
          original_name: 'Document.pdf',
          mime_type: 'application/pdf',
          url: '/api/uploads/doc.pdf',
        },
      ],
      fanned: false,
    });
    const html = await renderToString(app);
    expect(html).toContain('thumbnails-stacked-container');
    expect(html).toContain('polaroid-stack');
    expect(html).toContain('stack-fan-pill');
    expect(html).toContain('2 Anhänge');
    expect(html).toContain('Auffächern');
    expect(html).not.toContain('thumbnails-fanned-container');
  });

  it('renders fanned polaroid cards and documents in fanned state', async () => {
    const app = createTestApp(AttachmentThumbnails, {
      items: [
        'https://example.com/photo1.jpg',
        {
          id: 2,
          original_name: 'Tickets.pdf',
          mime_type: 'application/pdf',
          url: '/api/uploads/tickets.pdf',
        },
      ],
      fanned: true,
      editable: true,
    });
    const html = await renderToString(app);
    expect(html).toContain('thumbnails-fanned-container');
    expect(html).toContain('fanned-header-bar');
    expect(html).toContain('stack-collapse-btn');
    expect(html).toContain('Stapeln');
    expect(html).toContain('fanned-polaroid is-photo');
    expect(html).toContain('fanned-polaroid is-doc');
    expect(html).toContain('doc-sheet');
    expect(html).toContain('Tickets.pdf');
    expect(html).toContain('remove-thumb');
    expect(html).toContain('--item-rot');
  });

  it('omits remove-thumb delete buttons when editable is false in fanned state', async () => {
    const app = createTestApp(AttachmentThumbnails, {
      items: ['https://example.com/photo1.jpg'],
      fanned: true,
      editable: false,
    });
    const html = await renderToString(app);
    expect(html).toContain('thumbnails-fanned-container');
    expect(html).not.toContain('remove-thumb');
  });
});
