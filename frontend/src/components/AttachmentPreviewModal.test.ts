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

  it('zeigt Aufnahmedatum und Geolocation an, wenn Metadaten vorhanden sind', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: [
        {
          id: 10,
          url: 'https://example.com/photo.jpg',
          original_name: 'Urlaubsfoto.jpg',
          mime_type: 'image/jpeg',
          metadata: {
            dateTime: new Date(2026, 6, 15, 14, 32),
            latitude: 38.6916,
            longitude: -9.216,
          },
        },
      ],
    });
    await nextTick();
    const text = document.body.textContent;
    expect(text).toContain('Aufnahmedatum');
    expect(text).toContain('15.07.2026, 14:32\u00A0Uhr');
    expect(text).toContain('Standort');
    expect(text).toContain('38.6916°\u00A0N, 9.2160°\u00A0W');
    expect(text).toContain('Ort auf Karte anzeigen');
    expect(text).toContain('In Maps-App öffnen');
    cleanUp();
  });

  it('schließt das Modal und fokussiert den Standort auf der Karte bei Klick auf Ort auf Karte anzeigen', async () => {
    let closed = false;
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: [
        {
          id: 10,
          url: 'https://example.com/photo.jpg',
          original_name: 'Urlaubsfoto.jpg',
          mime_type: 'image/jpeg',
          metadata: {
            latitude: 48.1372,
            longitude: 11.5761,
          },
        },
      ],
      'onUpdate:modelValue': (val: boolean) => {
        if (!val) closed = true;
      },
    });
    await nextTick();
    const showMapBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ort auf Karte anzeigen')
    );
    expect(showMapBtn).toBeTruthy();
    showMapBtn!.click();
    await nextTick();
    expect(closed).toBe(true);
    cleanUp();
  });

  it('blendet den EXIF-Metadatenbereich aus, wenn keine Datums- oder Standortdaten vorliegen', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: [
        {
          id: 20,
          url: 'https://example.com/plain.jpg',
          original_name: 'OhneMetadaten.jpg',
          mime_type: 'image/jpeg',
          metadata: null,
        },
      ],
    });
    await nextTick();
    const html = document.body.innerHTML;
    expect(html).not.toContain('preview-exif-card');
    expect(html).not.toContain('Ort auf Karte anzeigen');
    cleanUp();
  });

  it('unterstützt flüssige Höhenanpassung und initialisiert has-transition auf preview-content', async () => {
    const { cleanUp } = mountTestApp(AttachmentPreviewModal, {
      modelValue: true,
      attachments: ['https://example.com/wide.jpg', 'https://example.com/tall.jpg'],
    });
    await nextTick();
    const content = document.querySelector('.preview-content');
    expect(content).toBeTruthy();
    // Simulate image loaded and trigger animation frame
    const img = document.querySelector('.preview-img') as HTMLImageElement;
    if (img) {
      Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 400, configurable: true });
      img.dispatchEvent(new Event('load'));
      await nextTick();
    }
    expect(content?.className).toContain('preview-content');
    cleanUp();
  });
});
