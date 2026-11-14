// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref, nextTick, type Ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useExcursionsLayout } from './useExcursionsLayout';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function createPointerEvent(
  type: string,
  options: {
    pointerId?: number;
    pointerType?: string;
    button?: number;
    clientY?: number;
    target?: EventTarget;
  } = {}
): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as unknown as PointerEvent;
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: options.pointerType ?? 'touch' });
  Object.defineProperty(event, 'button', { value: options.button ?? 0 });
  Object.defineProperty(event, 'clientY', { value: options.clientY ?? 400 });

  if (options.target) {
    Object.defineProperty(event, 'target', { value: options.target });
  }

  return event;
}

describe('useExcursionsLayout - drawer swipe gestures and click suppression (#755)', () => {
  let isDesktop: Ref<boolean>;
  let tripMapRef: Ref<any>;

  beforeEach(() => {
    setActivePinia(createPinia());
    isDesktop = ref(false);
    tripMapRef = ref(null);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cycles sheet state when tapping on a non-interactive header element', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });
    expect(layout.sheetState.value).toBe('partial');

    const handleEl = document.createElement('div');
    handleEl.className = 'sheet-handle';

    const downEvent = createPointerEvent('pointerdown', {
      clientY: 300,
      target: handleEl,
    });
    layout.onSheetDragStart(downEvent);

    const upEvent = createPointerEvent('pointerup', {
      clientY: 302, // 2px delta < 8px threshold
      target: handleEl,
    });
    window.dispatchEvent(upEvent);
    await nextTick();

    // Partial -> Full
    expect(layout.sheetState.value).toBe('full');
    expect(layout.sheetDragging.value).toBe(false);
  });

  it('does NOT cycle sheet state on tap over a button and allows native click', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });
    expect(layout.sheetState.value).toBe('partial');

    const buttonEl = document.createElement('button');
    buttonEl.className = 'sheet-step-btn';
    document.body.appendChild(buttonEl);

    let buttonClicked = false;
    buttonEl.addEventListener('click', () => {
      buttonClicked = true;
    });

    const downEvent = createPointerEvent('pointerdown', {
      clientY: 300,
      target: buttonEl,
    });
    layout.onSheetDragStart(downEvent);

    const upEvent = createPointerEvent('pointerup', {
      clientY: 303, // 3px delta < 8px threshold
      target: buttonEl,
    });
    window.dispatchEvent(upEvent);
    await nextTick();

    // State did not change from tap on button
    expect(layout.sheetState.value).toBe('partial');
    expect(layout.sheetDragging.value).toBe(false);

    // Native click fires and is NOT suppressed
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    buttonEl.dispatchEvent(clickEvent);
    expect(buttonClicked).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(false);

    document.body.removeChild(buttonEl);
  });

  it('drags sheet when swiping vertically > 8px over a button and suppresses subsequent click', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });
    expect(layout.sheetState.value).toBe('partial');

    const mockSheetEl = document.createElement('div');
    layout.sheetEl.value = mockSheetEl;

    const buttonEl = document.createElement('button');
    document.body.appendChild(buttonEl);

    let buttonClicked = false;
    buttonEl.addEventListener('click', () => {
      buttonClicked = true;
    });

    const downEvent = createPointerEvent('pointerdown', {
      clientY: 400,
      target: buttonEl,
    });
    layout.onSheetDragStart(downEvent);

    // Move 15px upwards (towards full)
    const moveEvent = createPointerEvent('pointermove', {
      clientY: 385,
      target: buttonEl,
    });
    window.dispatchEvent(moveEvent);

    expect(layout.sheetDragging.value).toBe(true);
    expect(layout.sheetDragHeightPx.value).toBeGreaterThan(0);

    // Move further up towards full (e.g. 250px up)
    const moveEvent2 = createPointerEvent('pointermove', {
      clientY: 150,
      target: buttonEl,
    });
    window.dispatchEvent(moveEvent2);

    const upEvent = createPointerEvent('pointerup', {
      clientY: 150,
      target: buttonEl,
    });
    window.dispatchEvent(upEvent);
    await nextTick();

    // Sheet transitioned to full
    expect(layout.sheetState.value).toBe('full');
    expect(layout.sheetDragging.value).toBe(false);

    // Click event should be suppressed by suppressNextClick()
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    buttonEl.dispatchEvent(clickEvent);
    expect(buttonClicked).toBe(false);
    expect(clickEvent.defaultPrevented).toBe(true);

    document.body.removeChild(buttonEl);
  });

  it('supports swipe-up gesture starting from body controls in partial state', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });
    expect(layout.sheetState.value).toBe('partial');

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'segmented-option';
    document.body.appendChild(toggleBtn);

    const downEvent = createPointerEvent('pointerdown', {
      clientY: 450,
      target: toggleBtn,
    });
    layout.onSheetBodyPointerDown(downEvent);

    // Drag up 200px
    const moveEvent = createPointerEvent('pointermove', {
      clientY: 250,
      target: toggleBtn,
    });
    window.dispatchEvent(moveEvent);

    expect(layout.sheetDragging.value).toBe(true);

    const upEvent = createPointerEvent('pointerup', {
      clientY: 250,
      target: toggleBtn,
    });
    window.dispatchEvent(upEvent);
    await nextTick();

    expect(layout.sheetState.value).toBe('full');
    document.body.removeChild(toggleBtn);
  });

  it('transitions to full on rapid upward flick over a control', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });
    expect(layout.sheetState.value).toBe('partial');

    const buttonEl = document.createElement('button');
    document.body.appendChild(buttonEl);

    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(1000);

    const downEvent = createPointerEvent('pointerdown', {
      clientY: 400,
      target: buttonEl,
    });
    layout.onSheetDragStart(downEvent);

    nowSpy.mockReturnValue(1030); // 30ms later
    const moveEvent = createPointerEvent('pointermove', {
      clientY: 380, // moved 20px in 30ms -> velocity = -0.66 px/ms (< -0.35 threshold)
      target: buttonEl,
    });
    window.dispatchEvent(moveEvent);

    const upEvent = createPointerEvent('pointerup', {
      clientY: 380,
      target: buttonEl,
    });
    window.dispatchEvent(upEvent);
    await nextTick();

    // High upward velocity snaps to next state ('full')
    expect(layout.sheetState.value).toBe('full');
    document.body.removeChild(buttonEl);
  });

  it('ignores non-primary pointer down and text input fields', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });

    // Non-primary button (right click)
    const rightClickEvent = createPointerEvent('pointerdown', {
      button: 2,
    });
    layout.onSheetDragStart(rightClickEvent);
    expect(layout.sheetDragging.value).toBe(false);

    // Text input
    const inputEl = document.createElement('input');
    const inputDownEvent = createPointerEvent('pointerdown', {
      target: inputEl,
    });
    layout.onSheetDragStart(inputDownEvent);
    expect(layout.sheetDragging.value).toBe(false);
  });

  it('does not initiate body drag when sheetState is already full', async () => {
    const layout = useExcursionsLayout({ isDesktop, tripMapRef });
    layout.sheetState.value = 'full';

    const bodyEl = document.createElement('div');
    const downEvent = createPointerEvent('pointerdown', {
      clientY: 400,
      target: bodyEl,
    });
    layout.onSheetBodyPointerDown(downEvent);

    const moveEvent = createPointerEvent('pointermove', {
      clientY: 300,
    });
    window.dispatchEvent(moveEvent);

    expect(layout.sheetDragging.value).toBe(false);
  });
});
