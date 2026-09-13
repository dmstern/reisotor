// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
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
    expect(html).toMatch(/<!--(?:v-if)?-->/);
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

  it('renders station items with category icon and background color when imageUrl is missing', async () => {
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
    expect(html).not.toContain('<img');
  });

  it('renders station items with spot cover image when imageUrl is provided', async () => {
    const app = createTestApp(PolaroidStack, {
      items: [
        {
          key: 10,
          title: 'Café Lisboa',
          imageUrl: 'https://example.com/cafe.jpg',
          tabler: ACTION_ICONS.done,
          color: '#e67e22',
        },
      ],
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-photo');
    expect(html).toContain('src="https://example.com/cafe.jpg"');
    expect(html).toContain('Café Lisboa');
    expect(html).not.toContain('polaroid-placeholder');
  });

  it('renders station items with spot cover image even when URL has no file extension', async () => {
    const app = createTestApp(PolaroidStack, {
      items: [
        {
          key: 11,
          title: 'Belém Tower',
          imageUrl: 'https://picsum.photos/400/300',
          tabler: ACTION_ICONS.done,
          color: '#10b981',
        },
      ],
    });
    const html = await renderToString(app);
    expect(html).toContain('polaroid-photo');
    expect(html).toContain('src="https://picsum.photos/400/300"');
    expect(html).toContain('Belém Tower');
    expect(html).not.toContain('polaroid-placeholder');
  });

  it('falls back to category icon if spot cover image fails to load', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const app = createTestApp(PolaroidStack, {
      items: [
        {
          key: 12,
          title: 'Belém Tower',
          imageUrl: 'https://example.com/broken.jpg',
          tabler: ACTION_ICONS.done,
          color: '#10b981',
        },
      ],
    });
    app.mount(root);
    const img = root.querySelector('img.polaroid-photo') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(root.querySelector('.polaroid-placeholder')).toBeNull();

    // Image loading fails -> triggers @error
    img.dispatchEvent(new Event('error'));
    await nextTick();

    expect(root.querySelector('img.polaroid-photo')).toBeNull();
    expect(root.querySelector('.polaroid-placeholder')).not.toBeNull();
    app.unmount();
    root.remove();
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

  it('defines --tile-base-transform and --tile-fanned-transform CSS custom properties for fanning', async () => {
    const app = createTestApp(PolaroidStack, {
      items: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    });
    const html = await renderToString(app);
    expect(html).toContain('--tile-base-transform');
    expect(html).toContain('--tile-fanned-transform');
  });

  it('renders .is-fanned class when fanned prop is true', async () => {
    const app = createTestApp(PolaroidStack, {
      items: ['https://example.com/photo.jpg'],
      fanned: true,
    });
    const html = await renderToString(app);
    expect(html).toContain('is-fanned');
  });
});
