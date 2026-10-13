// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { useDiaryImageUpload } from './useDiaryImageUpload';

describe('useDiaryImageUpload', () => {
  it('initializes with default states', () => {
    const upload = useDiaryImageUpload();
    expect(upload.uploading.value).toBe(false);
    expect(upload.uploadError.value).toBe('');
    expect(upload.uploadPercent.value).toBe(0);
    expect(upload.uploadCurrent.value).toBe(1);
    expect(upload.uploadTotal.value).toBe(0);
  });

  it('abortUpload resets all progress states', () => {
    const upload = useDiaryImageUpload();
    upload.uploading.value = true;
    upload.uploadCurrent.value = 3;
    upload.uploadTotal.value = 5;
    upload.uploadPercent.value = 60;
    upload.uploadFileName.value = 'pic.jpg';

    upload.abortUpload();

    expect(upload.uploading.value).toBe(false);
    expect(upload.uploadCurrent.value).toBe(1);
    expect(upload.uploadTotal.value).toBe(0);
    expect(upload.uploadPercent.value).toBe(0);
    expect(upload.uploadFileName.value).toBe('');
  });

  it('removeImage splices image from target', () => {
    const upload = useDiaryImageUpload();
    const target = {
      images: [
        { url: '/img1.jpg', original_name: '1.jpg' },
        { url: '/img2.jpg', original_name: '2.jpg' },
      ],
    };

    upload.removeImage(target, 0);
    expect(target.images).toHaveLength(1);
    expect(target.images[0].url).toBe('/img2.jpg');
  });
});
