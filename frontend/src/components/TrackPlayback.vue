<script lang="ts">
import type { LocationTrack, TrackPoint } from '../api/types';

const SPEED_1X = 1;
const SPEED_2X = 2;
const SPEED_5X = 5;
const SPEED_10X = 10;

export const SPEEDS = [SPEED_1X, SPEED_2X, SPEED_5X, SPEED_10X] as const;
export type PlaybackSpeed = (typeof SPEEDS)[number];

export interface TrackPlaybackProps {
  track?: LocationTrack | null;
  title?: string | null;
  authorAvatar?: string | null;
  authorName?: string | null;
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
import Button from './primitives/Button.vue';
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
  authorAvatar: undefined,
  authorName: undefined,
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
  if (!playing.value) {
    return;
  }

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
  if (props.points.length < 2) {
    return;
  }

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

function setSpeed(newSpeed: PlaybackSpeed) {
  if (SPEEDS.includes(newSpeed)) {
    speed.value = newSpeed;
  }
}

const showSpeedPopover = ref(false);
const speedWrapperRef = ref<HTMLElement | null>(null);

function toggleSpeedPopover() {
  showSpeedPopover.value = !showSpeedPopover.value;
}

function selectSpeed(newSpeed: PlaybackSpeed) {
  setSpeed(newSpeed);
  showSpeedPopover.value = false;
}

function onWindowClick(event: MouseEvent) {
  if (!showSpeedPopover.value) {
    return;
  }

  const target = event.target as Node | null;

  if (!target) {
    return;
  }

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
    if (!isActive) {
      stopAnimation();
    }
  }
);
onUnmounted(() => {
  stopAnimation();
  window.removeEventListener('click', onWindowClick, true);
  window.removeEventListener('keydown', onWindowKeydown);
});

// --- Metriken ---
const distance = computed(() => trackDistanceMeters(props.points));
const duration = computed(() => {
  const pointsDuration = trackDurationMs(props.points);

  if (pointsDuration > 0) {
    return pointsDuration;
  }

  if (props.track?.started_at && props.track?.ended_at) {
    const trackMs =
      new Date(props.track.ended_at).getTime() - new Date(props.track.started_at).getTime();

    if (trackMs > 0) {
      return trackMs;
    }
  }

  return 0;
});
const MAX_VALID_SPEED_KMH = 300;
const SECONDS_PER_HOUR = 3600;
const MS_PER_HOUR = 3_600_000;
const HEADER_ICON_SIZE = 16;
const METRIC_ICON_SIZE = 14;
const PERCENT_MULTIPLIER = 100;

const avgSpeed = computed(() => trackAverageSpeedKmh(distance.value, duration.value));
const avgSpeedLabel = computed(() => {
  if (avgSpeed.value == null || avgSpeed.value <= 0) {
    return '';
  }

  if (avgSpeed.value > MAX_VALID_SPEED_KMH) {
    return '';
  }

  return formatSpeedShort(avgSpeed.value);
});
const elevation = computed(() => trackElevation(props.points));
const elevationLabel = computed(() => {
  if (!elevation.value) {
    return '';
  }

  if (elevation.value.gain === 0 && elevation.value.loss === 0) {
    return '';
  }

  return formatElevationShort(elevation.value);
});

