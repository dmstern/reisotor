import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import PolaroidStack from './PolaroidStack.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

function createTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  return app;
}

describe('PolaroidStack primitive', () => {
  it('renders nothing when items array is empty', async () => {
    const app = createTestApp(PolaroidStack, { items: [] });
    const html = await renderToString(app);
    expect(html).toBe('<!---->');
  });

  it('renders a single photo polaroid without paperclip when clipped is false', async () => {
    const app = createTestApp(PolaroidStack, {
      items: ['https://example.com/photo.jpg'],
      clipped: false,
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-stack');
    expect(html).toContain('polaroid-tile');
    expect(html).toContain('src="https://example.com/photo.jpg"');
    expect(html).not.toContain('polaroid-paperclip');
    expect(html).not.toContain('polaroid-badge');
  });

  it('renders paperclip when clipped is true', async () => {
    const app = createTestApp(PolaroidStack, {
      items: ['https://example.com/photo.jpg'],
      clipped: true,
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-paperclip-wrap');
    expect(html).toContain('polaroid-paperclip');
    expect(html).toContain('is-clipped');
  });

  it('renders DIN A4 document sheet with dog-ear and print lines for PDF attachment', async () => {
    const app = createTestApp(PolaroidStack, {
      items: [
        {
          id: 1,
          original_name: 'Bestaetigung.pdf',
          mime_type: 'application/pdf',
          url: '/api/uploads/doc.pdf',
        },
      ],
      clipped: true,
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-tile is-doc');
    expect(html).toContain('doc-sheet');
    expect(html).toContain('doc-dogear');
    expect(html).toContain('doc-print-lines');
    expect(html).toContain('PDF');
    expect(html).toContain('Bestaetigung.pdf');
    expect(html).toContain('clipped-on-doc');
  });

  it('renders mixed stack with both photo polaroid and document sheet', async () => {
    const app = createTestApp(PolaroidStack, {
      items: [
        'https://example.com/photo.jpg',
        {
          id: 2,
          original_name: 'Tickets.pdf',
          mime_type: 'application/pdf',
          url: '/api/uploads/tickets.pdf',
        },
      ],
      clipped: true,
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-tile is-photo');
    expect(html).toContain('polaroid-tile is-doc');
    expect(html).toContain('doc-sheet');
    expect(html).toContain('Tickets.pdf');
  });

  it('renders overflow badge (+N) when items exceed maxVisible', async () => {
    const items = ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg'];
    const app = createTestApp(PolaroidStack, {
      items,
      maxVisible: 3,
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-badge');
    expect(html).toContain('+2');
  });

  it('renders station items with category icon and background color', async () => {
    const app = createTestApp(PolaroidStack, {
      items: [
        {
          key: 10,
          title: 'Café Lisboa',
          tabler: ACTION_ICONS.done,
          color: '#e67e22',
        },
      ],
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-placeholder');
    expect(html).toContain('Café Lisboa');
    expect(html).toContain('background-color:#e67e22');
  });

  it('stacks items with first item on top (highest z-index)', async () => {
    const app = createTestApp(PolaroidStack, {
      items: ['https://example.com/first.jpg', 'https://example.com/second.jpg'],
    });
    const html = await renderToString(app);
    // First tile should have z-index: 2, second tile z-index: 1
    expect(html).toMatch(/z-index:\s*2/);
    expect(html).toMatch(/z-index:\s*1/);
  });
});
