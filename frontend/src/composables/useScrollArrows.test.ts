// @vitest-environment jsdom
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

  it('supports reactive scrollRatio getter and ref updates', () => {
    const elRef = ref(mockElement as HTMLElement);
    const ratio = ref(0.25);
    const { scrollBy } = useScrollArrows(elRef, { scrollRatio: () => ratio.value });

    scrollBy(1);
    expect(scrollByMock).toHaveBeenCalledWith({
      left: 50, // 200 * 0.25
      behavior: 'smooth',
    });

    ratio.value = 0.5;
    scrollBy(1);
    expect(scrollByMock).toHaveBeenCalledWith({
      left: 100, // 200 * 0.5
      behavior: 'smooth',
    });
  });

  it('respects prefers-reduced-motion when scrolling', () => {
    const elRef = ref(mockElement as HTMLElement);
    const { scrollBy } = useScrollArrows(elRef);

    const originalMatchMedia = window.matchMedia;

    try {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      scrollBy(1);
      expect(scrollByMock).toHaveBeenCalledWith({
        left: 140, // Math.round(200 * 0.7)
        behavior: 'auto',
      });
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
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