// --- Zeitformatierung (mm:ss oder hh:mm:ss) ---
function formatTimeDisplay(ms: number, forceHours = false): string {
  if (!Number.isFinite(ms) || ms < 0) {
    ms = 0;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60);
  const seconds = totalSeconds % 60;
  const pad = (num: number) => num.toString().padStart(2, '0');

  if (forceHours || hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

const clampedProgress = computed(() => {
  const raw = props.progress ?? 0;

  if (!Number.isFinite(raw)) {
    return 0;
  }

  return Math.max(0, Math.min(1, raw));
});
const progressPercent = computed(
  () => `${(clampedProgress.value * PERCENT_MULTIPLIER).toFixed(2)}%`
);

const hasHours = computed(() => duration.value >= MS_PER_HOUR);
const currentElapsedMs = computed(() => clampedProgress.value * duration.value);
const currentElapsedLabel = computed(() =>
  formatTimeDisplay(currentElapsedMs.value, hasHours.value)
);
const totalDurationLabel = computed(() => formatTimeDisplay(duration.value, hasHours.value));

// --- Uhrzeiten der Aufzeichnung (Start/Aktuell/Ende) ---
const timeOfDayFormatter = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

function formatTimeOfDay(iso?: string | null): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : timeOfDayFormatter.format(date);
}

const startTimeOfDay = computed(() => {
  if (props.points.length > 0) {
    return formatTimeOfDay(props.points[0].recorded_at);
  }

  if (props.track?.started_at) {
    return formatTimeOfDay(props.track.started_at);
  }

  return '';
});

const endTimeOfDay = computed(() => {
  if (props.points.length > 0) {
    return formatTimeOfDay(props.points[props.points.length - 1].recorded_at);
  }

  if (props.track?.ended_at) {
    return formatTimeOfDay(props.track.ended_at);
  }

  return '';
});

const currentTimeOfDay = computed(() => {
  if (props.points.length < 2) {
    return '';
  }

  const startMs = new Date(props.points[0].recorded_at).getTime();
  const endMs = new Date(props.points[props.points.length - 1].recorded_at).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    if (props.track?.started_at && props.track?.ended_at) {
      const tStart = new Date(props.track.started_at).getTime();
      const tEnd = new Date(props.track.ended_at).getTime();

      if (Number.isFinite(tStart) && Number.isFinite(tEnd) && tEnd > tStart) {
        const cur = tStart + clampedProgress.value * (tEnd - tStart);
        return timeOfDayFormatter.format(new Date(cur));
      }
    }

    return '';
  }

  const currentMs = startMs + clampedProgress.value * (endMs - startMs);
  return timeOfDayFormatter.format(new Date(currentMs));
});

const trackDateLabel = computed(() => {
  const iso = props.points[0]?.recorded_at ?? props.track?.started_at;

  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
});

const displayTitle = computed(() => props.title || props.track?.title || 'Aufzeichnung');

