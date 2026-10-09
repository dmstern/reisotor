import { getCurrentInstance, onMounted, onUnmounted, ref, type Ref } from 'vue';

export interface UseLandingScrollytellingOptions {
  /** Anzahl der Scrolly-Schritte für die Vorbelegung der Glow-Deckkraft (Standard: 5). */
  stepCount?: number;
  /** DOM-Selektor für die Scrollytelling-Textschritte (Standard: '.scrolly-step'). */
  stepSelector?: string;
  /** DOM-Selektor für scrollanimierte Container (Standard: '.scroll-animate'). */
  scrollSelector?: string;
  /** Vertikaler Faktor für das Sichtfeld-Zentrum (Standard: 0.5 für 50% der Fensterhöhe). */
  viewportCenterRatio?: number;
  /** Maximaler Abstandsfaktor für den Glow-Abfall (Standard: 0.6 für 60% der Fensterhöhe). */
  maxDistRatio?: number;
  /** CSS IntersectionObserver-Optionen für Schritte. */
  observerOptions?: IntersectionObserverInit;
}

export interface UseLandingScrollytellingReturn {
  activeIndex: Ref<number>;
  glowOpacities: Ref<number[]>;
  updateGlow: () => void;
  initObservers: () => void;
  cleanupObservers: () => void;
}

/**
 * Kapselt das Scrollytelling-Verhalten der Landingpage:
 * - Ermittlung des aktiven Scrolly-Schritts per IntersectionObserver (mit Hysterese-Margen)
 * - Dynamische Berechnung von Ambient-Glow-Opazitäten anhand der Scroll-Distanz zum Viewport-Zentrum
 * - Fallback-IntersectionObserver für Browser ohne CSS animation-timeline view() Support
 */
export function useLandingScrollytelling(
  options: UseLandingScrollytellingOptions = {}
): UseLandingScrollytellingReturn {
  const {
    stepCount = 5,
    stepSelector = '.scrolly-step',
    scrollSelector = '.scroll-animate',
    viewportCenterRatio = 0.5,
    maxDistRatio = 0.6,
    observerOptions = {
      rootMargin: '-25% 0px -35% 0px',
      threshold: [0.2, 0.5],
    },
  } = options;

  const activeIndex = ref(0);
  const glowOpacities = ref<number[]>(Array.from({ length: stepCount }, () => 0));

  let stepObserver: IntersectionObserver | null = null;
  let scrollObserver: IntersectionObserver | null = null;

  function updateGlow() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const steps = document.querySelectorAll(stepSelector);
    if (!steps.length) return;

    const viewportCenter = window.innerHeight * viewportCenterRatio;
    const maxDist = window.innerHeight * maxDistRatio;

    const opacities = Array.from(steps).map((step) => {
      const rect = step.getBoundingClientRect();
      const stepCenter = rect.top + rect.height / 2;
      const distance = Math.abs(stepCenter - viewportCenter);
      return Math.max(0, 1 - distance / maxDist);
    });

    glowOpacities.value = opacities;
  }

  function initObservers() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Scrollytelling Step Observer (IntersectionObserver)
    if (typeof IntersectionObserver !== 'undefined') {
      stepObserver?.disconnect();
      stepObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const indexAttr = entry.target.getAttribute('data-index');
            if (indexAttr !== null) {
              activeIndex.value = parseInt(indexAttr, 10);
            }
          }
        });
      }, observerOptions);

      document.querySelectorAll(stepSelector).forEach((el) => {
        stepObserver?.observe(el);
      });
    }

    // 2. Scroll Animation Fallback (für Browser ohne native CSS animation-timeline view())
    const supportsAnimationTimeline =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('(animation-timeline: view()) and (animation-range: 0% 100%)');

    if (!supportsAnimationTimeline && typeof IntersectionObserver !== 'undefined') {
      scrollObserver?.disconnect();
      scrollObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('fallback-visible');
            }
          });
        },
        { threshold: 0.1 }
      );

      document.querySelectorAll(scrollSelector).forEach((el) => {
        scrollObserver?.observe(el);
        el.classList.add('fallback-mode');
      });
    }
  }

  function cleanupObservers() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', updateGlow);
    }
    stepObserver?.disconnect();
    stepObserver = null;
    scrollObserver?.disconnect();
    scrollObserver = null;
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (typeof window !== 'undefined') {
        window.addEventListener('scroll', updateGlow, { passive: true });
        updateGlow();
        initObservers();
      }
    });

    onUnmounted(() => {
      cleanupObservers();
    });
  }

  return {
    activeIndex,
    glowOpacities,
    updateGlow,
    initObservers,
    cleanupObservers,
  };
}
