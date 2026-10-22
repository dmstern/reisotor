// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ref, createApp } from 'vue';
import { useCategoryNavSpy } from './useCategoryNavSpy';

describe('useCategoryNavSpy - spot refs and scrolling', () => {
  function createSpy() {
    let result!: ReturnType<typeof useCategoryNavSpy>;
    const app = createApp({
      setup() {
        result = useCategoryNavSpy({
          spotGroups: ref([]),
          isSheetOverlayMode: ref(false),
          sheetState: ref('partial'),
          sheetHeightPx: () => 300,
          sheetEl: ref(null),
          tripMapRef: ref(null),
        });
        return () => {};
      },
    });
    app.mount(document.createElement('div'));
    return result;
  }

  it('handles multiple instances of the same spot in different tours', () => {
    const { setSpotRef, getSpotElement } = createSpy();

    // Create 2 container elements representing Tour 10 and Tour 20
    const tour10Container = document.createElement('div');
    const tour20Container = document.createElement('div');
    document.body.appendChild(tour10Container);
    document.body.appendChild(tour20Container);

    // Create two instances of Spot 42
    const spotInTour10 = document.createElement('article');
    spotInTour10.className = 'spot-card';
    tour10Container.appendChild(spotInTour10);

    const spotInTour20 = document.createElement('article');
    spotInTour20.className = 'spot-card';
    tour20Container.appendChild(spotInTour20);

    // Register both instances
    setSpotRef(42, spotInTour10, 10);
    setSpotRef(42, spotInTour20, 20);

    // Preferred excursion gets the exact instance
    expect(getSpotElement(42, 10)).toBe(spotInTour10);
    expect(getSpotElement(42, 20)).toBe(spotInTour20);

    // If Tour 20 is inert/collapsed, getSpotElement prefers the visible one (Tour 10)
    tour20Container.setAttribute('inert', '');
    expect(getSpotElement(42)).toBe(spotInTour10);

    // Unmounting Tour 20 removes Tour 20's ref, keeping Tour 10 intact
    setSpotRef(42, null, 20);
    expect(getSpotElement(42, 10)).toBe(spotInTour10);
    // When Tour 20 is requested but no longer has it, it falls back to Tour 10
    expect(getSpotElement(42, 20)).toBe(spotInTour10);

    // Unmounting Tour 10 removes the last ref
    setSpotRef(42, null, 10);
    expect(getSpotElement(42)).toBeNull();

    // Cleanup
    tour10Container.remove();
    tour20Container.remove();
  });

  it('scrollToSpot scrolls to the exact HTMLElement passed', async () => {
    const { scrollToSpot, spotsColBodyEl } = createSpy();

    const body = document.createElement('div');
    body.className = 'spots-col-body';
    document.body.appendChild(body);
    spotsColBodyEl.value = body;

    let scrolledToTop: number | null = null;
    body.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && options?.top !== undefined) {
        scrolledToTop = options.top;
      }
    };

    const targetEl = document.createElement('article');
    targetEl.className = 'spot-card';
    body.appendChild(targetEl);

    await scrollToSpot(targetEl);
    expect(scrolledToTop).not.toBeNull();

    body.remove();
  });

  it('setProgrammaticActiveCategory updates activeCategory immediately', () => {
    const { setProgrammaticActiveCategory, activeCategory } = createSpy();
    expect(activeCategory.value).toBeNull();
    setProgrammaticActiveCategory('Wanderung', 1000);
    expect(activeCategory.value).toBe('Wanderung');
  });

  it('scrollToCategory sets activeCategory and scrolls body to category element', async () => {
    const { setCategoryRef, scrollToCategory, spotsColBodyEl, activeCategory } = createSpy();

    const body = document.createElement('div');
    body.className = 'spots-col-body';
    document.body.appendChild(body);
    spotsColBodyEl.value = body;

    let scrolledToTop: number | null = null;
    body.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && options?.top !== undefined) {
        scrolledToTop = options.top;
      }
    };

    const targetEl = document.createElement('section');
    targetEl.className = 'tour-group-card';
    body.appendChild(targetEl);
    setCategoryRef('Wanderung', targetEl);

    await scrollToCategory('Wanderung');
    expect(activeCategory.value).toBe('Wanderung');
    expect(scrolledToTop).not.toBeNull();

    body.remove();
  });

  it('scrollToExcursion does not subtract categoryNavHeight when categoryNavEl is unmounted', async () => {
    const { setExcursionRef, setCategoryNavRef, scrollToExcursion, spotsColBodyEl } = createSpy();

    const body = document.createElement('div');
    body.className = 'spots-col-body';
    body.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;
    document.body.appendChild(body);
    spotsColBodyEl.value = body;

    let scrolledToTop: number | null = null;
    body.scrollTo = (options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && options?.top !== undefined) {
        scrolledToTop = options.top;
      }
    };

    const targetEl = document.createElement('article');
    targetEl.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
    body.appendChild(targetEl);
    setExcursionRef(7, targetEl);

    // Without categoryNavEl mounted (Tours mode): elTopInBody (200) - spacing (16) = 184
    await scrollToExcursion(7);
    expect(scrolledToTop).toBe(184);

    // With categoryNavEl mounted (Category mode): 200 - navHeight (44) - spacing (16) = 140
    const navEl = document.createElement('nav');
    setCategoryNavRef(navEl);
    await scrollToExcursion(7);
    expect(scrolledToTop).toBe(140);

    setCategoryNavRef(null);
    body.remove();
  });

  describe('isCardWellVisibleInBody', () => {
    it('returns false when target element or body is not connected', () => {
      const { isCardWellVisibleInBody } = createSpy();
      const detachedEl = document.createElement('article');
      expect(isCardWellVisibleInBody(null)).toBe(false);
      expect(isCardWellVisibleInBody(detachedEl)).toBe(false);
    });

    it('returns true when card is comfortably inside visible bounds', () => {
      const { isCardWellVisibleInBody, spotsColBodyEl } = createSpy();

      const body = document.createElement('div');
      body.className = 'spots-col-body';
      body.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800 }) as DOMRect;
      document.body.appendChild(body);
      spotsColBodyEl.value = body;

      const targetEl = document.createElement('article');
      targetEl.getBoundingClientRect = () => ({ top: 250, bottom: 550, height: 300 }) as DOMRect;
      body.appendChild(targetEl);

      expect(isCardWellVisibleInBody(targetEl)).toBe(true);

      body.remove();
    });

    it('returns false when card bottom extends beyond visible bottom', () => {
      const { isCardWellVisibleInBody, spotsColBodyEl } = createSpy();

      const body = document.createElement('div');
      body.className = 'spots-col-body';
      body.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800 }) as DOMRect;
      document.body.appendChild(body);
      spotsColBodyEl.value = body;

      const targetEl = document.createElement('article');
      // Card bottom 920 extends past body bottom 900
      targetEl.getBoundingClientRect = () => ({ top: 650, bottom: 920, height: 270 }) as DOMRect;
      body.appendChild(targetEl);

      expect(isCardWellVisibleInBody(targetEl)).toBe(false);

      body.remove();
    });

    it('returns false when card top is under nav clearance', () => {
      const { isCardWellVisibleInBody, spotsColBodyEl, setCategoryNavRef } = createSpy();

      const body = document.createElement('div');
      body.className = 'spots-col-body';
      body.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800 }) as DOMRect;
      document.body.appendChild(body);
      spotsColBodyEl.value = body;

      const navEl = document.createElement('nav');
      setCategoryNavRef(navEl);

      const targetEl = document.createElement('article');
      // Nav clearance is 44px, body.top is 100, visibleTop is 144. Target top at 120 is behind nav!
      targetEl.getBoundingClientRect = () => ({ top: 120, bottom: 420, height: 300 }) as DOMRect;
      body.appendChild(targetEl);

      expect(isCardWellVisibleInBody(targetEl)).toBe(false);

      setCategoryNavRef(null);
      body.remove();
    });

    it('returns false when expanded card height is taller than visible height', () => {
      const { isCardWellVisibleInBody, spotsColBodyEl } = createSpy();

      const body = document.createElement('div');
      body.className = 'spots-col-body';
      body.getBoundingClientRect = () => ({ top: 100, bottom: 500, height: 400 }) as DOMRect;
      document.body.appendChild(body);
      spotsColBodyEl.value = body;

      const targetEl = document.createElement('article');
      // Card height 420 > visible height 400
      targetEl.getBoundingClientRect = () => ({ top: 100, bottom: 520, height: 420 }) as DOMRect;
      body.appendChild(targetEl);

      expect(isCardWellVisibleInBody(targetEl)).toBe(false);

      body.remove();
    });

    it('accounts for offsetAdjustment from preceding collapsing card', () => {
      const { isCardWellVisibleInBody, spotsColBodyEl } = createSpy();

      const body = document.createElement('div');
      body.className = 'spots-col-body';
      body.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800 }) as DOMRect;
      document.body.appendChild(body);
      spotsColBodyEl.value = body;

      const targetEl = document.createElement('article');
      // Currently at 650 with bottom 910 (too far down). But preceding card will collapse -100px.
      // Projected top: 550, projected bottom: 810 <= 900 - 8 -> fits!
      targetEl.getBoundingClientRect = () => ({ top: 650, bottom: 910, height: 260 }) as DOMRect;
      body.appendChild(targetEl);

      expect(isCardWellVisibleInBody(targetEl, 0)).toBe(false);
      expect(isCardWellVisibleInBody(targetEl, -100)).toBe(true);

      body.remove();
    });

    it('accounts for inner accordion expanding height', () => {
      const { isCardWellVisibleInBody, spotsColBodyEl } = createSpy();

      const body = document.createElement('div');
      body.className = 'spots-col-body';
      body.getBoundingClientRect = () => ({ top: 100, bottom: 900, height: 800 }) as DOMRect;
      document.body.appendChild(body);
      spotsColBodyEl.value = body;

      const targetEl = document.createElement('article');
      targetEl.getBoundingClientRect = () => ({ top: 600, bottom: 750, height: 150 }) as DOMRect;

      const acc = document.createElement('div');
      acc.className = 'spot-accordion is-expanded';
      acc.getBoundingClientRect = () => ({ height: 0 }) as DOMRect;

      const inner = document.createElement('div');
      // Inner content will expand by 200px (150 + 200 = 350, so bottom will be 600 + 350 = 950 > 892)
      Object.defineProperty(inner, 'scrollHeight', { value: 200, configurable: true });
      acc.appendChild(inner);
      targetEl.appendChild(acc);

      body.appendChild(targetEl);

      expect(isCardWellVisibleInBody(targetEl)).toBe(false);

      body.remove();
    });
  });
});