const trackAuthorAvatar = computed(() => props.authorAvatar ?? props.track?.author_avatar ?? null);
const trackAuthorName = computed(() => props.authorName ?? props.track?.author_username ?? '');
const trackAuthorTitle = computed(() =>
  trackAuthorName.value ? `Aufgezeichnet von ${trackAuthorName.value}` : 'Aufzeichnung'
);

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
    <!-- Reihe 1: Header mit Titel, Autor, Datum & 46px-Schließen-Button -->
    <div class="track-playback-header">
      <div class="track-playback-title-wrap">
        <AppIcon
          :icon="ACTION_ICONS.history"
          :size="HEADER_ICON_SIZE"
          group="actions"
          class="track-playback-icon"
        />
        <span class="track-playback-title">{{ displayTitle }}</span>
        <span v-if="trackAuthorAvatar" class="track-playback-author" :title="trackAuthorTitle">
          <span class="track-playback-author-avatar">{{ trackAuthorAvatar }}</span>
          <span class="track-playback-author-name">{{ trackAuthorName }}</span>
        </span>
        <span v-if="trackDateLabel" class="track-playback-date">{{ trackDateLabel }}</span>
      </div>
      <IconButton
        class="playback-close-btn"
        variant="ghost"
        size="md"
        :icon="ACTION_ICONS.close"
        aria-label="Wiedergabe schließen"
        title="Schließen"
        @click="emit('close')"
      />
    </div>

    <!-- Reihe 2: Metriken-Chips (Distanz, Dauer, Durchschnittsgeschwindigkeit, Höhenmeter) -->
    <div class="track-playback-stats" aria-label="Aufzeichnungs-Statistiken">
      <span class="metric-chip" data-testid="metric-distance" title="Gesamtdistanz">
        <AppIcon :icon="ACTION_ICONS.distance" :size="METRIC_ICON_SIZE" group="actions" />
        <span>{{ formatDistanceShort(distance) }}</span>
      </span>
      <span class="metric-chip" data-testid="metric-duration" title="Gesamtdauer">
        <AppIcon :icon="ACTION_ICONS.duration" :size="METRIC_ICON_SIZE" group="actions" />
        <span>{{ formatDurationShort(duration) }}</span>
      </span>
      <span
        v-if="avgSpeedLabel"
        class="metric-chip"
        data-testid="metric-speed"
        title="Durchschnittsgeschwindigkeit"
      >
        <AppIcon :icon="SPEED_ICON" :size="METRIC_ICON_SIZE" group="actions" />
        <span>{{ avgSpeedLabel }}</span>
      </span>
      <span
        v-if="elevationLabel"
        class="metric-chip"
        data-testid="metric-elevation"
        title="Höhenmeter (Aufstieg / Abstieg)"
      >
        <AppIcon :icon="ELEVATION_ICON" :size="METRIC_ICON_SIZE" group="actions" />
        <span>{{ elevationLabel }}</span>
      </span>
    </div>

    <!-- Reihe 3: Vollbreiter Scrubber mit 44px Touch-Ziel & Uhrzeit-Spanne direkt darunter -->
    <div class="track-playback-scrubber">
      <input
        type="range"
        class="playback-slider"
        min="0"
        max="1"
        step="0.001"
        :value="clampedProgress"
        :disabled="points.length < 2"
        :style="{ '--progress-pct': progressPercent }"
        @input="onScrub"
        aria-label="Position in der Aufzeichnung"
        :aria-valuenow="Math.round(clampedProgress * PERCENT_MULTIPLIER)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuetext="`${currentElapsedLabel} von ${totalDurationLabel}`"
      />
      <div v-if="points.length >= 2" class="track-playback-range">
        <span class="range-time start-time" title="Startzeit">{{ startTimeOfDay }}</span>
        <span v-if="currentTimeOfDay" class="range-time current-time" title="Aktuelle Uhrzeit">{{
          currentTimeOfDay
        }}</span>
        <span class="range-time end-time" title="Endzeit">{{ endTimeOfDay }}</span>
      </div>
    </div>

    <!-- Reihe 4: Transportleiste (52px Play/Pause, 46px Speed-Steuerung, Laufzeit) -->
    <div class="track-playback-transport">
      <IconButton
        class="playback-btn"
        :variant="playing ? 'secondary' : 'primary'"
        size="lg"
        shape="squircle"
        :icon="playing ? ACTION_ICONS.pause : ACTION_ICONS.play"
        :aria-label="playing ? 'Pause' : 'Abspielen'"
        :title="playing ? 'Pause' : 'Abspielen'"
        :disabled="points.length < 2"
        @click="togglePlay"
      />

      <div
        class="playback-speed-group speed-inline-group"
        role="group"
        aria-label="Wiedergabegeschwindigkeit"
      >
        <button
          v-for="s in SPEEDS"
          :key="`inline-${s}`"
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

      <div ref="speedWrapperRef" class="speed-picker-wrapper">
        <Button
          variant="secondary"
          size="md"
          class="speed-trigger-btn"
          :class="{ 'is-open': showSpeedPopover }"
          aria-label="Wiedergabegeschwindigkeit ändern"
          :title="`Geschwindigkeit: ${speed}x (tippen zum Ändern)`"
          :aria-expanded="showSpeedPopover"
          aria-haspopup="dialog"
          @click.stop="toggleSpeedPopover"
        >
          <span class="speed-trigger-label">{{ speed }}x</span>
        </Button>

        <div
          v-show="showSpeedPopover"
          class="speed-popover"
          role="dialog"
          aria-label="Wiedergabegeschwindigkeit wählen"
        >
          <div class="playback-speed-group" role="group" aria-label="Wiedergabegeschwindigkeit">
            <button
              v-for="s in SPEEDS"
              :key="`popover-${s}`"
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
  </div>
</template>

<style lang="scss" scoped>
.track-playback {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  container: track-playback / inline-size;
  background: var(--color-surface-glass-dense, var(--color-surface-glass, var(--color-surface)));
  backdrop-filter: var(--backdrop-blur-md);
  border: 1px solid var(--color-surface-glass-border, var(--color-border));
  border-radius: var(--radius-md-squircle, 16px);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
}

.track-playback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
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
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.track-playback-date {
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.track-playback-author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.track-playback-author-avatar {
  line-height: 1;
}

.track-playback-author-name {
  white-space: nowrap;
}

@include container-down('track-playback', 'mobile') {
  .track-playback-author-name {
    display: none;
  }
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
  gap: var(--space-1);
  padding: 3px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border-divider);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 600;
  white-space: nowrap;
  line-height: 1.25;
}

