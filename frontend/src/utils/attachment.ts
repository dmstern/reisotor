import type { Attachment } from '../api/types';
import type { ImageExifMetadata } from './imageCompression';
import { isImageAttachment } from './fileUpload';

export interface AttachmentPreviewItem {
  id?: number;
  url: string;
  original_name?: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
  metadata?: ImageExifMetadata | null;
}

export function isImage(attachment: AttachmentPreviewItem | null | undefined): boolean {
  if (!attachment) return false;
  return isImageAttachment(attachment);
}

export function normalizeAttachment(
  item: Attachment | AttachmentPreviewItem | string | null | undefined,
  index: number
): AttachmentPreviewItem {
  if (!item || typeof item !== 'object') {
    if (typeof item === 'string') {
      return {
        url: item,
        original_name: `Bild ${index + 1}`,
        mime_type: 'image/jpeg',
      };
    }
    return {
      url: '',
      original_name: `Anhang ${index + 1}`,
    };
  }
  return {
    ...item,
    original_name:
      item.original_name ||
      item.filename ||
      (isImage(item as AttachmentPreviewItem) ? `Bild ${index + 1}` : `Anhang ${index + 1}`),
  };
}
