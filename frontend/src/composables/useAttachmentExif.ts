import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { extractExifFromUrl, type ImageExifMetadata } from '../utils/imageCompression';
import { isImage, type AttachmentPreviewItem } from '../utils/attachment';
import { useCalendarSettingsStore } from '../stores/calendarSettings';
import { useDrawersStore } from '../stores/drawers';
import { formatDate, toLocalDateString } from '../utils/dateFormat';

export interface UseAttachmentExifOptions {
  currentAttachment: ComputedRef<AttachmentPreviewItem | null> | Ref<AttachmentPreviewItem | null>;
  allAttachments: ComputedRef<AttachmentPreviewItem[]> | Ref<AttachmentPreviewItem[]>;
  currentIndex: Ref<number> | ComputedRef<number>;
  onCloseModal?: () => void;
}

export function useAttachmentExif(options: UseAttachmentExifOptions) {
  const { currentAttachment, allAttachments, currentIndex, onCloseModal } = options;

  const drawers = useDrawersStore();
  const currentMetadata = ref<ImageExifMetadata | null>(null);
  const isLoadingMetadata = ref(false);

  const hasExifMetadata = computed(() =>
    Boolean(
      currentMetadata.value &&
      (currentMetadata.value.dateTime ||
        (currentMetadata.value.latitude != null && currentMetadata.value.longitude != null))
    )
  );

  function formatExifDateTime(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const calendarSettings = useCalendarSettingsStore();
    let dateFormatted = `${day}.${month}.${year}`;
    if (calendarSettings.dateFormat === 'iso') {
      dateFormatted = `${year}-${month}-${day}`;
    } else if (calendarSettings.dateFormat === 'us') {
      dateFormatted = `${month}/${day}/${year}`;
    }
    return `${dateFormatted}, ${hours}:${minutes}\u00A0Uhr`;
  }

  async function loadMetadataForAttachment(attachment: AttachmentPreviewItem | null) {
    if (!attachment || !isImage(attachment)) {
      currentMetadata.value = null;
      return;
    }
    if (attachment.metadata !== undefined) {
      currentMetadata.value = attachment.metadata;
      return;
    }
    isLoadingMetadata.value = true;
    try {
      const meta = await extractExifFromUrl(attachment.url);
      if (currentAttachment.value?.url === attachment.url) {
        currentMetadata.value = meta;
      }
    } catch {
      if (currentAttachment.value?.url === attachment.url) {
        currentMetadata.value = null;
      }
    } finally {
      isLoadingMetadata.value = false;
    }
  }

  watch(
    () => currentAttachment.value?.url,
    () => {
      loadMetadataForAttachment(currentAttachment.value);
    },
    { immediate: true }
  );

  function onShowLocationOnMap() {
    if (currentMetadata.value?.latitude == null || currentMetadata.value?.longitude == null) {
      return;
    }
    const lat = currentMetadata.value.latitude;
    const lng = currentMetadata.value.longitude;
    const title = currentAttachment.value?.original_name || 'Foto-Standort';
    const imageUrl = currentAttachment.value?.url;
    const gallery = {
      attachments: allAttachments.value,
      initialIndex: currentIndex.value,
    };
    let dateBadge: string | undefined;
    if (currentMetadata.value?.dateTime) {
      dateBadge = formatDate(toLocalDateString(currentMetadata.value.dateTime), {
        includeYear: false,
      });
    } else if (currentAttachment.value?.created_at) {
      dateBadge = formatDate(currentAttachment.value.created_at, { includeYear: false });
    }
    onCloseModal?.();
    drawers.openMapAtLocation(lat, lng, title, imageUrl, gallery, dateBadge);
  }

  return {
    currentMetadata,
    isLoadingMetadata,
    hasExifMetadata,
    formatExifDateTime,
    loadMetadataForAttachment,
    onShowLocationOnMap,
  };
}
