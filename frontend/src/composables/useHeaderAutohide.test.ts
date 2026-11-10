// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import {
  useHeaderAutohide,
  DEFAULT_HEADER_HEIGHT_PX,
  DEFAULT_SCROLL_DOWN_THRESHOLD_PX,
  DEFAULT_SCROLL_UP_THRESHOLD_PX,
  TOP_SCROLL_REST_EPSILON_PX,
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

  it('initialisiert mit isHidden = false, isScrollingTop = false und topScrollOffset = 0', () => {
    const { isHidden, isScrollingTop, topScrollOffset } = useHeaderAutohide();

    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(false);
    expect(topScrollOffset.value).toBe(0);
  });

  it('scrollt am oberen Rand 1:1 mit dem Inhalt mit (isScrollingTop = true, topScrollOffset = scrollY)', () => {
    const { isHidden, isScrollingTop, topScrollOffset, updateScroll } = useHeaderAutohide();

    // Scroll um 20px nach unten (innerhalb der Standard-Header-Höhe 56px)
    updateScroll(20);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(true);
    expect(topScrollOffset.value).toBe(20);

    // Weiter nach unten auf 45px
    updateScroll(45);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(true);
    expect(topScrollOffset.value).toBe(45);

    // Leichtes Zurückscrollen nach oben (auf 15px) wandert 1:1 mit zurück
    updateScroll(15);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(true);
    expect(topScrollOffset.value).toBe(15);

    // Ganz am oberen Rand (0px) schaltet in den Ruhezustand
    updateScroll(0);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(false);
    expect(topScrollOffset.value).toBe(0);
  });

  it('versteckt den Header, sobald die Header-Höhe komplett durchscrollt wurde', () => {
    const { isHidden, isScrollingTop, topScrollOffset, updateScroll } = useHeaderAutohide({
      headerHeight: 100,
    });

    // Innerhalb der Header-Höhe wandert der Header mit
    updateScroll(80);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(true);
    expect(topScrollOffset.value).toBe(80);

    // Sobald >= 100px erreicht werden, schaltet er in den versteckten Zustand
    updateScroll(100);
    expect(isHidden.value).toBe(true);
    expect(isScrollingTop.value).toBe(false);
    expect(topScrollOffset.value).toBe(0);
  });

  it('verwendet die dynamisch gemessene Höhe von headerElement', () => {
    const mockEl = document.createElement('header');
    vi.spyOn(mockEl, 'getBoundingClientRect').mockReturnValue({
      height: 110,
      width: 400,
      top: 0,
      bottom: 110,
      left: 0,
      right: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const headerElement = ref(mockEl);
    const { isHidden, isScrollingTop, topScrollOffset, updateScroll } = useHeaderAutohide({
      headerElement,
    });

    // Bei 90px (< 110px) scrollt der Header noch mit
    updateScroll(90);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(true);
    expect(topScrollOffset.value).toBe(90);

    // Bei 110px ist er komplett verschwunden
    updateScroll(110);
    expect(isHidden.value).toBe(true);
    expect(isScrollingTop.value).toBe(false);
  });

  it('blendet den Header jenseits der Kopfzeile beim Hochscrollen sanft ein', () => {
    const { isHidden, isScrollingTop, updateScroll } = useHeaderAutohide();

    // Weit nach unten scrollen
    updateScroll(DEFAULT_HEADER_HEIGHT_PX + 10);
    updateScroll(200);
    expect(isHidden.value).toBe(true);
    expect(isScrollingTop.value).toBe(false);

    // Leicht hochscrollen (Delta >= DEFAULT_SCROLL_UP_THRESHOLD_PX)
    updateScroll(200 - DEFAULT_SCROLL_UP_THRESHOLD_PX);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(false);
  });

  it('blendet den Header beim erneuten Runterscrollen wieder aus', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(200);
    expect(isHidden.value).toBe(true);

    // Hochscrollen -> blendet ein
    updateScroll(190);
    expect(isHidden.value).toBe(false);

    // Weniger als Schwellenwert runterscrollen
    updateScroll(190 + DEFAULT_SCROLL_DOWN_THRESHOLD_PX - 5);
    expect(isHidden.value).toBe(false);

    // Voller Schwellenwert runterscrollen -> blendet wieder aus
    updateScroll(190 + DEFAULT_SCROLL_DOWN_THRESHOLD_PX);
    expect(isHidden.value).toBe(true);
  });

  it('kumuliert mehrere kleine Scroll-Schritte in die gleiche Richtung', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(200);
    expect(isHidden.value).toBe(true);

    // Zwei kleine Schritte à 5px nach oben (Summe: 10px >= DEFAULT_SCROLL_UP_THRESHOLD_PX = 8px)
    updateScroll(195);
    expect(isHidden.value).toBe(true);
    updateScroll(190);
    expect(isHidden.value).toBe(false);
  });

  it('setzt den Akkumulator beim Richtungswechsel zurück', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(200);
    expect(isHidden.value).toBe(true);

    // 5px hoch (< 8px Schwellenwert)
    updateScroll(195);
    expect(isHidden.value).toBe(true);

    // Richtungswechsel: 2px runter
    updateScroll(197);
    expect(isHidden.value).toBe(true);

    // Erneut 5px hoch (Gesamt ab Wechsel nur 5px < 8px)
    updateScroll(192);
    expect(isHidden.value).toBe(true);
  });

  it('blendet den Header sofort wieder ein und setzt zurück, wenn der Seitenanfang erreicht wird', () => {
    const { isHidden, isScrollingTop, topScrollOffset, updateScroll } = useHeaderAutohide();

    updateScroll(300);
    expect(isHidden.value).toBe(true);

    // Sprung an den Anfang
    updateScroll(TOP_SCROLL_REST_EPSILON_PX);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(false);
    expect(topScrollOffset.value).toBe(0);
  });

  it('bleibt auf Desktop dauerhaft sichtbar', () => {
    const isDesktop = ref(true);
    const { isHidden, isScrollingTop, updateScroll } = useHeaderAutohide({ isDesktop });

    updateScroll(100);
    updateScroll(200);
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(false);
  });

  it('blendet wieder ein, wenn von Mobil auf Desktop umgeschaltet wird', () => {
    const isDesktop = ref(false);
    const { isHidden, updateScroll } = useHeaderAutohide({ isDesktop });

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

    updateScroll(120);
    expect(isHidden.value).toBe(false);
  });

  it('blendet den Header über reveal() wieder ein und setzt Offsets zurück', () => {
    const { isHidden, isScrollingTop, topScrollOffset, reveal, updateScroll } = useHeaderAutohide();

    updateScroll(20);
    expect(isScrollingTop.value).toBe(true);

    reveal();
    expect(isHidden.value).toBe(false);
    expect(isScrollingTop.value).toBe(false);
    expect(topScrollOffset.value).toBe(0);
  });

  it('ignoriert Rubber-Banding-Überschreitung am unteren Seitenrand', () => {
    const { isHidden, updateScroll } = useHeaderAutohide();

    updateScroll(100);
    expect(isHidden.value).toBe(true);

    // scrollHeight = 2000, innerHeight = 800 => maxScrollY = 1200
    // Overscroll über das Dokumentende hinaus
    updateScroll(1250);
    expect(isHidden.value).toBe(true);
  });
});
