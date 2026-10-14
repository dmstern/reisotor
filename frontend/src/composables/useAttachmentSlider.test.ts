import { describe, it, expect, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useAttachmentSlider } from './useAttachmentSlider';
import type { AttachmentPreviewItem } from '../utils/attachment';

describe('useAttachmentSlider', () => {
  const dummyItems: AttachmentPreviewItem[] = [
    { url: 'https://example.com/1.jpg', original_name: 'Pic 1' },
    { url: 'https://example.com/2.jpg', original_name: 'Pic 2' },
    { url: 'https://example.com/3.jpg', original_name: 'Pic 3' },
  ];

  it('initializes with given initialIndex', () => {
    const items = ref(dummyItems);
    const initialIndex = ref(1);
    const isOpen = ref(true);

    const slider = useAttachmentSlider({
      items,
      initialIndex,
      isOpen,
    });

    expect(slider.currentIndex.value).toBe(1);
    expect(slider.currentAttachment.value?.original_name).toBe('Pic 2');
    expect(slider.prevAttachment.value?.original_name).toBe('Pic 1');
    expect(slider.nextAttachment.value?.original_name).toBe('Pic 3');
  });

  it('updates currentIndex on next and prev', async () => {
    vi.useFakeTimers();
    const items = ref(dummyItems);
    const isOpen = ref(true);

    const slider = useAttachmentSlider({
      items,
      isOpen,
    });

    expect(slider.currentIndex.value).toBe(0);

    slider.next();
    expect(slider.isAnimating.value).toBe(true);
    expect(slider.trackStyle.value.transform).toBe('translateX(calc(-200% + 0px))');

    vi.advanceTimersByTime(300);
    expect(slider.currentIndex.value).toBe(1);
    expect(slider.isAnimating.value).toBe(false);

    slider.prev();
    expect(slider.isAnimating.value).toBe(true);
    expect(slider.trackStyle.value.transform).toBe('translateX(calc(0% + 0px))');

    vi.advanceTimersByTime(300);
    expect(slider.currentIndex.value).toBe(0);
    vi.useRealTimers();
  });

  it('returns single slide when items length is 1', () => {
    const items = ref([dummyItems[0]]);
    const isOpen = ref(true);

    const slider = useAttachmentSlider({
      items,
      isOpen,
    });

    expect(slider.visibleSlides.value).toHaveLength(1);
    expect(slider.trackStyle.value.transform).toBe('none');
  });

  it('triggers onClose when items become empty', async () => {
    const items = ref([...dummyItems]);
    const isOpen = ref(true);
    const onClose = vi.fn();

    useAttachmentSlider({
      items,
      isOpen,
      onClose,
    });

    items.value = [];
    await nextTick();
    expect(onClose).toHaveBeenCalled();
  });
});
