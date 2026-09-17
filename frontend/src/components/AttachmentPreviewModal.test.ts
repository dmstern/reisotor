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

  it('renders navigation buttons and slides for multiple attachments', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: [
        'https://example.com/pic1.jpg',
        'https://example.com/pic2.jpg',
        'https://example.com/pic3.jpg',
      ],
    });
    await nextTick();
    const html = document.body.innerHTML;
    expect(html).toContain('1 von 3');
    expect(html).toContain('prev-btn');
    expect(html).toContain('next-btn');
    const slides = document.querySelectorAll('.slider-slide');
    expect(slides.length).toBe(3);
    cleanUp();
  });

  it('animates slide transition on next button click', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: [
        'https://example.com/pic1.jpg',
        'https://example.com/pic2.jpg',
        'https://example.com/pic3.jpg',
      ],
    });
    await nextTick();
    const nextBtn = document.querySelector('.next-btn') as HTMLButtonElement;
    expect(nextBtn).toBeTruthy();
    const track = document.querySelector('.slider-track') as HTMLElement;
    expect(track.style.transform).toBe('translateX(calc(-100% + 0px))');

    nextBtn.click();
    await nextTick();
    expect(track.style.transform).toBe('translateX(calc(-200% + 0px))');
    expect(track.style.transition).toContain('transform 0.28s');

    await new Promise((resolve) => setTimeout(resolve, 320));
    await nextTick();
    expect(document.body.innerHTML).toContain('2 von 3');
    expect(track.style.transform).toBe('translateX(calc(-100% + 0px))');
    cleanUp();
  });

  it('tracks touch drag and triggers slide transition on swipe', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: ['https://example.com/pic1.jpg', 'https://example.com/pic2.jpg'],
    });
    await nextTick();
    const stage = document.querySelector('.preview-stage') as HTMLElement;
    const track = document.querySelector('.slider-track') as HTMLElement;

    // Start touch
    stage.dispatchEvent(
      new TouchEvent('touchstart', {
        touches: [{ clientX: 200, clientY: 100 } as Touch],
      })
    );
    // Move horizontally by -60px
    stage.dispatchEvent(
      new TouchEvent('touchmove', {
        touches: [{ clientX: 140, clientY: 100 } as Touch],
      })
    );
    await nextTick();
    expect(track.style.transform).toBe('translateX(calc(-100% + -60px))');
    expect(track.style.transition).toBe('none');

    // Release swipe
    stage.dispatchEvent(new TouchEvent('touchend'));
    await nextTick();
    expect(track.style.transform).toBe('translateX(calc(-200% + 0px))');
    expect(track.style.transition).toContain('transform 0.28s');

    await new Promise((resolve) => setTimeout(resolve, 320));
    await nextTick();
    expect(document.body.innerHTML).toContain('2 von 2');
    cleanUp();
  });
});
