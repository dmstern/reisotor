import {
  reactive,
  ref,
  nextTick,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  watch,
  type ComponentPublicInstance,
  type Ref,
} from 'vue';
import type { Excursion, ExcursionLeg, Spot } from '../api/types';
import {
  formatTravelDuration,
  formatTravelDurationParts,
  travelDurationMinutes,
} from '../utils/travelDuration';
import {
  buildTourSerpentineRows,
  buildLoopSegments,
  computeTourLoopPath,
  type TourSerpentineRow,
} from '../utils/tourSerpentine';
import { useExcursionsStore } from '../stores/excursions';

export interface TourLineData {
  width: number;
  height: number;
  hinwegPath: { d: string; y1: number; y2: number } | null;
  rueckwegPath: { d: string; y1: number; y2: number } | null;
  dots: { x: number; y: number; isEnd: boolean }[];
}

export interface UseTourSerpentineOptions {
  spotGroups?: Ref<unknown[]>;
}

export function useTourSerpentine(options: UseTourSerpentineOptions = {}) {
  const excursionsStore = useExcursionsStore();

  const tourLines = reactive(new Map<number, TourLineData>());
  const tourWrapRefs = new Map<number, HTMLElement>();
  const tourWrapWidths = reactive(new Map<number, number>());
  let tourLineResizeObserver: ResizeObserver | null = null;

  function getTourCols(excursionId: number): number {
    const w = tourWrapWidths.get(excursionId) ?? 0;
    if (w >= 1200) return 4;
    if (w >= 880) return 3;
    if (w >= 560) return 2;
    return 1;
  }

  function getTourRows(excursion: Excursion, items: Array<{ spot: Spot }>): TourSerpentineRow[] {
    const cols = getTourCols(excursion.id);
    return buildTourSerpentineRows(items, cols, excursion, getTourLeg);
  }

  function getTourLeg(
    excursion: Excursion,
    fromSpotId: number,
    toSpotId: number
  ): ExcursionLeg | undefined {
    return excursion.legs?.find((l) => l.from_spot_id === fromSpotId && l.to_spot_id === toSpotId);
  }

  function getLegDuration(leg: ExcursionLeg): string | null {
    const mins = travelDurationMinutes(leg.departure_time ?? null, leg.arrival_time ?? null);
    return mins != null ? formatTravelDuration(mins) : null;
  }

  function getLegDurationParts(leg: ExcursionLeg): string[] | null {
    const mins = travelDurationMinutes(leg.departure_time ?? null, leg.arrival_time ?? null);
    if (mins != null) return formatTravelDurationParts(mins);
    if (leg.duration_seconds != null) {
      const calcMins = Math.round(leg.duration_seconds / 60);
      return formatTravelDurationParts(calcMins);
    }
    return null;
  }

  function getLegTooltip(leg: ExcursionLeg, fromSpot: Spot, toSpot: Spot): string {
    const parts: string[] = [];
    if (leg.transport_type) parts.push(leg.transport_type);
    if (leg.departure_time || leg.arrival_time) {
      parts.push(`${leg.departure_time || '?'}–${leg.arrival_time || '?'}\u00A0Uhr`);
    }
    const dur = getLegDuration(leg);
    if (dur) parts.push(`(${dur})`);
    if (leg.amount != null) parts.push(`${leg.amount.toFixed(2).replace('.', ',')}\u00A0€`);
    parts.push(`• Von: ${fromSpot.title} → Nach: ${toSpot.title}`);
    parts.push('• Klicken zum Bearbeiten');
    return parts.join(' ');
  }

  function getTourLayover(
    excursion: Excursion,
    items: Array<{ spot: Spot }>,
    index: number
  ): number | null {
    if (index <= 0 || index >= items.length - 1) return null;
    const prevSpotId = items[index - 1].spot.id;
    const currSpotId = items[index].spot.id;
    const nextSpotId = items[index + 1].spot.id;
    const inLeg = getTourLeg(excursion, prevSpotId, currSpotId);
    const outLeg = getTourLeg(excursion, currSpotId, nextSpotId);
    if (!inLeg?.arrival_time || !outLeg?.departure_time) return null;
    return travelDurationMinutes(inLeg.arrival_time, outLeg.departure_time);
  }

  function recomputeTourLine(excursionId: number) {
    const wrapEl = tourWrapRefs.get(excursionId);
    if (!wrapEl) {
      tourLines.delete(excursionId);
      return;
    }
    const spotEls = Array.from(wrapEl.querySelectorAll<HTMLElement>('.staggered-spot'));
    if (!spotEls.length) {
      tourLines.delete(excursionId);
      return;
    }

    const wrapRect = wrapEl.getBoundingClientRect();
    const spotBoxes = spotEls.map((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left - wrapRect.left;
      const y = r.top - wrapRect.top;
      return {
        x,
        y,
        top: y,
        width: r.width,
        height: r.height,
        cx: x + r.width / 2,
        cy: y + r.height / 2,
        right: x + r.width,
        bottom: y + r.height,
      };
    });

    const dots: { x: number; y: number; isEnd: boolean }[] = [];
    const hinwegSegments: { d: string; y1: number; y2: number }[] = [];
    const rueckwegSegments: { d: string; y1: number; y2: number }[] = [];

    const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
    let destinationIndex = -1;
    if (excursion && excursion.destination_spot_id != null) {
      const domSpotIds = spotEls.map((el) => Number(el.dataset.spotId));
      destinationIndex = domSpotIds.indexOf(excursion.destination_spot_id);
    }

    for (let i = 0; i < spotBoxes.length - 1; i++) {
      const a = spotBoxes[i];
      const b = spotBoxes[i + 1];
      const isSameRow = Math.abs(a.cy - b.cy) < Math.min(a.height, b.height) * 0.75;

      if (isSameRow) {
        const vOffset = 54;
        const isLtr = a.cx < b.cx;
        const startX = isLtr ? a.right : a.x;
        const startY = a.cy - vOffset;
        const endX = isLtr ? b.x : b.right;
        const endY = b.cy + vOffset;
        dots.push({ x: startX, y: startY, isEnd: false });
        const dx = endX - startX;
        const cp1X = startX + dx * 0.45;
        const cp1Y = startY;
        const cp2X = endX - dx * 0.45;
        const cp2Y = endY;
        const segment = {
          d: ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`,
          y1: startY,
          y2: endY,
        };
        if (destinationIndex !== -1 && i >= destinationIndex) rueckwegSegments.push(segment);
        else hinwegSegments.push(segment);
        dots.push({ x: endX, y: endY, isEnd: true });
      } else {
        const hOffset = 32;
        const startX = a.cx - hOffset;
        const startY = a.bottom;
        const endX = b.cx + hOffset;
        const endY = b.top;
        dots.push({ x: startX, y: startY, isEnd: false });
        const dy = endY - startY;
        const cp1X = startX;
        const cp1Y = startY + dy * 0.45;
        const cp2X = endX;
        const cp2Y = endY - dy * 0.45;
        const segment = {
          d: ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`,
          y1: startY,
          y2: endY,
        };
        if (destinationIndex !== -1 && i >= destinationIndex) rueckwegSegments.push(segment);
        else hinwegSegments.push(segment);
        dots.push({ x: endX, y: endY, isEnd: true });
      }
    }

    if (excursion && spotBoxes.length > 0) {
      const domSpotIds = spotEls.map((el) => Number(el.dataset.spotId));
      const loops = buildLoopSegments(excursion.spot_ids, domSpotIds);
      for (const [fromIdx, toIdx] of loops) {
        const a = spotBoxes[fromIdx];
        const b = spotBoxes[toIdx];
        if (!a || !b) continue;
        const loop = computeTourLoopPath(a, b, spotBoxes, wrapEl.clientWidth);
        const segment = {
          d: loop.d,
          y1: loop.dots[0].y,
          y2: loop.dots[1].y,
        };
        if (destinationIndex !== -1 && fromIdx >= destinationIndex) rueckwegSegments.push(segment);
        else hinwegSegments.push(segment);
        dots.push({ x: loop.dots[0].x, y: loop.dots[0].y, isEnd: false });
        dots.push({ x: loop.dots[1].x, y: loop.dots[1].y, isEnd: true });
      }
    }

    function combineSegments(segs: { d: string; y1: number; y2: number }[]) {
      if (segs.length === 0) return null;
      return {
        d: segs.map((s) => s.d).join(' '),
        y1: segs[0].y1,
        y2: segs[segs.length - 1].y2,
      };
    }

    tourLines.set(excursionId, {
      width: wrapEl.scrollWidth,
      height: wrapEl.scrollHeight,
      hinwegPath: combineSegments(hinwegSegments),
      rueckwegPath: combineSegments(rueckwegSegments),
      dots,
    });
  }

  function setTourWrapRef(excursionId: number, el: Element | ComponentPublicInstance | null) {
    const domEl = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null);
    const previous = tourWrapRefs.get(excursionId);
    if (domEl === previous) return;
    if (previous) {
      tourLineResizeObserver?.unobserve(previous);
    }
    if (domEl instanceof HTMLElement) {
      tourWrapRefs.set(excursionId, domEl);
      tourLineResizeObserver?.observe(domEl);
      const initialWidth = Math.round(domEl.clientWidth);
      if (tourWrapWidths.get(excursionId) !== initialWidth) {
        tourWrapWidths.set(excursionId, initialWidth);
      }
      nextTick(() => recomputeTourLine(excursionId));
    } else {
      tourWrapRefs.delete(excursionId);
      tourWrapWidths.delete(excursionId);
      tourLines.delete(excursionId);
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      tourLineResizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const id = [...tourWrapRefs.entries()].find(([, el]) => el === entry.target)?.[0];
          if (id != null) {
            const wrapEl = tourWrapRefs.get(id);
            if (wrapEl) {
              const newWidth = Math.round(wrapEl.clientWidth);
              if (tourWrapWidths.get(id) !== newWidth) {
                tourWrapWidths.set(id, newWidth);
                nextTick(() => recomputeTourLine(id));
              }
            }
            recomputeTourLine(id);
          }
        }
      });
      for (const [_id, el] of tourWrapRefs) {
        tourLineResizeObserver.observe(el);
      }
    });

    onUnmounted(() => tourLineResizeObserver?.disconnect());
  }

  const editingCardLeg = ref<{
    excursion: Excursion;
    fromSpot: Spot;
    toSpot: Spot;
    leg: ExcursionLeg;
  } | null>(null);
  const showCardLegModal = ref(false);

  function openCardLegModal(excursion: Excursion, fromSpot: Spot, toSpot: Spot) {
    const existing = getTourLeg(excursion, fromSpot.id, toSpot.id);
    const leg: ExcursionLeg = existing
      ? { ...existing }
      : {
          from_spot_id: fromSpot.id,
          to_spot_id: toSpot.id,
          position: 0,
        };
    editingCardLeg.value = { excursion, fromSpot, toSpot, leg };
    showCardLegModal.value = true;
  }

  async function onSaveCardLeg(savedLeg: ExcursionLeg) {
    if (!editingCardLeg.value) return;
    const exc = editingCardLeg.value.excursion;
    const nextLegs = [...(exc.legs || [])];
    const idx = nextLegs.findIndex(
      (l) => l.from_spot_id === savedLeg.from_spot_id && l.to_spot_id === savedLeg.to_spot_id
    );
    if (idx !== -1) {
      nextLegs[idx] = savedLeg;
    } else {
      nextLegs.push(savedLeg);
    }
    await excursionsStore.update(exc.id, {
      title: exc.title,
      image_url: exc.image_url ?? undefined,
      note: exc.note ?? undefined,
      date: exc.date ?? undefined,
      spot_ids: exc.spot_ids,
      legs: nextLegs,
      role: exc.role,
      transport_type: exc.transport_type,
      departure_time: exc.departure_time,
      arrival_time: exc.arrival_time,
      checkin_info: exc.checkin_info,
      amount: exc.amount,
      paid_by_user_id: exc.paid_by_user_id,
      luggage: exc.luggage,
      seat: exc.seat,
      ticket_link: exc.ticket_link,
    });
    showCardLegModal.value = false;
    editingCardLeg.value = null;
    nextTick(() => recomputeTourLine(exc.id));
  }

  async function onDeleteCardLeg() {
    if (!editingCardLeg.value) return;
    const exc = editingCardLeg.value.excursion;
    const fromId = editingCardLeg.value.fromSpot.id;
    const toId = editingCardLeg.value.toSpot.id;
    const nextLegs = (exc.legs || []).filter(
      (l) => !(l.from_spot_id === fromId && l.to_spot_id === toId)
    );
    await excursionsStore.update(exc.id, {
      title: exc.title,
      image_url: exc.image_url ?? undefined,
      note: exc.note ?? undefined,
      date: exc.date ?? undefined,
      spot_ids: exc.spot_ids,
      legs: nextLegs,
      role: exc.role,
      transport_type: exc.transport_type,
      departure_time: exc.departure_time,
      arrival_time: exc.arrival_time,
      checkin_info: exc.checkin_info,
      amount: exc.amount,
      paid_by_user_id: exc.paid_by_user_id,
      luggage: exc.luggage,
      seat: exc.seat,
      ticket_link: exc.ticket_link,
    });
    showCardLegModal.value = false;
    editingCardLeg.value = null;
    nextTick(() => recomputeTourLine(exc.id));
  }

  if (options.spotGroups) {
    watch(options.spotGroups, () =>
      nextTick(() => {
        for (const id of tourWrapRefs.keys()) recomputeTourLine(id);
      })
    );
  }

  return {
    tourLines,
    tourWrapRefs,
    tourWrapWidths,
    getTourCols,
    getTourRows,
    getTourLeg,
    getLegDuration,
    getLegDurationParts,
    getLegTooltip,
    getTourLayover,
    recomputeTourLine,
    setTourWrapRef,
    editingCardLeg,
    showCardLegModal,
    openCardLegModal,
    onSaveCardLeg,
    onDeleteCardLeg,
  };
}
