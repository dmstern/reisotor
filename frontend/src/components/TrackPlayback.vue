<script lang="ts">
import type { LocationTrack, TrackPoint } from '../api/types';

export const SPEEDS = [1, 2, 5, 10] as const;
export type PlaybackSpeed = (typeof SPEEDS)[number];

export interface TrackPlaybackProps {
  track?: LocationTrack | null;
  title?: string | null;
  points: TrackPoint[];
  progress?: number;
  active?: boolean;
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  formatDistanceShort,
  formatDurationShort,
  formatElevationShort,
  formatSpeedShort,
  trackAverageSpeedKmh,
  trackDistanceMeters,
  trackDurationMs,
  trackElevation,
} from '../utils/trackGeometry';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { IconGauge, IconGaugeFilled, IconMountain, IconMountainFilled } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';

const SPEED_ICON: IconDef = {
  id: 'gauge',
  emoji: '⚡',
  outline: IconGauge,
  filled: IconGaugeFilled,
};

const ELEVATION_ICON: IconDef = {
  id: 'mountain',
  emoji: '⛰️',
  outline: IconMountain,
  filled: IconMountainFilled,
};

const props = withDefaults(defineProps<TrackPlaybackProps>(), {
  track: null,
  title: undefined,
  progress: 0,
  active: true,
});

const emit = defineEmits<{
  (e: 'update:progress', value: number): void;
  (e: 'close'): void;
  (e: 'play'): void;
  (e: 'pause'): void;
}>();

const BASE_PLAYBACK_MS = 10_000;

const playing = ref(false);
const speed = ref<PlaybackSpeed>(1);
let rafId: number | null = null;
let lastTickTime = 0;
let currentProgress = props.progress ?? 0;

function stopAnimation() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (playing.value) {
    playing.value = false;
    emit('pause');
  }
}

