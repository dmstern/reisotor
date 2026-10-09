// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLandingScrollytelling } from './useLandingScrollytelling';

describe('useLandingScrollytelling', () => {
  let createdObservers: Array<{
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    callback: (entries: Partial<IntersectionObserverEntry>[]) => void;
  }> = [];

  beforeEach(() => {
    createdObservers = [];
    document.body.innerHTML = `
      <div class="scrolly-step" data-index="0">Step 0</div>
      <div class="scrolly-step" data-index="1">Step 1</div>
      <div class="scrolly-step" data-index="2">Step 2</div>
      <div class="scroll-animate">Animate 1</div>
    `;

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1000,
    });

    // Mock IntersectionObserver with a proper class constructor
    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      callback: (entries: Partial<IntersectionObserverEntry>[]) => void;

      constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
        this.callback = callback;
        createdObservers.push(this);
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('initializes with activeIndex 0 and zeroed glowOpacities', () => {
    const { activeIndex, glowOpacities } = useLandingScrollytelling({ stepCount: 3 });
    expect(activeIndex.value).toBe(0);
    expect(glowOpacities.value).toEqual([0, 0, 0]);
  });

  it('calculates glow opacities correctly based on element distance to viewport center', () => {
    const steps = document.querySelectorAll('.scrolly-step');
    // Viewport height: 1000, center: 500, maxDist: 600
    // Step 0: center at 500 -> distance 0 -> opacity 1
    // Step 1: center at 200 -> distance 300 -> opacity 0.5
    // Step 2: center at 1200 -> distance 700 -> opacity 0
    vi.spyOn(steps[0], 'getBoundingClientRect').mockReturnValue({
      top: 450,
      height: 100,
    } as DOMRect);
    vi.spyOn(steps[1], 'getBoundingClientRect').mockReturnValue({
      top: 150,
      height: 100,
    } as DOMRect);
    vi.spyOn(steps[2], 'getBoundingClientRect').mockReturnValue({
      top: 1150,
      height: 100,
    } as DOMRect);

    const { glowOpacities, updateGlow } = useLandingScrollytelling({ stepCount: 3 });
    updateGlow();

    expect(glowOpacities.value[0]).toBeCloseTo(1, 2);
    expect(glowOpacities.value[1]).toBeCloseTo(0.5, 2);
    expect(glowOpacities.value[2]).toBe(0);
  });

  it('observes step elements and updates activeIndex when intersecting', () => {
    const { activeIndex, initObservers } = useLandingScrollytelling();
    initObservers();

    const stepObserver = createdObservers[0];
    expect(stepObserver.observe).toHaveBeenCalledTimes(3);

    const step1 = document.querySelector('[data-index="1"]')!;
    stepObserver.callback([
      {
        isIntersecting: true,
        target: step1,
      },
    ]);

    expect(activeIndex.value).toBe(1);
  });

  it('activates fallback mode when CSS animation-timeline is unsupported', () => {
    vi.stubGlobal('CSS', {
      supports: vi.fn().mockReturnValue(false),
    });

    const { initObservers } = useLandingScrollytelling();
    initObservers();

    const animatedEl = document.querySelector('.scroll-animate')!;
    expect(animatedEl.classList.contains('fallback-mode')).toBe(true);

    const scrollObserver = createdObservers[1];
    scrollObserver.callback([
      {
        isIntersecting: true,
        target: animatedEl,
      },
    ]);

    expect(animatedEl.classList.contains('fallback-visible')).toBe(true);
  });

  it('cleans up observers and listeners on cleanupObservers', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { initObservers, cleanupObservers } = useLandingScrollytelling();

    initObservers();
    const stepObserver = createdObservers[0];
    cleanupObservers();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(stepObserver.disconnect).toHaveBeenCalled();
  });
});
