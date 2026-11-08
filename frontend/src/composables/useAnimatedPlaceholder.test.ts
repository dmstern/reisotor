import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useAnimatedPlaceholder } from './useAnimatedPlaceholder';

describe('useAnimatedPlaceholder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts ghost typing and progresses letter by letter', () => {
    const phrases = ref(['Ort suchen...']);
    const { placeholder } = useAnimatedPlaceholder(phrases, {
      typingSpeed: 10,
      animateInTest: true,
    });

    expect(placeholder.value).toBe('O');

    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('Or');

    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('Ort');

    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('Ort ');
  });

  it('cycles through multiple phrases', () => {
    const phrases = ref(['Hi', 'Bye']);
    const { placeholder } = useAnimatedPlaceholder(phrases, {
      typingSpeed: 10,
      deletingSpeed: 10,
      pauseDelay: 50,
      betweenDelay: 20,
      animateInTest: true,
    });

    // Start with H -> Hi
    expect(placeholder.value).toBe('H');
    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('Hi');

    // Pause delay
    vi.advanceTimersByTime(50);
    // Deleting H
    expect(placeholder.value).toBe('H');
    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('');

    // Between delay
    vi.advanceTimersByTime(20);
    // Next phrase "Bye": B -> By -> Bye
    expect(placeholder.value).toBe('B');
    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('By');
    vi.advanceTimersByTime(10);
    expect(placeholder.value).toBe('Bye');
  });

  it('shows fallback when disabled', () => {
    const phrases = ref(['Ort suchen...', 'Booking-Link einfügen...']);
    const isDisabled = ref(true);

    const { placeholder } = useAnimatedPlaceholder(phrases, {
      fallback: 'Fokussierter Platzhalter...',
      disabled: isDisabled,
    });

    expect(placeholder.value).toBe('Fokussierter Platzhalter...');
  });
});
