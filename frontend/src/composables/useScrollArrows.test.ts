import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useScrollArrows } from './useScrollArrows';

describe('useScrollArrows', () => {
  let mockElement: Partial<HTMLElement>;
  let scrollByMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollByMock = vi.fn();
    mockElement = {
      scrollLeft: 0,
      clientWidth: 200,
      scrollWidth: 500,
      scrollBy: scrollByMock as unknown as Element['scrollBy'],
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly calculates canScrollLeft and canScrollRight', () => {
    const elRef = ref(mockElement as HTMLElement);
    const { canScrollLeft, canScrollRight, updateScrollArrows } = useScrollArrows(elRef);

    updateScrollArrows();
    expect(canScrollLeft.value).toBe(false);
    expect(canScrollRight.value).toBe(true);

    // Scroll partially
    mockElement.scrollLeft = 100;
    updateScrollArrows();
    expect(canScrollLeft.value).toBe(true);
    expect(canScrollRight.value).toBe(true);

    // Scroll to the end
    mockElement.scrollLeft = 300; // 300 + 200 = 500 = scrollWidth
    updateScrollArrows();
    expect(canScrollLeft.value).toBe(true);
    expect(canScrollRight.value).toBe(false);
  });

  it('scrolls by specified ratio', () => {
    const elRef = ref(mockElement as HTMLElement);
    const { scrollBy } = useScrollArrows(elRef, { scrollRatio: 0.5 });

    scrollBy(1);
    expect(scrollByMock).toHaveBeenCalledWith({
      left: 100, // 200 * 0.5
      behavior: 'smooth',
    });

    scrollBy(-1);
    expect(scrollByMock).toHaveBeenCalledWith({
      left: -100,
      behavior: 'smooth',
    });
  });

  it('handles null element gracefully', () => {
    const elRef = ref<HTMLElement | null>(null);
    const { canScrollLeft, canScrollRight, updateScrollArrows, scrollBy } = useScrollArrows(elRef);

    updateScrollArrows();
    expect(canScrollLeft.value).toBe(false);
    expect(canScrollRight.value).toBe(false);

    expect(() => scrollBy(1)).not.toThrow();
  });
});
