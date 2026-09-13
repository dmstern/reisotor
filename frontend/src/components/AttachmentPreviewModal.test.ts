// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import AttachmentPreviewModal from './AttachmentPreviewModal.vue';

function mountTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('AttachmentPreviewModal', () => {
  it('renders modal with Herunterladen button when open', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: ['https://example.com/pic.jpg'],
    });
    await nextTick();
    const html = document.body.innerHTML;
    expect(html).toContain('Herunterladen');
    expect(html).toContain('preview-actions');
    expect(html).not.toContain('Löschen');
    cleanUp();
  });

  it('renders Löschen button on the bottom left when editable is true', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: ['https://example.com/pic.jpg'],
      editable: true,
    });
    await nextTick();
    const html = document.body.innerHTML;
    expect(html).toContain('Löschen');
    expect(html).toContain('btn--danger');
    expect(html).toContain('Herunterladen');
    expect(html).toContain('preview-actions-right');
    cleanUp();
  });

  it('renders FileFormatGraphic and fallback text for document attachments', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: [
        {
          id: 5,
          original_name: 'Buchungsbeleg.pdf',
          mime_type: 'application/pdf',
          url: '/api/doc.pdf',
        },
      ],
    });
    await nextTick();
    const html = document.body.innerHTML;
    expect(html).toContain('Keine Vorschau verfügbar');
    expect(html).toContain('Buchungsbeleg.pdf');
    expect(html).toContain('PDF');
    cleanUp();
  });
});
