import { getCurrentInstance, onMounted, onUnmounted, ref, type Ref } from 'vue';

export type RobotPhase = 'pack' | 'idle';

export interface UseLandingRobotOptions {
  /** Intervall in Millisekunden für das wiederholte Packen zur Auflockerung (Standard: 60.000 ms). */
  intervalMs?: number;
  /** Initialer Zustand des Roboters (Standard: 'pack'). */
  initialPhase?: RobotPhase;
  /** Ob das periodische Pack-Intervall automatisch gestartet werden soll (Standard: true). */
  autoStart?: boolean;
}

export interface UseLandingRobotReturn {
  robotPhase: Ref<RobotPhase>;
  onPackingDone: () => void;
  startPacking: () => void;
  startInterval: () => void;
  stopInterval: () => void;
}

/**
 * Kapselt den Animations- und Zustands-Lifecycle des Reisotor-Roboters auf der Landingpage.
 * Der Roboter startet in der Phase 'pack', schaltet nach Ende der Animation auf 'idle'
 * und packt zur Auflockerung in periodischen Abständen (z. B. alle 60 Sekunden) erneut seinen Rucksack.
 */
export function useLandingRobot(options: UseLandingRobotOptions = {}): UseLandingRobotReturn {
  const { intervalMs = 60000, initialPhase = 'pack', autoStart = true } = options;
  const robotPhase = ref<RobotPhase>(initialPhase);
  let packingInterval: ReturnType<typeof setInterval> | null = null;

  function onPackingDone() {
    robotPhase.value = 'idle';
  }

  function startPacking() {
    robotPhase.value = 'pack';
  }

  function startInterval() {
    stopInterval();
    packingInterval = setInterval(() => {
      if (robotPhase.value === 'idle') {
        robotPhase.value = 'pack';
      }
    }, intervalMs);
  }

  function stopInterval() {
    if (packingInterval !== null) {
      clearInterval(packingInterval);
      packingInterval = null;
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      if (autoStart) {
        startInterval();
      }
    });

    onUnmounted(() => {
      stopInterval();
    });
  }

  return {
    robotPhase,
    onPackingDone,
    startPacking,
    startInterval,
    stopInterval,
  };
}
