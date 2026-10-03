import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import { useScrollFade } from './useScrollFade';

interface MockScrollElement {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

describe('useScrollFade', () => {
  let mockElement: MockScrollElement;

  beforeEach(() => {
    mockElement = {
      scrollTop: 0,
      clientHeight: 200,
      scrollHeight: 600,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('berechnet canScrollUp und canScrollDown korrekt am Anfang, in der Mitte und am Ende', () => {
    const elRef = ref(mockElement as unknown as HTMLElement);
    const { canScrollUp, canScrollDown, updateScrollFade } = useScrollFade(elRef);

    // Am oberen Rand: Scroll nach oben unmöglich, nach unten möglich
    updateScrollFade();
    expect(canScrollUp.value).toBe(false);
    expect(canScrollDown.value).toBe(true);

    // Mitten im Inhalt: Scroll in beide Richtungen möglich
    mockElement.scrollTop = 150;
    updateScrollFade();
    expect(canScrollUp.value).toBe(true);
    expect(canScrollDown.value).toBe(true);

    // Am unteren Rand angekommen: Scroll nach oben möglich, nach unten nicht mehr
    mockElement.scrollTop = 400; // 400 + 200 = 600 = scrollHeight
    updateScrollFade();
    expect(canScrollUp.value).toBe(true);
    expect(canScrollDown.value).toBe(false);
  });

  it('gibt false für beide zurück, wenn der Inhalt nicht überläuft', () => {
    mockElement.clientHeight = 300;
    mockElement.scrollHeight = 250;
    mockElement.scrollTop = 0;

    const elRef = ref(mockElement as unknown as HTMLElement);
    const { canScrollUp, canScrollDown, updateScrollFade } = useScrollFade(elRef);

    updateScrollFade();
    expect(canScrollUp.value).toBe(false);
    expect(canScrollDown.value).toBe(false);
  });

  it('behandelt null-Container sicher und ohne Fehler', () => {
    const elRef = ref<HTMLElement | null>(null);
    const { canScrollUp, canScrollDown, updateScrollFade } = useScrollFade(elRef);

    updateScrollFade();
    expect(canScrollUp.value).toBe(false);
    expect(canScrollDown.value).toBe(false);
  });

  it('berücksichtigt einen benutzerdefinierten Toleranz-Schwellenwert', () => {
    mockElement.scrollTop = 5;
    mockElement.clientHeight = 100;
    mockElement.scrollHeight = 300;

    const elRef = ref(mockElement as unknown as HTMLElement);
    // Mit Toleranz 10 sollte scrollTop: 5 noch als oberer Rand gewertet werden
    const { canScrollUp, updateScrollFade } = useScrollFade(elRef, { tolerance: 10 });

    updateScrollFade();
    expect(canScrollUp.value).toBe(false);

    mockElement.scrollTop = 15;
    updateScrollFade();
    expect(canScrollUp.value).toBe(true);
  });
});
