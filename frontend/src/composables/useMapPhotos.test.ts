// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { useMapPhotos } from './useMapPhotos';
import { api } from '../api/client';
import { useTripStore } from '../stores/trip';

class MockEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}
vi.stubGlobal('EventSource', MockEventSource);

vi.mock('../utils/imageCompression', () => ({
  extractExifFromUrl: vi.fn(),
}));

describe('useMapPhotos', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes photo preview and points empty', () => {
    const { photoPreviewOpen, excursionPhotoPoints, allTripPhotoPoints, allTripPhotosLoaded } =
      useMapPhotos();

    expect(photoPreviewOpen.value).toBe(false);
    expect(excursionPhotoPoints.value).toEqual([]);
    expect(allTripPhotoPoints.value).toEqual([]);
    expect(allTripPhotosLoaded.value).toBe(false);
  });

  it('opens and closes photo preview modal with custom attachments', async () => {
    const photos = useMapPhotos();
    const testItem = { url: 'https://example.com/test.jpg', original_name: 'test.jpg' };

    photos.openPhotoPreview([testItem], 0);
    expect(photos.photoPreviewOpen.value).toBe(true);
    expect(photos.photoPreviewIndex.value).toBe(0);
    expect(photos.photoPreviewAttachments.value).toEqual([testItem]);

    photos.photoPreviewOpen.value = false;
    await nextTick();
    expect(photos.activePreviewAttachments.value).toEqual([]);
  });

  it('loads all trip photos and parses valid image attachments', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path.startsWith('/attachments')) {
        return [
          {
            id: 1,
            trip_id: 1,
            url: 'https://example.com/photo1.jpg',
            original_name: 'photo1.jpg',
            mime_type: 'image/jpeg',
            size_bytes: 1000,
            created_at: '2026-06-01T12:00:00Z',
          },
        ];
      }
      return [];
    });

    const imageCompression = await import('../utils/imageCompression');
    vi.mocked(imageCompression.extractExifFromUrl).mockResolvedValue({
      latitude: 48.8584,
      longitude: 2.2945,
      dateTime: new Date('2026-06-01T12:00:00Z'),
    });

    const photos = useMapPhotos();
    await photos.loadAllTripPhotos();

    expect(photos.allTripPhotosLoaded.value).toBe(true);
    expect(photos.allTripPhotoPoints.value.length).toBe(1);
    expect(photos.allTripPhotoPoints.value[0].title).toBe('photo1.jpg');
    expect(photos.allTripPhotoPoints.value[0].lat).toBe(48.8584);
    expect(photos.allTripPhotoPoints.value[0].lng).toBe(2.2945);
  });
});