function tick(now: number) {
  if (!playing.value) return;

  const dt = Math.max(0, now - lastTickTime);
  lastTickTime = now;

  const delta = (dt * speed.value) / BASE_PLAYBACK_MS;
  currentProgress = Math.min(1, currentProgress + delta);
  emit('update:progress', currentProgress);

  if (currentProgress >= 1) {
    stopAnimation();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function togglePlay() {
  if (props.points.length < 2) return;

  if (playing.value) {
    stopAnimation();
    return;
  }

  if ((props.progress ?? 0) >= 1) {
    currentProgress = 0;
    emit('update:progress', 0);
  } else {
    currentProgress = props.progress ?? 0;
  }

  playing.value = true;
  lastTickTime = performance.now();
  emit('play');
  rafId = requestAnimationFrame(tick);
}

function onScrub(event: Event) {
  stopAnimation();
  const raw = Number((event.target as HTMLInputElement).value);
  const val = Math.max(0, Math.min(1, Number.isFinite(raw) ? raw : 0));
  currentProgress = val;
  emit('update:progress', val);
}

function setSpeed(s: PlaybackSpeed) {
  if (SPEEDS.includes(s)) {
    speed.value = s;
  }
}

const showSpeedPopover = ref(false);
const speedWrapperRef = ref<HTMLElement | null>(null);

function toggleSpeedPopover() {
  showSpeedPopover.value = !showSpeedPopover.value;
}

function selectSpeed(s: PlaybackSpeed) {
  setSpeed(s);
  showSpeedPopover.value = false;
}

function onWindowClick(event: MouseEvent) {
  if (!showSpeedPopover.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (speedWrapperRef.value && !speedWrapperRef.value.contains(target)) {
    showSpeedPopover.value = false;
  }
}

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showSpeedPopover.value) {
    showSpeedPopover.value = false;
  }
}

onMounted(() => {
  window.addEventListener('click', onWindowClick, true);
  window.addEventListener('keydown', onWindowKeydown);
});

function cycleSpeed() {
  const currentIndex = SPEEDS.indexOf(speed.value);
  const nextIndex = (currentIndex + 1) % SPEEDS.length;
  setSpeed(SPEEDS[nextIndex]);
}

watch(
  () => props.progress,
  (val) => {
    if (!playing.value) {
      currentProgress = val ?? 0;
    }
  }
);

watch(() => props.points, stopAnimation);
watch(
  () => props.active,
  (isActive) => {
    if (!isActive) stopAnimation();
  }
);
onUnmounted(() => {
  stopAnimation();
  window.removeEventListener('click', onWindowClick, true);
  window.removeEventListener('keydown', onWindowKeydown);
});

// --- Metriken ---
const distance = computed(() => trackDistanceMeters(props.points));
const duration = computed(() => trackDurationMs(props.points));
const avgSpeed = computed(() => trackAverageSpeedKmh(distance.value, duration.value));
const avgSpeedLabel = computed(() => {
  if (avgSpeed.value == null || avgSpeed.value <= 0) return '';
  if (avgSpeed.value > 300) return '';
  return formatSpeedShort(avgSpeed.value);
});
const elevation = computed(() => trackElevation(props.points));
const elevationLabel = computed(() => {
  if (!elevation.value) return '';
  if (elevation.value.gain === 0 && elevation.value.loss === 0) return '';
  return formatElevationShort(elevation.value);
});

// --- Zeitformatierung (mm:ss oder hh:mm:ss) ---
function formatTimeDisplay(ms: number, forceHours = false): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (forceHours || hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

const hasHours = computed(() => duration.value >= 3600_000);
const currentElapsedMs = computed(() => (props.progress ?? 0) * duration.value);
const currentElapsedLabel = computed(() =>
  formatTimeDisplay(currentElapsedMs.value, hasHours.value)
);
const totalDurationLabel = computed(() => formatTimeDisplay(duration.value, hasHours.value));

// --- Uhrzeiten der Aufzeichnung (Start/Aktuell/Ende) ---
const timeOfDayFormatter = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
function formatTimeOfDay(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : timeOfDayFormatter.format(d);
}

const startTimeOfDay = computed(() => {
  if (props.points.length > 0) return formatTimeOfDay(props.points[0].recorded_at);
  if (props.track?.started_at) return formatTimeOfDay(props.track.started_at);
  return '';
});

const endTimeOfDay = computed(() => {
  if (props.points.length > 0)
    return formatTimeOfDay(props.points[props.points.length - 1].recorded_at);
  if (props.track?.ended_at) return formatTimeOfDay(props.track.ended_at);
  return '';
});

const currentTimeOfDay = computed(() => {
  if (props.points.length < 2) return '';
  const startMs = new Date(props.points[0].recorded_at).getTime();
  const endMs = new Date(props.points[props.points.length - 1].recorded_at).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return '';
  const currentMs = startMs + (props.progress ?? 0) * (endMs - startMs);
  return timeOfDayFormatter.format(new Date(currentMs));
});

const trackDateLabel = computed(() => {
  const iso = props.points[0]?.recorded_at ?? props.track?.started_at;
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
});

const displayTitle = computed(() => props.title || props.track?.title || 'Aufzeichnung');

defineExpose({
  playing,
  speed,
  setSpeed,
  cycleSpeed,
  togglePlay,
  stopAnimation,
  showSpeedPopover,
});
</script>

<template>
  <div class="track-playback" role="region" aria-label="Aufzeichnungs-Wiedergabe">
    <!-- Header: Titel, Datum & Schließen-Button -->
    <div class="track-playback-header">
      <div class="track-playback-title-wrap">
        <AppIcon
          :icon="ACTION_ICONS.history"
          :size="15"
          group="actions"
          class="track-playback-icon"
        />
        <span class="track-playback-title">{{ displayTitle }}</span>
        <span v-if="trackDateLabel" class="track-playback-date">{{ trackDateLabel }}</span>
      </div>
      <IconButton
        class="playback-close-btn"
        variant="ghost"
        size="sm"
        :icon="ACTION_ICONS.close"
        :aria-label="'Wiedergabe schließen'"
        title="Schließen"
        @click="emit('close')"
      />
    </div>

    <!-- Metriken-Chips: Distanz, Dauer, Durchschnittsgeschwindigkeit, Höhenmeter -->
    <div class="track-playback-stats" aria-label="Aufzeichnungs-Statistiken">
      <span class="metric-chip" data-testid="metric-distance" title="Gesamtdistanz">
        <AppIcon :icon="ACTION_ICONS.distance" :size="13" group="actions" />
        <span>{{ formatDistanceShort(distance) }}</span>
      </span>
      <span class="metric-chip" data-testid="metric-duration" title="Gesamtdauer">
        <AppIcon :icon="ACTION_ICONS.duration" :size="13" group="actions" />
        <span>{{ formatDurationShort(duration) }}</span>
      </span>
      <span
        v-if="avgSpeedLabel"
        class="metric-chip"
        data-testid="metric-speed"
        title="Durchschnittsgeschwindigkeit"
      >
        <AppIcon :icon="SPEED_ICON" :size="13" group="actions" />
        <span>{{ avgSpeedLabel }}</span>
      </span>
      <span
        v-if="elevationLabel"
        class="metric-chip"
        data-testid="metric-elevation"
        title="Höhenmeter (Aufstieg / Abstieg)"
      >
        <AppIcon :icon="ELEVATION_ICON" :size="13" group="actions" />
        <span>{{ elevationLabel }}</span>
      </span>
    </div>

    <!-- Playback-Steuerelemente: Play/Pause, Scrubber-Slider, Speed-Gruppe, Zeitanzeige -->
    <div class="track-playback-controls">
      <IconButton
        class="playback-btn"
        :variant="playing ? 'secondary' : 'primary'"
        size="sm"
        shape="squircle"
        :icon="playing ? ACTION_ICONS.pause : ACTION_ICONS.play"
        :aria-label="playing ? 'Pause' : 'Abspielen'"
        :title="playing ? 'Pause' : 'Abspielen'"
        :disabled="points.length < 2"
        @click="togglePlay"
      />

      <input
        type="range"
        class="playback-slider"
        min="0"
        max="1"
        step="0.001"
        :value="progress ?? 0"
        :disabled="points.length < 2"
        @input="onScrub"
        aria-label="Position in der Aufzeichnung"
        :aria-valuenow="Math.round((progress ?? 0) * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuetext="`${currentElapsedLabel} von ${totalDurationLabel}`"
      />

      <div ref="speedWrapperRef" class="speed-picker-wrapper">
        <button
          type="button"
          class="speed-trigger-btn"
          :class="{ 'is-open': showSpeedPopover }"
          aria-label="Wiedergabegeschwindigkeit ändern"
          :title="`Geschwindigkeit: ${speed}x (tippen zum Ändern)`"
          :aria-expanded="showSpeedPopover"
          aria-haspopup="dialog"
          @click.stop="toggleSpeedPopover"
        >
          <span class="speed-trigger-label">{{ speed }}x</span>
        </button>

        <div
          v-show="showSpeedPopover"
          class="speed-popover"
          role="dialog"
          aria-label="Wiedergabegeschwindigkeit wählen"
        >
          <div class="playback-speed-group" role="group" aria-label="Wiedergabegeschwindigkeit">
            <button
              v-for="s in SPEEDS"
              :key="s"
              type="button"
              class="speed-btn"
              :class="{ active: speed === s }"
              :aria-pressed="speed === s"
              :title="`Geschwindigkeit ${s}x`"
              @click="selectSpeed(s)"
            >
              {{ s }}x
            </button>
          </div>
        </div>
      </div>

      <span class="playback-time" aria-live="off">
        {{ currentElapsedLabel }} / {{ totalDurationLabel }}
      </span>
    </div>

    <!-- Uhrzeit-Spanne der Aufzeichnung (Start, aktuelle Position, Ende) -->
    <div v-if="points.length >= 2" class="track-playback-range">
      <span class="range-time start-time" title="Startzeit">{{ startTimeOfDay }}</span>
      <span v-if="currentTimeOfDay" class="range-time current-time" title="Aktuelle Uhrzeit">{{
        currentTimeOfDay
      }}</span>
      <span class="range-time end-time" title="Endzeit">{{ endTimeOfDay }}</span>
    </div>
  </div>
</template>

<style scoped>
.track-playback {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-glass, rgba(255, 255, 255, 0.92));
  backdrop-filter: var(--backdrop-blur-md);
  border: 1px solid var(--color-surface-glass-border, var(--color-border));
  border-radius: var(--radius-md-squircle, 12px);
  corner-shape: squircle;
  box-shadow: var(--shadow-md, 0 4px 16px rgba(0, 0, 0, 0.12));
}

.track-playback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.track-playback-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.track-playback-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.track-playback-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-playback-date {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.track-playback-stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
}

.metric-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.3;
}

