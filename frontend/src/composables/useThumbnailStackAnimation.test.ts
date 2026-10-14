import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useThumbnailStackAnimation } from './useThumbnailStackAnimation';
import type { AttachmentPreviewItem } from '../utils/attachment';

describe('useThumbnailStackAnimation', () => {
  it('toggles isFanned immediately when reduced motion is preferred or rootRef is null', async () => {
    const rootRef = ref<HTMLElement | null>(null);
    const isFanned = ref(false);
    const items = ref<AttachmentPreviewItem[]>([
      { url: 'https://example.com/pic1.jpg' },
      { url: 'https://example.com/pic2.jpg' },
    ]);

    const anim = useThumbnailStackAnimation({
      rootRef,
      isFanned,
      items,
    });

    expect(isFanned.value).toBe(false);
    expect(anim.isCollapsing.value).toBe(false);

    await anim.expandToFanned();
    expect(isFanned.value).toBe(true);

    anim.collapseToStacked();
    expect(isFanned.value).toBe(false);
  });

  it('cancels active animation timeout safely', () => {
    const rootRef = ref<HTMLElement | null>(null);
    const isFanned = ref(false);
    const items = ref<AttachmentPreviewItem[]>([]);

    const anim = useThumbnailStackAnimation({
      rootRef,
      isFanned,
      items,
    });

    expect(() => anim.clearActiveAnimation()).not.toThrow();
  });
});
