import { ref, watch, nextTick, onUnmounted, type ComponentPublicInstance, type Ref } from 'vue';
import type { Excursion } from '../api/types';
import type TripMap from '../components/TripMap.vue';
import type { SheetState } from './useExcursionsLayout';

export interface SpotGroupCategory {
  category: string;
  excursion: Excursion | null;
}

export interface UseCategoryNavSpyOptions {
  spotGroups: Ref<SpotGroupCategory[]>;
  isSheetOverlayMode: Ref<boolean>;
  sheetState: Ref<SheetState>;
  sheetHeightPx: (state: SheetState) => number;
  sheetEl: Ref<HTMLElement | null>;
  tripMapRef: Ref<InstanceType<typeof TripMap> | null>;
}

export function resolveDomElement(
  el: Element | ComponentPublicInstance | null
): HTMLElement | null {
  if (!el) return null;
  if (el instanceof HTMLElement) return el;
  let dom: Node | null = '$el' in el ? (el.$el as Node | null) : null;
  while (dom && !(dom instanceof HTMLElement)) {
    dom = dom.nextSibling;
  }
  return dom instanceof HTMLElement ? dom : null;
}

export function useCategoryNavSpy(options: UseCategoryNavSpyOptions) {
  const { spotGroups, isSheetOverlayMode, sheetState, sheetHeightPx, sheetEl, tripMapRef } =
    options;

  const pageTitleHeight = ref(0);
  let pageTitleObserver: ResizeObserver | null = null;

  function setPageTitleRef(el: Element | ComponentPublicInstance | null) {
    pageTitleObserver?.disconnect();
    pageTitleObserver = null;
    if (el instanceof HTMLElement) {
      pageTitleObserver = new ResizeObserver(() => {
        const marginBottom = parseFloat(getComputedStyle(el).marginBottom) || 0;
        pageTitleHeight.value = el.getBoundingClientRect().height + marginBottom;
      });
      pageTitleObserver.observe(el);
    }
  }

  const isCategoryNavStuck = ref(false);
  let categoryNavObserver: IntersectionObserver | null = null;

  function setCategoryNavSentinelRef(el: Element | ComponentPublicInstance | null) {
    categoryNavObserver?.disconnect();
    categoryNavObserver = null;
    if (el instanceof HTMLElement) {
      categoryNavObserver = new IntersectionObserver(
        ([entry]) => {
          isCategoryNavStuck.value = !entry.isIntersecting;
        },
        { root: el.closest('.spots-col'), threshold: 0 }
      );
      categoryNavObserver.observe(el);
    }
  }

  const categoryRefs = new Map<string, HTMLElement>();
  function setCategoryRef(category: string, el: Element | ComponentPublicInstance | null) {
    const domEl = resolveDomElement(el);
    if (domEl) categoryRefs.set(category, domEl);
    else categoryRefs.delete(category);
  }

  const excursionRefs = new Map<number, HTMLElement>();
  function setExcursionRef(id: number, el: Element | ComponentPublicInstance | null) {
    const domEl = resolveDomElement(el);
    if (domEl) excursionRefs.set(id, domEl);
    else excursionRefs.delete(id);
  }

  function setTourCardRef(
    category: string,
    excursionId: number,
    el: Element | ComponentPublicInstance | null
  ) {
    setCategoryRef(category, el);
    setExcursionRef(excursionId, el);
  }

  const spotRefs = new Map<number, HTMLElement>();
  function setSpotRef(id: number, el: Element | ComponentPublicInstance | null) {
    const domEl = resolveDomElement(el);
    if (domEl) spotRefs.set(id, domEl);
    else spotRefs.delete(id);
  }

  const spotsColBodyEl = ref<HTMLElement | null>(null);

  let activeScrollToken = 0;
  let programmaticScrollTarget: string | null = null;
  let programmaticScrollTimeout: ReturnType<typeof setTimeout> | null = null;

  function cancelProgrammaticScroll() {
    activeScrollToken++;
    programmaticScrollTarget = null;
    if (programmaticScrollTimeout) {
      clearTimeout(programmaticScrollTimeout);
      programmaticScrollTimeout = null;
    }
  }

  async function scrollToElementInBody(
    elGetter: () => HTMLElement | null | undefined,
    offsetAdjustment = 0,
    overrideBehavior?: ScrollBehavior
  ) {
    const token = ++activeScrollToken;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isSheetOverlayMode.value) {
      const sheet = sheetEl.value;
      if (sheet && !prefersReduced) {
        const expectedHeight = sheetHeightPx(sheetState.value);
        const currentHeight = sheet.getBoundingClientRect().height;
        if (Math.abs(currentHeight - expectedHeight) > 2) {
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              sheet.removeEventListener('transitionend', onEnd);
              clearTimeout(timer);
              resolve();
            };
            const onEnd = (e: TransitionEvent) => {
              if (
                e.target === sheet &&
                (e.propertyName === 'height' || e.propertyName === 'bottom')
              ) {
                finish();
              }
            };
            sheet.addEventListener('transitionend', onEnd);
            const timer = setTimeout(finish, 350);
          });
        }
      }
      if (token !== activeScrollToken) return;

      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (token !== activeScrollToken) return;
    }

    let el = elGetter();
    if (!el) {
      await nextTick();
      if (token !== activeScrollToken) return;
      el = elGetter();
    }
    if (!el) return;

    const body = spotsColBodyEl.value;
    if (!body) {
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }

    const bodyRect = body.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const currentScrollTop = body.scrollTop;
    const elTopInBody = currentScrollTop + (elRect.top - bodyRect.top) + offsetAdjustment;

    let navClearance = 0;
    const navWrap = categoryNavEl.value?.closest('.category-nav-wrap') as HTMLElement | null;
    const bodyStyle = getComputedStyle(body);
    const bodyPaddingTop = parseFloat(bodyStyle.paddingTop) || 0;

    if (navWrap && navWrap.offsetParent !== null) {
      const navTop = parseFloat(getComputedStyle(navWrap).top) || 0;
      const navHeight = navWrap.getBoundingClientRect().height;
      navClearance = Math.max(0, bodyPaddingTop + navTop + navHeight);
    } else if (categoryNavEl.value && categoryNavEl.value.offsetParent !== null) {
      navClearance = bodyPaddingTop + categoryNavEl.value.getBoundingClientRect().height;
    } else if (categoryNavHeight.value) {
      navClearance = bodyPaddingTop + categoryNavHeight.value;
    } else {
      navClearance = bodyPaddingTop;
    }

    const spacing = 16;
    const targetScrollTop = Math.max(0, elTopInBody - navClearance - spacing);
    const behavior = overrideBehavior ?? (prefersReduced ? 'auto' : 'smooth');

    if (behavior === 'auto' && Math.abs(body.scrollTop - targetScrollTop) <= 2) {
      return;
    }

    body.scrollTo({ top: targetScrollTop, behavior });
  }

  function scrollToExcursion(
    id: number,
    offsetAdjustment = 0,
    overrideBehavior?: ScrollBehavior
  ): Promise<void> {
    return scrollToElementInBody(
      () => {
        const el = excursionRefs.get(id);
        if (el) return el;
        const grp = spotGroups.value.find((g) => g.excursion?.id === id);
        if (grp) return categoryRefs.get(grp.category) ?? null;
        return null;
      },
      offsetAdjustment,
      overrideBehavior
    );
  }

  function scrollToSpot(
    id: number,
    offsetAdjustment = 0,
    overrideBehavior?: ScrollBehavior
  ): Promise<void> {
    return scrollToElementInBody(() => spotRefs.get(id), offsetAdjustment, overrideBehavior);
  }

  const activeCategory = ref<string | null>(null);
  watch(
    spotGroups,
    (groups) => {
      if (!groups.some((g) => g.category === activeCategory.value)) {
        activeCategory.value = groups[0]?.category ?? null;
      }
    },
    { immediate: true }
  );

  const categoryByEl = new Map<HTMLElement, string>();
  const intersectingCategories = new Set<string>();
  let categorySectionObserver: IntersectionObserver | null = null;

  function rebuildCategorySectionObserver() {
    categorySectionObserver?.disconnect();
    categorySectionObserver = null;
    intersectingCategories.clear();
    categoryByEl.clear();
    const firstEl = categoryRefs.values().next().value as HTMLElement | undefined;
    const root = firstEl?.closest('.spots-col') ?? null;
    if (!root) return;
    categorySectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const category = categoryByEl.get(entry.target as HTMLElement);
          if (!category) continue;
          if (entry.isIntersecting) intersectingCategories.add(category);
          else intersectingCategories.delete(category);
        }
        if (programmaticScrollTarget) {
          if (intersectingCategories.has(programmaticScrollTarget)) {
            activeCategory.value = programmaticScrollTarget;
            programmaticScrollTarget = null;
          }
          return;
        }
        const active = spotGroups.value.find((g) => intersectingCategories.has(g.category));
        if (active) activeCategory.value = active.category;
      },
      { root, rootMargin: `-${categoryNavHeight.value}px 0px -65% 0px`, threshold: 0 }
    );
    for (const [category, el] of categoryRefs) {
      categoryByEl.set(el, category);
      categorySectionObserver.observe(el);
    }
  }

  watch(spotGroups, () => nextTick(rebuildCategorySectionObserver));

  const navItemRefs = new Map<string, HTMLElement>();
  function setNavItemRef(category: string, el: Element | ComponentPublicInstance | null) {
    if (el instanceof HTMLElement) navItemRefs.set(category, el);
    else navItemRefs.delete(category);
  }

  const underlineLeft = ref(0);
  const underlineWidth = ref(0);
  function updateCategoryNavUnderline() {
    let activeEl = activeCategory.value ? navItemRefs.get(activeCategory.value) : null;
    if (!activeEl) {
      activeEl =
        categoryNavEl.value?.querySelector<HTMLElement>('.category-nav-item.active') ?? null;
    }
    if (!activeEl) return;
    underlineLeft.value = activeEl.offsetLeft;
    underlineWidth.value = activeEl.offsetWidth;
  }

  const categoryNavHeight = ref(44);
  let categoryNavResizeObserver: ResizeObserver | null = null;
  const categoryNavEl = ref<HTMLElement | null>(null);
  const canScrollNavLeft = ref(false);
  const canScrollNavRight = ref(false);

  function updateNavArrows() {
    const el = categoryNavEl.value;
    if (!el) return;
    canScrollNavLeft.value = el.scrollLeft > 1;
    canScrollNavRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
  }

  function setCategoryNavRef(el: Element | ComponentPublicInstance | null) {
    categoryNavResizeObserver?.disconnect();
    categoryNavResizeObserver = null;
    categoryNavEl.value = el instanceof HTMLElement ? el : null;
    if (el instanceof HTMLElement) {
      categoryNavResizeObserver = new ResizeObserver(() => {
        updateCategoryNavUnderline();
        categoryNavHeight.value = el.getBoundingClientRect().height;
        updateNavArrows();
      });
      categoryNavResizeObserver.observe(el);
      updateNavArrows();
      nextTick(updateCategoryNavUnderline);
    }
  }

  function scrollNavBy(direction: 1 | -1) {
    const el = categoryNavEl.value;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
  }

  function scrollToCategory(category: string) {
    activeCategory.value = category;
    programmaticScrollTarget = category;
    if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout);
    programmaticScrollTimeout = setTimeout(() => {
      programmaticScrollTarget = null;
    }, 1000);

    nextTick(() => {
      updateCategoryNavUnderline();
    });

    scrollToElementInBody(() => categoryRefs.get(category));
    tripMapRef.value?.focusCategory(category);
  }

  watch(spotGroups, () => {
    nextTick(() => {
      updateNavArrows();
      updateCategoryNavUnderline();
    });
  });

  watch(activeCategory, () => {
    nextTick(() => {
      updateCategoryNavUnderline();
      const activeEl = activeCategory.value ? navItemRefs.get(activeCategory.value) : null;
      const navEl = activeEl?.closest('.category-nav') as HTMLElement | null;
      if (!activeEl || !navEl) return;
      const elLeft = activeEl.offsetLeft;
      const elRight = elLeft + activeEl.offsetWidth;
      const viewLeft = navEl.scrollLeft;
      const viewRight = viewLeft + navEl.clientWidth;
      if (elLeft < viewLeft) navEl.scrollTo({ left: elLeft, behavior: 'smooth' });
      else if (elRight > viewRight)
        navEl.scrollTo({ left: elRight - navEl.clientWidth, behavior: 'smooth' });
    });
  });

  onUnmounted(() => {
    cancelProgrammaticScroll();
    pageTitleObserver?.disconnect();
    categoryNavObserver?.disconnect();
    categorySectionObserver?.disconnect();
    categoryNavResizeObserver?.disconnect();
  });

  return {
    pageTitleHeight,
    setPageTitleRef,
    isCategoryNavStuck,
    setCategoryNavSentinelRef,
    categoryRefs,
    excursionRefs,
    spotRefs,
    spotsColBodyEl,
    setCategoryRef,
    setExcursionRef,
    setTourCardRef,
    setSpotRef,
    activeCategory,
    rebuildCategorySectionObserver,
    navItemRefs,
    setNavItemRef,
    underlineLeft,
    underlineWidth,
    updateCategoryNavUnderline,
    categoryNavHeight,
    categoryNavEl,
    canScrollNavLeft,
    canScrollNavRight,
    updateNavArrows,
    setCategoryNavRef,
    scrollNavBy,
    scrollToElementInBody,
    scrollToCategory,
    scrollToExcursion,
    scrollToSpot,
    cancelProgrammaticScroll,
  };
}
