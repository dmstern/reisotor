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
});
