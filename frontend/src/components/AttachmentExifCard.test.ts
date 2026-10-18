// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import { useDrawersStore } from '../stores/drawers';
import AttachmentExifCard from './AttachmentExifCard.vue';
import type { AttachmentPreviewItem } from '../utils/attachment';

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

describe('AttachmentExifCard', () => {
  it('blendet den EXIF-Kasten aus, wenn keine Metadaten vorliegen', async () => {
    const attachment: AttachmentPreviewItem = {
      id: 1,
      url: 'https://example.com/no-exif.jpg',
      original_name: 'no-exif.jpg',
      mime_type: 'image/jpeg',
      metadata: null,
    };

    const { cleanUp } = mountTestApp(AttachmentExifCard, {
      currentAttachment: attachment,
    });
    await nextTick();

    const html = document.body.innerHTML;
    expect(html).not.toContain('preview-exif-card');
    expect(html).not.toContain('Ort auf Karte anzeigen');
    cleanUp();
  });

  it('zeigt Aufnahmedatum und Geolocation an, wenn Metadaten vorhanden sind', async () => {
    const attachment: AttachmentPreviewItem = {
      id: 2,
      url: 'https://example.com/photo.jpg',
      original_name: 'Urlaubsfoto.jpg',
      mime_type: 'image/jpeg',
      metadata: {
        dateTime: new Date(2026, 6, 15, 14, 32),
        latitude: 38.6916,
        longitude: -9.216,
      },
    };

    const { cleanUp } = mountTestApp(AttachmentExifCard, {
      currentAttachment: attachment,
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

  it('emittet close und öffnet den Drawer mit Standort bei Klick auf "Ort auf Karte anzeigen"', async () => {
    let closed = false;
    const attachment: AttachmentPreviewItem = {
      id: 3,
      url: 'https://example.com/photo.jpg',
      original_name: 'Urlaubsfoto.jpg',
      mime_type: 'image/jpeg',
      metadata: {
        latitude: 48.1372,
        longitude: 11.5761,
      },
    };

    const { cleanUp } = mountTestApp(AttachmentExifCard, {
      currentAttachment: attachment,
      allAttachments: [attachment],
      currentIndex: 0,
      onClose: () => {
        closed = true;
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
    const drawers = useDrawersStore();
    expect(drawers.mapFocusLocation?.lat).toBe(48.1372);
    expect(drawers.mapFocusLocation?.lng).toBe(11.5761);
    expect(drawers.mapFocusLocation?.title).toBe('Urlaubsfoto.jpg');
    cleanUp();
  });
});
