// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAttachmentExif } from './useAttachmentExif';
import { useDrawersStore } from '../stores/drawers';
import { useCalendarSettingsStore } from '../stores/calendarSettings';
import type { AttachmentPreviewItem } from '../utils/attachment';

describe('useAttachmentExif', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('formats EXIF date correctly based on calendar settings', () => {
    const currentAttachment = ref<AttachmentPreviewItem | null>(null);
    const allAttachments = ref<AttachmentPreviewItem[]>([]);
    const currentIndex = ref(0);

    const exif = useAttachmentExif({
      currentAttachment,
      allAttachments,
      currentIndex,
    });

    const date = new Date(2026, 6, 15, 14, 30);
    expect(exif.formatExifDateTime(date)).toBe('15.07.2026, 14:30\u00A0Uhr');

    const cal = useCalendarSettingsStore();
    cal.dateFormat = 'iso';
    expect(exif.formatExifDateTime(date)).toBe('2026-07-15, 14:30\u00A0Uhr');

    cal.dateFormat = 'us';
    expect(exif.formatExifDateTime(date)).toBe('07/15/2026, 14:30\u00A0Uhr');
  });

  it('handles onShowLocationOnMap by opening drawers and calling onCloseModal', () => {
    const photo: AttachmentPreviewItem = {
      id: 10,
      url: 'https://example.com/pic.jpg',
      original_name: 'Scenic.jpg',
      metadata: {
        latitude: 48.137,
        longitude: 11.575,
        dateTime: new Date(2026, 6, 15, 12, 0),
      },
    };

    const currentAttachment = ref<AttachmentPreviewItem | null>(photo);
    const allAttachments = ref<AttachmentPreviewItem[]>([photo]);
    const currentIndex = ref(0);
    const onCloseModal = vi.fn();

    const exif = useAttachmentExif({
      currentAttachment,
      allAttachments,
      currentIndex,
      onCloseModal,
    });

    expect(exif.hasExifMetadata.value).toBe(true);

    exif.onShowLocationOnMap();

    expect(onCloseModal).toHaveBeenCalled();
    const drawers = useDrawersStore();
    expect(drawers.mapFocusLocation?.lat).toBe(48.137);
    expect(drawers.mapFocusLocation?.lng).toBe(11.575);
    expect(drawers.mapFocusLocation?.title).toBe('Scenic.jpg');
    expect(drawers.mapFocusKey).toBe('photo-location');
  });
});
