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
    if (!resizingCol.value) return;
    const delta = event.clientX - colStartX;
    const availableWidth =
      appMainWidth.value || (typeof window !== 'undefined' ? window.innerWidth : 1024);
    const maxAllowed = Math.max(
      MIN_SPOTS_COL_WIDTH,
      Math.min(MAX_SPOTS_COL_WIDTH, availableWidth - 380 - 16)
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

  function sheetHeightPx(state: SheetState): number {
    if (typeof document === 'undefined') return 340;
    const rootStyle = getComputedStyle(document.documentElement);
    const headerHeight = parseFloat(rootStyle.getPropertyValue('--app-header-height')) || 56;
    const navbarOffset = parseFloat(rootStyle.getPropertyValue('--navbar-offset')) || 0;
    const navbarBottomOffset =
      parseFloat(rootStyle.getPropertyValue('--navbar-bottom-offset')) || 0;

    const drawerGap = parseFloat(rootStyle.getPropertyValue('--space-3')) || 12;
    const bottomOffset = state === 'full' ? 0 : drawerGap + navbarBottomOffset;

    const maxAvailable = Math.max(
      160,
      window.innerHeight - headerHeight - navbarOffset - 8 - bottomOffset
    );

    if (state === 'collapsed') return Math.min(64, maxAvailable);
    if (state === 'partial') return Math.min(window.innerHeight * 0.46, maxAvailable);
    return maxAvailable;
  }

  function applySheetHeight(heightPx: number) {
    if (sheetEl.value) sheetEl.value.style.height = `${heightPx}px`;
  }

  function clearSheetHeightOverride() {
    if (sheetEl.value) sheetEl.value.style.height = '';
  }

  const FLICK_SAMPLE_WINDOW_MS = 80;
  const FLICK_VELOCITY_PX_MS = 0.35;
  let dragSamples: { y: number; t: number }[] = [];

  function resetDragSamples() {
    dragSamples = [];
  }

  function recordDragSample(y: number) {
    const t = performance.now();
    dragSamples.push({ y, t });
    while (dragSamples.length > 1 && t - dragSamples[0].t > FLICK_SAMPLE_WINDOW_MS)
      dragSamples.shift();
  }

  function dragFlickVelocity(): number {
    if (dragSamples.length < 2) return 0;
    const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? (last.y - first.y) / dt : 0;
  }

  let sheetStartY = 0;
  let sheetStartHeight = 0;

  function onSheetDragStart(event: PointerEvent) {
    if (event.pointerType === 'mouse' && !isSheetOverlayMode.value) return;
    sheetDragging.value = true;
    sheetStartY = event.clientY;
    sheetStartHeight = sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value);
    resetDragSamples();
    recordDragSample(event.clientY);
    window.addEventListener('pointermove', onSheetDragMove);
    window.addEventListener('pointerup', onSheetDragEnd);
    event.preventDefault();
  }

  function onSheetDragMove(event: PointerEvent) {
    if (!sheetDragging.value) return;
    const delta = sheetStartY - event.clientY;
    const next = sheetStartHeight + delta;
    const clamped = Math.min(sheetHeightPx('full'), Math.max(sheetHeightPx('collapsed'), next));
    sheetDragHeightPx.value = clamped;
    applySheetHeight(clamped);
    recordDragSample(event.clientY);
  }

  function closestSheetState(heightPx: number): SheetState {
    let closest: SheetState = 'partial';
    let bestDist = Infinity;
    for (const s of SHEET_ORDER) {
      const dist = Math.abs(sheetHeightPx(s) - heightPx);
      if (dist < bestDist) {
        bestDist = dist;
        closest = s;
      }
    }
    return closest;
  }

  function resolveSheetTargetState(startState: SheetState, heightPx: number): SheetState {
    const velocity = dragFlickVelocity();
    if (Math.abs(velocity) > FLICK_VELOCITY_PX_MS) {
      const direction = velocity < 0 ? 1 : -1;
      const next = SHEET_ORDER[SHEET_ORDER.indexOf(startState) + direction];
      if (next) return next;
    }
    return closestSheetState(heightPx);
  }

  function onSheetDragEnd() {
    sheetDragging.value = false;
    window.removeEventListener('pointermove', onSheetDragMove);
    window.removeEventListener('pointerup', onSheetDragEnd);
    const current = sheetDragHeightPx.value;
    const movedFar = current != null && Math.abs(current - sheetStartHeight) > 8;
    if (!movedFar) {
      sheetState.value =
        SHEET_ORDER[(SHEET_ORDER.indexOf(sheetState.value) + 1) % SHEET_ORDER.length];
    } else {
      sheetState.value = resolveSheetTargetState(sheetState.value, current as number);
    }
    nextTick(() => {
      sheetDragHeightPx.value = null;
      clearSheetHeightOverride();
    });
  }

  const SHEET_BODY_DRAG_THRESHOLD = 8;
  let sheetBodyDragging = false;
  let sheetBodyStartY = 0;
  let sheetBodyStartHeight = 0;

  function onSheetBodyPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && !isSheetOverlayMode.value) return;
    if (sheetState.value === 'full') return;
    if (
      (event.target as HTMLElement).closest(
        'button, a, input, textarea, select, [draggable="true"]'
      )
    )
      return;
    sheetBodyDragging = false;
    sheetBodyStartY = event.clientY;
    sheetBodyStartHeight = sheetDragHeightPx.value ?? sheetHeightPx(sheetState.value);
    resetDragSamples();
    recordDragSample(event.clientY);
    window.addEventListener('pointermove', onSheetBodyPointerMove);
    window.addEventListener('pointerup', onSheetBodyPointerUp);
  }

  function onSheetBodyPointerMove(event: PointerEvent) {
    const delta = sheetBodyStartY - event.clientY;
    if (!sheetBodyDragging) {
      if (Math.abs(delta) < SHEET_BODY_DRAG_THRESHOLD) return;
      sheetBodyDragging = true;
      sheetDragging.value = true;
    }
    const next = sheetBodyStartHeight + delta;
    const clamped = Math.min(sheetHeightPx('full'), Math.max(sheetHeightPx('collapsed'), next));
    sheetDragHeightPx.value = clamped;
    applySheetHeight(clamped);
    recordDragSample(event.clientY);
    event.preventDefault();
  }

  function onSheetBodyPointerUp() {
    window.removeEventListener('pointermove', onSheetBodyPointerMove);
    window.removeEventListener('pointerup', onSheetBodyPointerUp);
    if (!sheetBodyDragging) return;
    sheetBodyDragging = false;
    sheetDragging.value = false;
    const current = sheetDragHeightPx.value;
    if (current != null) sheetState.value = resolveSheetTargetState(sheetState.value, current);
    nextTick(() => {
      sheetDragHeightPx.value = null;
      clearSheetHeightOverride();
    });
  }

  function stepSheet(direction: 1 | -1) {
    const next = SHEET_ORDER[SHEET_ORDER.indexOf(sheetState.value) + direction];
    if (next) sheetState.value = next;
  }

  const canExpandSheet = computed(() => sheetState.value !== 'full');
  const canCollapseSheet = computed(() => sheetState.value !== 'collapsed');

  const currentSheetHeightPx = computed(() => {
    const targetState = sheetState.value === 'full' ? 'partial' : sheetState.value;
    return sheetHeightPx(targetState);
  });

  const appMainWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const spotsColRightPx = ref(
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
      ? spotsColWidth.value + 16
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
        setTimeout(updateSpotsColRight, 50);
        setTimeout(updateSpotsColRight, 300);
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
    });
  }

  const isSheetOverlayMode = computed(() => !isDesktop.value || appMainWidth.value < 720);
  const mapCoveredBottomPx = computed(() =>
    isSheetOverlayMode.value ? currentSheetHeightPx.value : 0
  );
  const mapCoveredLeftPx = computed(() => (isSheetOverlayMode.value ? 0 : spotsColRightPx.value));

  watch([isSheetOverlayMode, spotsColWidth, tripMapRef], () => nextTick(updateSpotsColRight));

  watch(
    isSheetOverlayMode,
    (overlay) => {
      clearSheetHeightOverride();
      if (!overlay) {
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
      }
    },
    { immediate: true }
  );

  watch(
    () => [drawers.calendarOpen, drawers.calendarWidth],
    () => {
      nextTick(updateSpotsColRight);
      setTimeout(updateSpotsColRight, 260);
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
