import { computed, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Attachment, DiaryEntry, ExcursionLeg } from '../api/types';
import type { AttachmentPreviewItem } from '../components/AttachmentPreviewModal.vue';
import { useTripStore } from '../stores/trip';
import { useDrawersStore, type MapFocusGalleryItem } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { extractExifFromUrl, type ImageExifMetadata } from '../utils/imageCompression';
import { isImageAttachment } from '../utils/fileUpload';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { MapPoint } from './useMapPoints';

export interface UseMapPhotosOptions {
  onPhotosUpdated?: () => void;
}

export function useMapPhotos(options: UseMapPhotosOptions = {}) {
  const tripStore = useTripStore();
  const drawers = useDrawersStore();
  const excursionsStore = useExcursionsStore();

  const excursionPhotoPoints = ref<MapPoint[]>([]);
  const allTripPhotoPoints = ref<MapPoint[]>([]);
  const allTripPhotosLoaded = ref(false);

  // Photo preview modal state
  const photoPreviewOpen = ref(false);
  const photoPreviewIndex = ref(0);
  const activePreviewAttachments = ref<AttachmentPreviewItem[]>([]);

  const photoPreviewAttachments = computed<AttachmentPreviewItem[]>(() => {
    if (activePreviewAttachments.value.length) {
      return activePreviewAttachments.value;
    }
    if (drawers.mapFocusLocation?.gallery?.attachments?.length) {
      return drawers.mapFocusLocation.gallery.attachments as AttachmentPreviewItem[];
    }
    if (drawers.mapFocusLocation?.imageUrl) {
      return [
        {
          url: drawers.mapFocusLocation.imageUrl,
          original_name: drawers.mapFocusLocation.title || 'Foto-Standort',
        },
      ];
    }
    if (drawers.mapFocusAllPhotos && allTripPhotoPoints.value.length) {
      return (allTripPhotoPoints.value[0]?.gallery?.attachments as AttachmentPreviewItem[]) ?? [];
    }
    return [];
  });

  function openPhotoPreview(attachments?: AttachmentPreviewItem[], index?: number) {
    if (attachments && attachments.length) {
      activePreviewAttachments.value = attachments;
      photoPreviewIndex.value = index ?? 0;
      photoPreviewOpen.value = true;
      return;
    }
    activePreviewAttachments.value = [];
    if (!photoPreviewAttachments.value.length) return;
    photoPreviewIndex.value = drawers.mapFocusLocation?.gallery?.initialIndex ?? 0;
    photoPreviewOpen.value = true;
  }

  watch(
    photoPreviewOpen,
    (open) => {
      if (!open) {
        activePreviewAttachments.value = [];
      }
    },
    { flush: 'sync' }
  );

  async function loadExcursionPhotoPoints(excursionId: number) {
    try {
      const exc = excursionsStore.excursions.find((e) => e.id === excursionId);
      const [tourAttachments, ...legsAttachmentsArrays] = await Promise.all([
        api.get<Attachment[]>(`/attachments?domain=ideas&entity_id=${excursionId}`).catch(() => []),
        ...(exc?.legs ?? [])
          .filter((leg): leg is ExcursionLeg & { id: number } => leg.id != null)
          .map((leg) =>
            api
              .get<Attachment[]>(`/attachments?domain=excursion_legs&entity_id=${leg.id}`)
              .catch(() => [])
          ),
      ]);
      if (drawers.mapFocusExcursionId !== excursionId) return;

      const allAttachments = [...tourAttachments, ...legsAttachmentsArrays.flat()];
      const seenIds = new Set<number>();
      const uniqueAttachments = allAttachments.filter((a) => {
        if (seenIds.has(a.id)) return false;
        seenIds.add(a.id);
        return true;
      });

      const imageAttachments = uniqueAttachments.filter((a) => isImageAttachment(a));
      if (!imageAttachments.length) {
        excursionPhotoPoints.value = [];
        return;
      }

      const galleryItems: MapFocusGalleryItem[] = imageAttachments.map((a) => ({
        id: a.id,
        url: a.url,
        original_name: a.original_name,
        filename: a.filename,
        mime_type: a.mime_type,
        size_bytes: a.size_bytes,
      }));

      const pointsWithExif: MapPoint[] = [];

      await Promise.all(
        imageAttachments.map(async (att, index) => {
          try {
            const meta = await extractExifFromUrl(att.url);
            if (meta?.latitude != null && meta?.longitude != null) {
              galleryItems[index].metadata = meta;
              let dateBadge: string | undefined;
              if (meta.dateTime) {
                dateBadge = formatDateShared(toLocalDateString(meta.dateTime), {
                  includeYear: false,
                });
              } else if (att.created_at) {
                dateBadge = formatDateShared(att.created_at, { includeYear: false });
              }
              pointsWithExif.push({
                key: `excursion-photo-${att.id}`,
                origin: 'location',
                lat: meta.latitude,
                lng: meta.longitude,
                title: att.original_name || 'Foto-Standort',
                category: 'Foto',
                icon: FORM_FIELD_ICONS.image,
                imageUrl: att.url,
                dateBadge,
                color: '#9141ac',
                gallery: {
                  attachments: galleryItems,
                  initialIndex: index,
                },
              });
            }
          } catch {
            // Bild ohne lesbare EXIF-Daten überspringen
          }
        })
      );

      if (drawers.mapFocusExcursionId === excursionId) {
        excursionPhotoPoints.value = pointsWithExif;
        options.onPhotosUpdated?.();
      }
    } catch (err) {
      console.warn('Fehler beim Laden der Tour-Anhänge für die Karte:', err);
      excursionPhotoPoints.value = [];
    }
  }

  async function loadAllTripPhotos() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) {
      allTripPhotoPoints.value = [];
      allTripPhotosLoaded.value = true;
      return;
    }
    try {
      const [attachments, diaryEntries] = await Promise.all([
        api.get<Attachment[]>(`/attachments?trip_id=${tripId}`).catch(() => []),
        api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`).catch(() => []),
      ]);

      interface CandidateItem {
        id?: number;
        url: string;
        original_name: string;
        filename?: string;
        mime_type?: string;
        size_bytes?: number;
        created_at?: string;
        dateFallback?: string;
      }

      const seenUrls = new Set<string>();
      const candidates: CandidateItem[] = [];

      for (const att of attachments) {
        if (isImageAttachment(att) && att.url && !seenUrls.has(att.url)) {
          seenUrls.add(att.url);
          candidates.push({
            id: att.id,
            url: att.url,
            original_name: att.original_name,
            filename: att.filename,
            mime_type: att.mime_type,
            size_bytes: att.size_bytes,
            created_at: att.created_at,
            dateFallback: att.created_at,
          });
        }
      }

      for (const entry of diaryEntries) {
        if (entry.images && entry.images.length) {
          for (const img of entry.images) {
            const url = typeof img === 'string' ? img : img.url;
            if (!url || seenUrls.has(url)) continue;
            seenUrls.add(url);
            const original_name =
              typeof img === 'string'
                ? url.split('/').pop() || 'Foto'
                : img.original_name || url.split('/').pop() || 'Foto';
            candidates.push({
              url,
              original_name,
              filename: url.split('/').pop(),
              created_at: entry.created_at,
              dateFallback: entry.date || entry.created_at,
            });
          }
        }
        if (entry.content && entry.content.includes('<img')) {
          const matches = entry.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
          for (const match of matches) {
            const url = match[1];
            if (!url || seenUrls.has(url)) continue;
            seenUrls.add(url);
            candidates.push({
              url,
              original_name: url.split('/').pop() || 'Foto',
              filename: url.split('/').pop(),
              created_at: entry.created_at,
              dateFallback: entry.date || entry.created_at,
            });
          }
        }
      }

      if (!candidates.length) {
        allTripPhotoPoints.value = [];
        allTripPhotosLoaded.value = true;
        return;
      }

      const itemsWithMeta: {
        item: CandidateItem;
        meta: ImageExifMetadata;
        timestamp: number;
      }[] = [];

      await Promise.all(
        candidates.map(async (item) => {
          try {
            const meta = await extractExifFromUrl(item.url);
            if (meta?.latitude != null && meta?.longitude != null) {
              const timestamp = meta.dateTime
                ? meta.dateTime.getTime()
                : item.dateFallback
                  ? new Date(item.dateFallback).getTime()
                  : 0;
              itemsWithMeta.push({ item, meta, timestamp });
            }
          } catch {
            // Bild ohne lesbare EXIF-Daten überspringen
          }
        })
      );

      itemsWithMeta.sort((a, b) => a.timestamp - b.timestamp);

      const galleryItems: MapFocusGalleryItem[] = itemsWithMeta.map(({ item, meta }) => ({
        id: item.id,
        url: item.url,
        original_name: item.original_name,
        filename: item.filename,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        metadata: meta,
      }));

      allTripPhotoPoints.value = itemsWithMeta.map(({ item, meta }, index) => {
        let dateBadge: string | undefined;
        if (meta.dateTime) {
          dateBadge = formatDateShared(toLocalDateString(meta.dateTime), { includeYear: false });
        } else if (item.dateFallback) {
          dateBadge = formatDateShared(item.dateFallback, { includeYear: false });
        }
        return {
          key: `all-photo-${item.id ?? index}-${item.url.slice(-12)}`,
          origin: 'location',
          lat: meta.latitude!,
          lng: meta.longitude!,
          title: item.original_name || 'Foto-Standort',
          category: 'Foto',
          icon: FORM_FIELD_ICONS.image,
          imageUrl: item.url,
          dateBadge,
          color: '#9141ac',
          gallery: {
            attachments: galleryItems,
            initialIndex: index,
          },
        };
      });
      options.onPhotosUpdated?.();
    } catch (err) {
      console.warn('Fehler beim Laden aller Urlaubs-Fotos für die Karte:', err);
      allTripPhotoPoints.value = [];
    } finally {
      allTripPhotosLoaded.value = true;
    }
  }

  watch(
    () => drawers.mapFocusExcursionId,
    (newId) => {
      if (newId != null) {
        loadExcursionPhotoPoints(newId);
      } else {
        excursionPhotoPoints.value = [];
      }
    },
    { immediate: true }
  );

  function onAttachmentsChanged(e: Event) {
    loadAllTripPhotos();
    const custom = e as CustomEvent<{ domain: string; entityId: number }>;
    if (
      custom.detail &&
      drawers.mapFocusExcursionId != null &&
      (custom.detail.domain === 'ideas' || custom.detail.domain === 'excursion_legs')
    ) {
      loadExcursionPhotoPoints(drawers.mapFocusExcursionId);
    }
  }

  function setupPhotoListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('attachments-changed', onAttachmentsChanged);
    }
  }

  function cleanupPhotoListeners() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('attachments-changed', onAttachmentsChanged);
    }
  }

  return {
    excursionPhotoPoints,
    allTripPhotoPoints,
    allTripPhotosLoaded,
    loadExcursionPhotoPoints,
    loadAllTripPhotos,
    photoPreviewOpen,
    photoPreviewIndex,
    activePreviewAttachments,
    photoPreviewAttachments,
    openPhotoPreview,
    setupPhotoListeners,
    cleanupPhotoListeners,
    onAttachmentsChanged,
  };
}
