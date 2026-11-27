import {
  ref,
  computed,
  watch,
  nextTick,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  type Ref,
} from 'vue';
import {
  loadStoredSpotsColWidth,
  saveStoredSpotsColWidth,
  calcValidSpotsColWidth,
  MIN_SPOTS_COL_WIDTH,
  MAX_SPOTS_COL_WIDTH,
} from '../utils/spotsColWidth';
import type TripMap from '../components/TripMap.vue';
import { useDrawersStore } from '../stores/drawers';
import { BREAKPOINTS, MEDIA_QUERIES } from '../tokens/breakpoints';

export type SheetState = 'collapsed' | 'partial' | 'full';
export const SHEET_ORDER: SheetState[] = ['collapsed', 'partial', 'full'];

export interface UseExcursionsLayoutOptions {
  isDesktop: Ref<boolean>;
  tripMapRef: Ref<InstanceType<typeof TripMap> | null>;
}

export function useExcursionsLayout(options: UseExcursionsLayoutOptions) {
  const { isDesktop, tripMapRef } = options;
  const drawers = useDrawersStore();

  const spotsColWidth = ref(
    calcValidSpotsColWidth({
      preferredWidth: loadStoredSpotsColWidth(),
      availableWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
      isDesktop: isDesktop.value,
    })
  );
  watch(spotsColWidth, (v) => saveStoredSpotsColWidth(v));

  const resizingCol = ref(false);
  let colStartX = 0;
  let colStartWidth = 0;

  function onColResizeStart(event: PointerEvent) {
    resizingCol.value = true;
    colStartX = event.clientX;
    colStartWidth = spotsColWidth.value;
    window.addEventListener('pointermove', onColResizeMove);
    window.addEventListener('pointerup', onColResizeEnd);
    event.preventDefault();
  }

  function updateSpotsColRight() {
    if (isSheetOverlayMode.value || !sheetEl.value) {
      spotsColRightPx.value = 0;
      return;
    }

    const spotsRect = sheetEl.value.getBoundingClientRect();
    const mapLeft = tripMapRef.value?.$el?.getBoundingClientRect().left ?? 0;
    spotsColRightPx.value = Math.max(0, Math.round(spotsRect.right - mapLeft));
  }

  function onColResizeMove(event: PointerEvent) {
    if (!resizingCol.value) {
      return;
    }

    const MIN_MAP_WIDTH_PX = 380;
    const MAP_MARGIN_PX = 16;
    const delta = event.clientX - colStartX;
    const availableWidth =
      appMainWidth.value || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    const maxAllowed = Math.max(
      MIN_SPOTS_COL_WIDTH,
      Math.min(MAX_SPOTS_COL_WIDTH, availableWidth - MIN_MAP_WIDTH_PX - MAP_MARGIN_PX)
    );
    spotsColWidth.value = Math.min(
      maxAllowed,
      Math.max(MIN_SPOTS_COL_WIDTH, colStartWidth + delta)
    );
    updateSpotsColRight();
  }

  function onColResizeEnd() {
    resizingCol.value = false;
    window.removeEventListener('pointermove', onColResizeMove);
    window.removeEventListener('pointerup', onColResizeEnd);
  }

  const sheetState = ref<SheetState>('partial');
  const sheetDragging = ref(false);
  const sheetDragHeightPx = ref<number | null>(null);
  const sheetEl = ref<HTMLElement | null>(null);

  const SSR_FALLBACK_SHEET_HEIGHT_PX = 340;
  const FALLBACK_HEADER_HEIGHT_PX = 56;
  const FALLBACK_DRAWER_GAP_PX = 12;
  const MIN_SHEET_HEIGHT_PX = 160;
  const SHEET_TOP_SAFE_GAP_PX = 8;
  const COLLAPSED_SHEET_HEIGHT_PX = 64;
  const PARTIAL_SHEET_VIEWPORT_RATIO = 0.46;

  function sheetHeightPx(state: SheetState): number {
    if (typeof document === 'undefined') {
      return SSR_FALLBACK_SHEET_HEIGHT_PX;
    }

    const rootStyle = getComputedStyle(document.documentElement);
    const headerHeight =
      parseFloat(rootStyle.getPropertyValue('--app-header-height')) || FALLBACK_HEADER_HEIGHT_PX;
    const navbarOffset = parseFloat(rootStyle.getPropertyValue('--navbar-offset')) || 0;
    const navbarBottomOffset =
      parseFloat(rootStyle.getPropertyValue('--navbar-bottom-offset')) || 0;

    const drawerGap = parseFloat(rootStyle.getPropertyValue('--space-3')) || FALLBACK_DRAWER_GAP_PX;
    const bottomOffset = state === 'full' ? 0 : drawerGap + navbarBottomOffset;

    const maxAvailable = Math.max(
      MIN_SHEET_HEIGHT_PX,
      window.innerHeight - headerHeight - navbarOffset - SHEET_TOP_SAFE_GAP_PX - bottomOffset
    );

    if (state === 'collapsed') {
      return Math.min(COLLAPSED_SHEET_HEIGHT_PX, maxAvailable);
    }

    if (state === 'partial') {
      return Math.min(window.innerHeight * PARTIAL_SHEET_VIEWPORT_RATIO, maxAvailable);
    }

    return maxAvailable;
  }

  function applySheetHeight(heightPx: number) {
    if (sheetEl.value) {
      sheetEl.value.style.height = `${heightPx}px`;
    }
  }

  function clearSheetHeightOverride() {
    if (sheetEl.value) {
      sheetEl.value.style.height = '';
    }
  }

  const FLICK_SAMPLE_WINDOW_MS = 120;
  const FLICK_VELOCITY_PX_MS = 0.22;
  const SHEET_DRAG_THRESHOLD_PX = 8;
  const SHEET_STEP_DRAG_DISTANCE_PX = 48;
  const CLICK_SUPPRESSION_TIMEOUT_MS = 250;

  let dragSamples: { y: number; t: number }[] = [];

  function resetDragSamples() {
    dragSamples = [];
  }

  function recordDragSample(y: number) {
    const sampleTime = performance.now();
    dragSamples.push({ y, t: sampleTime });

    while (dragSamples.length > 1 && sampleTime - dragSamples[0].t > FLICK_SAMPLE_WINDOW_MS) {
      dragSamples.shift();
    }
  }

  function dragFlickVelocity(): number {
    if (dragSamples.length < 2) {
      return 0;
    }

    const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? (last.y - first.y) / dt : 0;
  }

  let activePointerId: number | null = null;
  let activePointerSource: 'handle' | 'body' | null = null;
  let activePointerTarget: HTMLElement | null = null;
  let sheetStartY = 0;
  let sheetStartHeight = 0;

  function isInteractiveTarget(target: HTMLElement | null): boolean {
    return Boolean(target?.closest('button, a, [role="button"], [role="link"], [role="tab"]'));
  }

  function suppressNextClick() {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    window.addEventListener('click', handler, { capture: true, once: true });
    timer = setTimeout(() => {
      window.removeEventListener('click', handler, { capture: true });
      timer = null;
    }, CLICK_SUPPRESSION_TIMEOUT_MS);
  }

  function closestSheetState(heightPx: number): SheetState {
    let closest: SheetState = 'partial';
    let bestDist = Infinity;

    for (const sheet of SHEET_ORDER) {
      const dist = Math.abs(sheetHeightPx(sheet) - heightPx);

      if (dist < bestDist) {
        bestDist = dist;
        closest = sheet;
      }
    }

    return closest;
  }

  function resolveSheetTargetState(startState: SheetState, heightPx: number): SheetState {
    const velocity = dragFlickVelocity();

    if (Math.abs(velocity) > FLICK_VELOCITY_PX_MS) {
      const direction = velocity < 0 ? 1 : -1;
      const next = SHEET_ORDER[SHEET_ORDER.indexOf(startState) + direction];

      if (next) {
        return next;
      }
    }

    const startStateHeight = sheetHeightPx(startState);
    const heightDelta = heightPx - startStateHeight;

    if (
      Math.abs(heightDelta) >= SHEET_STEP_DRAG_DISTANCE_PX &&
      ((heightDelta > 0 && velocity <= 0) || (heightDelta < 0 && velocity >= 0))
    ) {
      const stepDirection = heightDelta > 0 ? 1 : -1;
      const nextState = SHEET_ORDER[SHEET_ORDER.indexOf(startState) + stepDirection];

      if (nextState) {
        return nextState;
      }
    }

    return closestSheetState(heightPx);
  }

  function cleanUpPointerListeners() {
    activePointerId = null;
    activePointerSource = null;
    activePointerTarget = null;
    sheetDragging.value = false;
    window.removeEventListener('pointermove', onSheetPointerMove);
    window.removeEventListener('pointerup', onSheetPointerUp);
    window.removeEventListener('pointercancel', onSheetPointerCancel);
  }

  function handlePointerDown(event: PointerEvent, source: 'handle' | 'body') {
    if (event.button !== 0) {
      return;
    }

    if (event.pointerType === 'mouse' && !isSheetOverlayMode.value) {
      return;
    }

    if (source === 'body' && sheetState.value === 'full') {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (
      target?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
    ) {
      return;
    }

    activePointerId = event.pointerId;
    activePointerSource = source;
    activePointerTarget = target;
    sheetStartY = event.clientY;
    sheetStartHeight = sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value);
    sheetDragging.value = false;

    resetDragSamples();
    recordDragSample(event.clientY);

    window.addEventListener('pointermove', onSheetPointerMove);
    window.addEventListener('pointerup', onSheetPointerUp);
    window.addEventListener('pointercancel', onSheetPointerCancel);
  }

  function onSheetPointerMove(event: PointerEvent) {
    if (activePointerId != null && event.pointerId !== activePointerId) {
      return;
    }

    const delta = sheetStartY - event.clientY;

    if (!sheetDragging.value) {
      if (Math.abs(delta) < SHEET_DRAG_THRESHOLD_PX) {
        return;
      }

      sheetDragging.value = true;
    }

    const next = sheetStartHeight + delta;
    const clamped = Math.min(sheetHeightPx('full'), Math.max(sheetHeightPx('collapsed'), next));
    sheetDragHeightPx.value = clamped;
    applySheetHeight(clamped);
    recordDragSample(event.clientY);
    event.preventDefault();
  }

  function onSheetPointerUp(event: PointerEvent) {
    if (activePointerId != null && event.pointerId !== activePointerId) {
      return;
    }

    const wasDragging = sheetDragging.value;
    const source = activePointerSource;
    const target = activePointerTarget;

    cleanUpPointerListeners();

    if (wasDragging) {
      suppressNextClick();
      const current = sheetDragHeightPx.value;

      if (current != null) {
        sheetState.value = resolveSheetTargetState(sheetState.value, current);
      }
    } else if (source === 'handle' && !isInteractiveTarget(target)) {
      sheetState.value =
        SHEET_ORDER[(SHEET_ORDER.indexOf(sheetState.value) + 1) % SHEET_ORDER.length];
    }

    nextTick(() => {
      sheetDragHeightPx.value = null;
      clearSheetHeightOverride();
    });
  }

  function onSheetPointerCancel(event: PointerEvent) {
    if (activePointerId != null && event.pointerId !== activePointerId) {
      return;
    }

    cleanUpPointerListeners();

    nextTick(() => {
      sheetDragHeightPx.value = null;
      clearSheetHeightOverride();
    });
  }

  function onSheetDragStart(event: PointerEvent) {
    handlePointerDown(event, 'handle');
  }

  function onSheetBodyPointerDown(event: PointerEvent) {
    handlePointerDown(event, 'body');
  }

  function stepSheet(direction: 1 | -1) {
    const next = SHEET_ORDER[SHEET_ORDER.indexOf(sheetState.value) + direction];

    if (next) {
      sheetState.value = next;
    }
  }

  const canExpandSheet = computed(() => sheetState.value !== 'full');
  const canCollapseSheet = computed(() => sheetState.value !== 'collapsed');

  const currentSheetHeightPx = computed(() => {
    const targetState = sheetState.value === 'full' ? 'partial' : sheetState.value;
    return sheetHeightPx(targetState);
  });

  const SPOTS_COL_RIGHT_MARGIN_PX = 16;
  const LAYOUT_SETTLE_FAST_MS = 50;
  const LAYOUT_SETTLE_SLOW_MS = 300;
  const SHEET_OVERLAY_BREAKPOINT_PX = 720;
  const CALENDAR_DRAWER_TRANSITION_MS = 260;

  const appMainWidth = ref(typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.desktop);
  const spotsColRightPx = ref(
    typeof window !== 'undefined' && window.matchMedia(MEDIA_QUERIES.desktop).matches
      ? spotsColWidth.value + SPOTS_COL_RIGHT_MARGIN_PX
      : 0
  );
  let appMainResizeObserver: ResizeObserver | null = null;
  let spotsColResizeObserver: ResizeObserver | null = null;

  function onWindowResize() {
    const appMainEl = document.querySelector('.app-main');

    if (appMainEl) {
      appMainWidth.value = appMainEl.clientWidth;
    }

    if (!isSheetOverlayMode.value) {
      const validWidth = calcValidSpotsColWidth({
        preferredWidth: spotsColWidth.value,
        availableWidth: appMainWidth.value,
        isDesktop: true,
      });

      if (spotsColWidth.value !== validWidth) {
        spotsColWidth.value = validWidth;
      }
    }

    updateSpotsColRight();
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      const appMainEl = document.querySelector('.app-main');

      if (appMainEl) {
        appMainWidth.value = appMainEl.clientWidth;
        appMainResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            appMainWidth.value = entry.contentRect.width;
          }

          if (!isSheetOverlayMode.value) {
            const validWidth = calcValidSpotsColWidth({
              preferredWidth: spotsColWidth.value,
              availableWidth: appMainWidth.value,
              isDesktop: true,
            });

            if (spotsColWidth.value !== validWidth) {
              spotsColWidth.value = validWidth;
            }
          }

          updateSpotsColRight();
        });
        appMainResizeObserver.observe(appMainEl);
      }

      if (sheetEl.value) {
        spotsColResizeObserver = new ResizeObserver(() => {
          updateSpotsColRight();
        });
        spotsColResizeObserver.observe(sheetEl.value);
      }

      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('map-view-active');
        document.body.classList.add('map-view-active');
      }

      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
      }

      window.addEventListener('resize', onWindowResize);
      updateSpotsColRight();
      nextTick(() => {
        updateSpotsColRight();
        setTimeout(updateSpotsColRight, LAYOUT_SETTLE_FAST_MS);
        setTimeout(updateSpotsColRight, LAYOUT_SETTLE_SLOW_MS);
      });
    });

    onUnmounted(() => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('map-view-active');
        document.body.classList.remove('map-view-active');
      }

      appMainResizeObserver?.disconnect();
      spotsColResizeObserver?.disconnect();
      window.removeEventListener('resize', onWindowResize);
      cleanUpPointerListeners();
    });
  }

  const isSheetOverlayMode = computed(
    () => !isDesktop.value || appMainWidth.value < SHEET_OVERLAY_BREAKPOINT_PX
  );
  const mapCoveredBottomPx = computed(() =>
    isSheetOverlayMode.value ? currentSheetHeightPx.value : 0
  );
  const mapCoveredLeftPx = computed(() => (isSheetOverlayMode.value ? 0 : spotsColRightPx.value));

  watch([isSheetOverlayMode, spotsColWidth, tripMapRef], () => nextTick(updateSpotsColRight));

  watch(
    isSheetOverlayMode,
    (overlay) => {
      clearSheetHeightOverride();

      if (overlay) {
        return;
      }

      if (sheetState.value === 'collapsed') {
        sheetState.value = 'partial';
      }

      const validWidth = calcValidSpotsColWidth({
        preferredWidth: loadStoredSpotsColWidth() ?? spotsColWidth.value,
        availableWidth: appMainWidth.value,
        isDesktop: true,
      });

      if (spotsColWidth.value !== validWidth) {
        spotsColWidth.value = validWidth;
      }
    },
    { immediate: true }
  );

  watch(
    () => [drawers.calendarOpen, drawers.calendarWidth],
    () => {
      nextTick(updateSpotsColRight);
      setTimeout(updateSpotsColRight, CALENDAR_DRAWER_TRANSITION_MS);
    },
    { immediate: true }
  );

  return {
    spotsColWidth,
    resizingCol,
    onColResizeStart,
    sheetState,
    sheetDragging,
    sheetDragHeightPx,
    sheetEl,
    sheetHeightPx,
    applySheetHeight,
    clearSheetHeightOverride,
    onSheetDragStart,
    onSheetBodyPointerDown,
    stepSheet,
    canExpandSheet,
    canCollapseSheet,
    currentSheetHeightPx,
    appMainWidth,
    spotsColRightPx,
    isSheetOverlayMode,
    mapCoveredBottomPx,
    mapCoveredLeftPx,
    updateSpotsColRight,
  };
}
