import { onUnmounted, ref } from 'vue';

// Eigene Pointer-Events-basierte Drag-Erkennung statt nativem HTML5 draggable/dragstart: natives
// HTML5-DnD feuert auf Android Chrome über Touch i. d. R. gar nicht und ist auf iOS Safari nur
// eingeschränkt unterstützt. Funktioniert dadurch identisch für Maus, Touch und Stift (ein
// Code-Pfad, wie schon bei Drawer.vue's Anfasser). Da hierbei kein natives dataTransfer existiert,
// wird das Ziel beim Loslassen per document.elementFromPoint() ermittelt statt über dragover/drop.
export interface PointerDragOptions {
  /** Wird einmalig beim Überschreiten des Bewegungs-Schwellwerts aufgerufen (Start des Drags). */
  onStart?: () => void;
  /** Wird beim Loslassen nach einem echten Drag aufgerufen – targetEl ist das Element unter dem
   *  Zeiger (per elementFromPoint), null falls außerhalb des Viewports losgelassen wurde. */
  onDrop: (targetEl: Element | null, event: PointerEvent) => void;
  /** Wird beim Loslassen nach einem reinen Tap (Bewegung unter dem Schwellwert) statt onDrop
   *  aufgerufen – ermöglicht Klick-Alternativen zum Drag am selben Anfasser. */
  onTap?: (event: PointerEvent) => void;
  /** Bewegung in px, ab der ein pointerdown als Drag statt als bloßer Tap gilt. */
  threshold?: number;
}

export function usePointerDrag(options: PointerDragOptions) {
  const dragging = ref(false);
  const ghostStyle = ref<{ left: string; top: string } | null>(null);
  const threshold = options.threshold ?? 6;

  let startX = 0;
  let startY = 0;
  let pointerId: number | null = null;
  let moved = false;

  function onPointerMove(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (!moved) {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.hypot(dx, dy) < threshold) return;
      moved = true;
      dragging.value = true;
      options.onStart?.();
    }
    ghostStyle.value = { left: `${event.clientX}px`, top: `${event.clientY}px` };
  }

  function cleanupListeners() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function reset() {
    dragging.value = false;
    ghostStyle.value = null;
    moved = false;
    pointerId = null;
    cleanupListeners();
  }

  function onPointerUp(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    if (moved) {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      options.onDrop(target, event);
    } else {
      options.onTap?.(event);
    }
    reset();
  }

  function onPointerCancel(event: PointerEvent) {
    if (pointerId === null || event.pointerId !== pointerId) return;
    reset();
  }

  function onPointerDown(event: PointerEvent) {
    // Nur den primären Zeiger behandeln (kein Rechtsklick etc.) – bei Touch/Stift ist button bei
    // der ersten Berührung ebenfalls 0, der Check schließt also nur z. B. Rechtsklick mit der Maus aus.
    if (event.button !== 0) return;
    startX = event.clientX;
    startY = event.clientY;
    pointerId = event.pointerId;
    moved = false;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    // Verhindert Textauswahl/Touch-Scrollen während des Drags (gleiches Muster wie Drawer.vue's
    // Größen-Anfasser).
    event.preventDefault();
  }

  onUnmounted(cleanupListeners);

  return { dragging, ghostStyle, onPointerDown };
}
