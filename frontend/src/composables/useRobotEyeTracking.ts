import {
  ref,
  watch,
  toValue,
  onMounted,
  onUnmounted,
  getCurrentInstance,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

export type RobotPhase = 'idle' | 'scanning' | 'done' | 'packing' | 'pack';

export interface UseRobotEyeTrackingOptions {
  /** Ob interaktives Augen-Tracking aktiviert ist */
  interactive?: MaybeRefOrGetter<boolean | undefined>;
  /** Ob sich der Roboter die Augen zuhält */
  coveringEyes?: MaybeRefOrGetter<boolean | undefined>;
  /** Aktuelle Phase des Roboters */
  phase?: MaybeRefOrGetter<RobotPhase | undefined>;
  /** Maximale Pixel-Verschiebung der Pupille im lokalen SVG-Koordinatensystem (Standard: 130) */
  maxShift?: number;
  /** Optionales Window-Objekt zur Entkopplung in Tests/SSR */
  windowObj?: Window | null;
}

export interface UseRobotEyeTrackingReturn {
  pupilOffset: Ref<{ x: number; y: number }>;
  onMouseMove: (e: MouseEvent) => void;
  resetPupilOffset: () => void;
}

/**
 * Kapselt das Maus-Tracking für die interaktiven Kamera-Linsen des Reisotor-Roboters.
 * Berechnet die relative Verschiebung der Pupillen innerhalb der kreisrunden Linsen
 * und kappt Vektoren, damit die Pupillen auch in Bildschirm-Ecken nicht clippen.
 */
export function useRobotEyeTracking(
  options: UseRobotEyeTrackingOptions = {}
): UseRobotEyeTrackingReturn {
  const { maxShift = 130 } = options;
  const pupilOffset = ref({ x: 0, y: 0 });

  function canTrack(): boolean {
    const isInteractive = Boolean(toValue(options.interactive));
    const isCoveringEyes = Boolean(toValue(options.coveringEyes));
    const currentPhase = toValue(options.phase) ?? 'idle';

    return (
      isInteractive && !isCoveringEyes && currentPhase !== 'scanning' && currentPhase !== 'done'
    );
  }

  function resetPupilOffset() {
    pupilOffset.value = { x: 0, y: 0 };
  }

  function onMouseMove(e: MouseEvent) {
    if (!canTrack()) {
      resetPupilOffset();
      return;
    }

    const win = options.windowObj ?? (typeof window !== 'undefined' ? window : null);
    const winWidth = win?.innerWidth || 1;
    const winHeight = win?.innerHeight || 1;

    // Relative Position zur Bildschirmmitte (-1 bis +1)
    let rx = (e.clientX / winWidth - 0.5) * 2;
    let ry = (e.clientY / winHeight - 0.5) * 2;

    // Vektor-Länge kappen, damit die Pupillen in den Bildschirmecken (rx=1, ry=1 -> Länge 1.41)
    // nicht aus der runden Linse (Radius-Limit) herausrutschen!
    const dist = Math.sqrt(rx * rx + ry * ry);
    if (dist > 1) {
      rx /= dist;
      ry /= dist;
    }

    pupilOffset.value = {
      x: rx * maxShift,
      y: ry * maxShift,
    };
  }

  // Reaktive Zustandsänderungen beobachten und Pupille bei Deaktivierung sofort zentrieren
  watch(
    () => [toValue(options.interactive), toValue(options.coveringEyes), toValue(options.phase)],
    () => {
      if (!canTrack() && (pupilOffset.value.x !== 0 || pupilOffset.value.y !== 0)) {
        resetPupilOffset();
      }
    }
  );

  if (getCurrentInstance()) {
    onMounted(() => {
      const win = options.windowObj ?? (typeof window !== 'undefined' ? window : null);
      win?.addEventListener('mousemove', onMouseMove);
    });

    onUnmounted(() => {
      const win = options.windowObj ?? (typeof window !== 'undefined' ? window : null);
      win?.removeEventListener('mousemove', onMouseMove);
    });
  }

  return {
    pupilOffset,
    onMouseMove,
    resetPupilOffset,
  };
}
