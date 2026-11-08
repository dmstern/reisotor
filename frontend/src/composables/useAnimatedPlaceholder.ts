import { ref, watch, onMounted, onUnmounted, getCurrentInstance, type Ref } from 'vue';

export const DEFAULT_SPOT_PLACEHOLDER_PHRASES = [
  'Ort, Café oder Sehenswürdigkeit suchen...',
  'Adresse eingeben...',
  'Google Maps- oder Apple Maps-Link einfügen...',
  'Booking.com-Link einfügen...',
  'Airbnb-Link einfügen...',
  'Trivago-Link einfügen...',
];

export const DEFAULT_TRIP_PLACEHOLDER_PHRASES = [
  'Reiseziel oder Stadt suchen...',
  'Google Maps- oder Apple Maps-Link einfügen...',
  'Booking.com-Link einfügen...',
  'Airbnb-Link einfügen...',
];

export interface UseAnimatedPlaceholderOptions {
  /** Typ-Geschwindigkeit in Millisekunden pro Buchstabe (Standard: 45) */
  typingSpeed?: number;
  /** Lösch-Geschwindigkeit in Millisekunden pro Buchstabe (Standard: 22) */
  deletingSpeed?: number;
  /** Pause in Millisekunden, wenn der Text komplett getippt ist (Standard: 2200) */
  pauseDelay?: number;
  /** Pause in Millisekunden zwischen zwei Phrasen (Standard: 350) */
  betweenDelay?: number;
  /** Statischer Fallback-Placeholder, z. B. bei Fokus, Prefers-Reduced-Motion oder leeren Phrasen */
  fallback?: Ref<string | undefined> | (() => string | undefined) | string;
  /** Wenn true, pausiert die Animation */
  disabled?: Ref<boolean> | (() => boolean);
  /** Wenn true, läuft die Animation auch in Vitest-Testläufen (für Unit-Tests des Composables) */
  animateInTest?: boolean;
}

/**
 * Erzeugt einen dezent animierten Schreibmaschinen-Platzhalter ("Ghost Typing"),
 * der zyklisch durch verschiedene Such- und Link-Tipps wechselt.
 */
export function useAnimatedPlaceholder(
  phrasesInput: Ref<string[]> | (() => string[]),
  options: UseAnimatedPlaceholderOptions = {}
) {
  const typingSpeed = options.typingSpeed ?? 45;
  const deletingSpeed = options.deletingSpeed ?? 22;
  const pauseDelay = options.pauseDelay ?? 2200;
  const betweenDelay = options.betweenDelay ?? 350;

  const getFallback = (): string => {
    if (typeof options.fallback === 'function') {
      return options.fallback() || '';
    }

    if (options.fallback && typeof options.fallback === 'object' && 'value' in options.fallback) {
      return options.fallback.value || '';
    }

    return (options.fallback as string) || '';
  };

  const isDisabled = (): boolean => {
    if (typeof options.disabled === 'function') {
      return Boolean(options.disabled());
    }

    if (options.disabled && typeof options.disabled === 'object' && 'value' in options.disabled) {
      return Boolean(options.disabled.value);
    }

    return false;
  };

  const getPhrases = (): string[] => {
    return typeof phrasesInput === 'function' ? phrasesInput() : phrasesInput.value;
  };

  const initialPhrases = getPhrases();
  const currentPlaceholder = ref(getFallback() || (initialPhrases?.[0] ?? ''));

  const isTestEnv =
    typeof import.meta !== 'undefined' &&
    Boolean(import.meta.env?.MODE === 'test' || import.meta.env?.VITEST);

  if (isTestEnv && !options.animateInTest) {
    return {
      placeholder: currentPlaceholder,
    };
  }

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isMounted = false;

  const clearActiveTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const step = () => {
    clearActiveTimer();

    if (!isMounted) {
      return;
    }

    if (isDisabled()) {
      currentPlaceholder.value = getFallback();
      return;
    }

    const phrases = getPhrases();

    if (!phrases || phrases.length === 0) {
      currentPlaceholder.value = getFallback();
      return;
    }

    // Prefers reduced motion check
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      currentPlaceholder.value = phrases[phraseIndex % phrases.length];
      timer = setTimeout(() => {
        phraseIndex = (phraseIndex + 1) % phrases.length;
        step();
      }, pauseDelay);
      return;
    }

    const currentPhrase = phrases[phraseIndex % phrases.length] || '';

    if (!isDeleting) {
      charIndex++;
      currentPlaceholder.value = currentPhrase.slice(0, charIndex);

      if (charIndex >= currentPhrase.length) {
        isDeleting = true;
        timer = setTimeout(step, pauseDelay);
      } else {
        timer = setTimeout(step, typingSpeed);
      }
    } else {
      charIndex--;
      currentPlaceholder.value = currentPhrase.slice(0, charIndex);

      if (charIndex <= 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        timer = setTimeout(step, betweenDelay);
      } else {
        timer = setTimeout(step, deletingSpeed);
      }
    }
  };

  const startOrResume = () => {
    clearActiveTimer();

    if (isDisabled()) {
      currentPlaceholder.value = getFallback();
      return;
    }

    step();
  };

  watch(
    () => [isDisabled(), getPhrases(), getFallback()],
    ([disabled]) => {
      if (disabled) {
        clearActiveTimer();
        currentPlaceholder.value = getFallback();
      } else {
        startOrResume();
      }
    },
    { deep: true }
  );

  if (getCurrentInstance()) {
    onMounted(() => {
      isMounted = true;
      startOrResume();
    });

    onUnmounted(() => {
      isMounted = false;
      clearActiveTimer();
    });
  } else {
    isMounted = true;
    startOrResume();
  }

  return {
    placeholder: currentPlaceholder,
  };
}