.track-playback-scrubber {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.playback-slider {
  --progress-pct: 0%;
  --scrubber-track-height: 8px;
  --scrubber-thumb-size: 26px;
  appearance: none;
  width: 100%;
  height: 44px;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  touch-action: pan-y;
  outline: none;
}

.playback-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: var(--scrubber-track-height);
  border-radius: var(--radius-pill);
  background: linear-gradient(
    to right,
    var(--color-primary) 0%,
    var(--color-primary) var(--progress-pct),
    var(--color-control-track-bg) var(--progress-pct),
    var(--color-control-track-bg) 100%
  );
  border: 1px solid var(--color-border-divider);
  box-shadow: var(--shadow-inset);
}

.playback-slider::-moz-range-track {
  width: 100%;
  height: var(--scrubber-track-height);
  border-radius: var(--radius-pill);
  background: linear-gradient(
    to right,
    var(--color-primary) 0%,
    var(--color-primary) var(--progress-pct),
    var(--color-control-track-bg) var(--progress-pct),
    var(--color-control-track-bg) 100%
  );
  border: 1px solid var(--color-border-divider);
  box-shadow: var(--shadow-inset);
}

.playback-slider::-webkit-slider-thumb {
  appearance: none;
  width: var(--scrubber-thumb-size);
  height: var(--scrubber-thumb-size);
  margin-top: calc((var(--scrubber-track-height) - var(--scrubber-thumb-size)) / 2 - 1px);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 3px solid var(--color-primary);
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.playback-slider::-moz-range-thumb {
  width: var(--scrubber-thumb-size);
  height: var(--scrubber-thumb-size);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 3px solid var(--color-primary);
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

@include can-hover {
  .playback-slider:not(:disabled):hover::-webkit-slider-thumb {
    transform: scale(1.1);
    border-color: var(--color-primary-dark);
    box-shadow: var(--shadow-md);
  }

  .playback-slider:not(:disabled):hover::-moz-range-thumb {
    transform: scale(1.1);
    border-color: var(--color-primary-dark);
    box-shadow: var(--shadow-md);
  }
}

.playback-slider:not(:disabled):active::-webkit-slider-thumb {
  transform: scale(1.16);
  border-color: var(--color-primary-dark);
  box-shadow:
    0 0 0 6px var(--color-control-active-tint),
    var(--shadow-md);
}

.playback-slider:not(:disabled):active::-moz-range-thumb {
  transform: scale(1.16);
  border-color: var(--color-primary-dark);
  box-shadow:
    0 0 0 6px var(--color-control-active-tint),
    var(--shadow-md);
}

.playback-slider:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.playback-slider:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
  border-radius: var(--radius-sm-squircle);
}

.track-playback-range {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  padding: 0 2px;
}

.range-time.current-time {
  font-weight: 700;
  color: var(--color-primary-dark, var(--color-primary));
}

.track-playback-transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.speed-inline-group {
  display: inline-flex;
  flex-shrink: 0;
}

.speed-picker-wrapper {
  position: relative;
  display: none;
  align-items: center;
  flex-shrink: 0;
}

.speed-trigger-btn {
  min-width: 56px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}

.speed-trigger-btn.is-open,
.speed-trigger-btn.is-open:hover {
  background-color: var(--color-control-active-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.speed-popover {
  position: absolute;
  bottom: calc(100% + var(--space-2));
  left: 0;
  z-index: var(--z-popover, 1100);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-dropdown-menu);
  padding: var(--space-1);
  white-space: nowrap;
}

.playback-speed-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background-color: var(--color-control-track-bg);
  padding: 3px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-divider);
  box-shadow: var(--shadow-inset);
}

.speed-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height-md, 46px);
  min-width: 44px;
  padding: 0 var(--space-2);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  line-height: 1;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

@include can-hover {
  .speed-btn:hover {
    color: var(--color-text);
    background: var(--color-control-hover-bg);
  }
}

.speed-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.speed-btn.active {
  background: var(--color-surface);
  color: var(--color-primary-dark, var(--color-primary));
  box-shadow: var(--shadow-pill-raised);
}

.playback-time {
  margin-left: auto;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

@include container-down('track-playback', 'mobile-sm') {
  .track-playback {
    padding: var(--space-2);
    gap: var(--space-1);
  }

  .speed-inline-group {
    display: none;
  }

  .speed-picker-wrapper {
    display: inline-flex;
  }
}

@media (prefers-reduced-motion: reduce) {
  .playback-slider::-webkit-slider-thumb,
  .playback-slider::-moz-range-thumb,
  .speed-btn {
    transition: none;
  }
}
</style>
