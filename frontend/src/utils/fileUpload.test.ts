import { describe, it, expect } from 'vitest';
import { formatFileSize, isImageAttachment, isImageFile } from './fileUpload';

describe('fileUpload utilities', () => {
  it('formatFileSize formatiert Bytes, KB und MB korrekt', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('2 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });

  it('isImageFile erkennt Bild-Dateien anhand von Type und Endung', () => {
    expect(isImageFile(new File([], 'bild.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isImageFile(new File([], 'bild.png', { type: 'image/png' }))).toBe(true);
    expect(isImageFile(new File([], 'bild.heic', { type: '' }))).toBe(true);
    expect(isImageFile(new File([], 'dokument.pdf', { type: 'application/pdf' }))).toBe(false);
  });

  it('isImageAttachment erkennt Bild-Anhänge an MIME-Type, Dateinamen oder URL', () => {
    expect(isImageAttachment({ mime_type: 'image/jpeg' })).toBe(true);
    expect(isImageAttachment({ original_name: 'foto.jpg' })).toBe(true);
    expect(isImageAttachment({ filename: 'foto.webp' })).toBe(true);
    expect(isImageAttachment({ url: 'https://example.com/image.avif' })).toBe(true);
    expect(isImageAttachment({ url: 'data:image/jpeg;base64,123' })).toBe(true);
    expect(isImageAttachment({ mime_type: 'application/pdf', filename: 'ticket.pdf' })).toBe(false);
    expect(isImageAttachment(null)).toBe(false);
  });
});
