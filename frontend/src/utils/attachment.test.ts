import { describe, it, expect } from 'vitest';
import { isImage, normalizeAttachment } from './attachment';

describe('attachment utils', () => {
  it('identifies image mime types and extensions correctly', () => {
    expect(isImage({ url: 'https://example.com/pic.jpg' })).toBe(true);
    expect(isImage({ url: 'https://example.com/pic.png' })).toBe(true);
    expect(isImage({ url: 'https://example.com/pic.WEBP' })).toBe(true);
    expect(isImage({ url: 'data:image/jpeg;base64,123' })).toBe(true);
    expect(isImage({ url: '/api/doc', mime_type: 'image/avif' })).toBe(true);
    expect(isImage({ url: '/api/doc.pdf', mime_type: 'application/pdf' })).toBe(false);
    expect(isImage(null)).toBe(false);
    expect(isImage(undefined)).toBe(false);
  });

  it('normalizes string URLs to AttachmentPreviewItem with default Bild name', () => {
    const item = normalizeAttachment('https://example.com/pic.jpg', 0);
    expect(item).toEqual({
      url: 'https://example.com/pic.jpg',
      original_name: 'Bild 1',
      mime_type: 'image/jpeg',
    });
  });

  it('preserves existing original_name or filename on attachments', () => {
    const item = normalizeAttachment(
      {
        id: 1,
        url: 'https://example.com/file',
        original_name: 'MyPhoto.jpg',
      },
      2
    );
    expect(item.original_name).toBe('MyPhoto.jpg');
    expect(item.id).toBe(1);
  });

  it('provides fallback name based on image vs document', () => {
    const photo = normalizeAttachment({ url: 'https://example.com/img.png' }, 1);
    expect(photo.original_name).toBe('Bild 2');

    const doc = normalizeAttachment(
      { url: 'https://example.com/file.pdf', mime_type: 'application/pdf' },
      3
    );
    expect(doc.original_name).toBe('Anhang 4');
  });

  it('handles null or undefined gracefully (#603)', () => {
    const fromNull = normalizeAttachment(null, 0);
    expect(fromNull).toEqual({
      url: '',
      original_name: 'Anhang 1',
    });

    const fromUndefined = normalizeAttachment(undefined, 1);
    expect(fromUndefined).toEqual({
      url: '',
      original_name: 'Anhang 2',
    });
  });
});
