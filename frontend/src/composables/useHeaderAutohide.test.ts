// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import {
  useHeaderAutohide,
  DEFAULT_SCROLL_DOWN_THRESHOLD_PX,
  DEFAULT_SCROLL_UP_THRESHOLD_PX,
  DEFAULT_TOP_REVEAL_THRESHOLD_PX,
} from './useHeaderAutohide';

describe('useHeaderAutohide', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('innerHeight', 800);
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initialisiert mit isHidden = false', () => {
    const { isHidden } = useHeaderAutohide();
    expect(isHidden.value).toBe(false);
  });

  it('bleibt am oberen Rand (unterhalb topRevealThreshold) sichtbar', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(20);
    expect(isHidden.value).toBe(false);

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    expect(isHidden.value).toBe(false);
  });

  it('versteckt den Header beim Runterscrollen jenseits des Schwellenwerts', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    // Start am oberen Rand
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    expect(isHidden.value).toBe(false);

    // Weniger als Schwellenwert weiter runterscrollen
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + DEFAULT_SCROLL_DOWN_THRESHOLD_PX - 5);
    expect(isHidden.value).toBe(false);

    // Weiter runterscrollen (Kumuliert >= DEFAULT_SCROLL_DOWN_THRESHOLD_PX)
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + DEFAULT_SCROLL_DOWN_THRESHOLD_PX + 5);
    expect(isHidden.value).toBe(true);
  });

  it('blendet den Header beim leichten Hochscrollen sofort wieder ein', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    // Runterscrollen und verstecken
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 50);
    expect(isHidden.value).toBe(true);

    // Leicht hochscrollen (z. B. um DEFAULT_SCROLL_UP_THRESHOLD_PX)
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 50 - DEFAULT_SCROLL_UP_THRESHOLD_PX);
    expect(isHidden.value).toBe(false);
  });

  it('kumuliert mehrere kleine Scroll-Schritte in die gleiche Richtung', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    expect(isHidden.value).toBe(false);

    // Drei kleine Schritte à 6px nach unten (Summe: 18px >= 15px)
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 6);
    expect(isHidden.value).toBe(false);
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 12);
    expect(isHidden.value).toBe(false);
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 18);
    expect(isHidden.value).toBe(true);
  });

  it('setzt den Akkumulator beim Richtungswechsel zurück', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    // 10px runter (< 15px Schwellenwert)
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 10);
    expect(isHidden.value).toBe(false);

    // Richtungswechsel: 2px hoch
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 8);
    expect(isHidden.value).toBe(false);

    // Erneut 8px runter (Gesamt ab Wechsel nur 8px < 15px)
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX + 16);
    expect(isHidden.value).toBe(false);
  });

  it('blendet den Header sofort wieder ein, wenn der Seitenanfang erreicht wird', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(200);
    expect(isHidden.value).toBe(true);

    // Sprung an den Anfang
    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX - 10);
    expect(isHidden.value).toBe(false);
  });

  it('bleibt auf Desktop dauerhaft sichtbar', () => {
    const isDesktop = ref(true);
    const { isHidden, updateScroll } = useHeaderAutohide({ isDesktop });

    updateScroll(100);
    updateScroll(200);
    expect(isHidden.value).toBe(false);
  });

  it('blendet wieder ein, wenn von Mobil auf Desktop umgeschaltet wird', () => {
    const isDesktop = ref(false);
    const { isHidden, updateScroll } = useHeaderAutohide({ isDesktop });

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(150);
    expect(isHidden.value).toBe(true);

    isDesktop.value = true;
    updateScroll(160);
    expect(isHidden.value).toBe(false);
  });

  it('versteckt den Header nicht, wenn :focus-within aktiv ist', () => {
    const mockEl = document.createElement('div');
    vi.spyOn(mockEl, 'matches').mockImplementation((selector) => selector === ':focus-within');

    const headerElement = ref(mockEl);
    const { isHidden, updateScroll } = useHeaderAutohide({ headerElement });

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(120);
    expect(isHidden.value).toBe(false);
  });

  it('versteckt den Header nicht, wenn ein Dropdown per aria-expanded="true" geöffnet ist', () => {
    const mockEl = document.createElement('div');
    const childBtn = document.createElement('button');
    childBtn.setAttribute('aria-expanded', 'true');
    mockEl.appendChild(childBtn);

    const headerElement = ref(mockEl);
    const { isHidden, updateScroll } = useHeaderAutohide({ headerElement });

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(120);
    expect(isHidden.value).toBe(false);
  });

  it('blendet den Header über reveal() wieder ein', () => {
    const { isHidden, reveal, updateScroll } = useHeaderAutohide();

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(120);
    expect(isHidden.value).toBe(true);

    reveal();
    expect(isHidden.value).toBe(false);
  });

  it('ignoriert Rubber-Banding-Überschreitung am unteren Seitenrand', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(DEFAULT_TOP_REVEAL_THRESHOLD_PX);
    updateScroll(100);
    expect(isHidden.value).toBe(true);

    // scrollHeight = 2000, innerHeight = 800 => maxScrollY = 1200
    // Overscroll über das Dokumentende hinaus
    updateScroll(1250);
    // Sollte nicht crashen und keine Fehlinterpretation auslösen
    expect(isHidden.value).toBe(true);
  });
});