.track-playback-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.playback-slider {
  flex: 1 1 0;
  min-width: 40px;
  height: 6px;
  accent-color: var(--color-primary);
  border-radius: var(--radius-pill);
  cursor: pointer;
  outline: none;
}

.playback-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.playback-slider:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
  border-radius: var(--radius-pill);
}

.speed-picker-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.speed-trigger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  line-height: 1.2;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.speed-trigger-btn:hover,
.speed-trigger-btn.is-open {
  background: var(--color-surface);
  border-color: var(--color-primary);
  color: var(--color-primary);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.speed-trigger-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.speed-popover {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md, 0 4px 14px rgba(0, 0, 0, 0.15));
  padding: 4px;
  white-space: nowrap;
}

.playback-speed-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--color-hover);
  padding: 2px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1px solid var(--color-border);
}

.speed-btn {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  padding: 2px 6px;
  border-radius: calc(var(--radius-sm-squircle) - 2px);
  corner-shape: squircle;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  line-height: 1.2;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.speed-btn:hover {
  color: var(--color-text);
}

.speed-btn.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.playback-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

@media (max-width: 380px) {
  .track-playback {
    padding: var(--space-2);
    gap: 6px;
  }

  .track-playback-controls {
    gap: 6px;
  }

  .playback-time {
    font-size: 0.72rem;
  }

  .metric-chip {
    padding: 1px 5px;
    font-size: 0.7rem;
  }
}

.track-playback-range {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  padding: 0 2px;
}

.range-time.current-time {
  font-weight: 600;
  color: var(--color-primary-dark, var(--color-primary));
}
</style>
