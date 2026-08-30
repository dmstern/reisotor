<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { TrackPoint } from '../api/types';
import {
  formatDistanceShort,
  formatDurationShort,
  trackDistanceMeters,
  trackDurationMs,
} from '../utils/trackGeometry';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Zeit-Slider für eine aufgezeichnete Route (TripMap.vue zeigt die Route selbst + einen Marker, der
// hier per v-model:progress gesteuert wird - reine Anzeigekomponente ohne eigenen Store). Die
// tatsächliche Aufzeichnungsdauer kann Stunden betragen - "Abspielen"
// rafft das auf eine feste, kurze Animationsdauer statt in Echtzeit abzuspielen (wie bei Google
// Maps Timeline).
const PLAYBACK_DURATION_MS = 12_000;

const props = defineProps<{ points: TrackPoint[]; progress: number }>();
const emit = defineEmits<{ (e: 'update:progress', value: number): void }>();

const playing = ref(false);
let rafId: number | null = null;
let playbackStartedAt = 0;
let playbackStartProgress = 0;

function stopAnimation() {
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
  playing.value = false;
}

function tick(now: number) {
  const elapsed = now - playbackStartedAt;
  const delta = elapsed / PLAYBACK_DURATION_MS;
  const next = Math.min(1, playbackStartProgress + delta);
  emit('update:progress', next);
  if (next >= 1) {
    stopAnimation();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function togglePlay() {
  if (playing.value) {
    stopAnimation();
    return;
  }
  playbackStartProgress = props.progress >= 1 ? 0 : props.progress;
  if (props.progress >= 1) emit('update:progress', 0);
  playing.value = true;
  playbackStartedAt = performance.now();
  rafId = requestAnimationFrame(tick);
}

function onScrub(event: Event) {
  stopAnimation();
  emit('update:progress', Number((event.target as HTMLInputElement).value) / 1000);
}

// Ein Wechsel der angezeigten Aufzeichnung (anderer Track fokussiert) beendet eine laufende
// Wiedergabe - sonst liefe der Timer gegen die neuen, unpassenden Punkte weiter.
watch(() => props.points, stopAnimation);
onUnmounted(stopAnimation);

const duration = computed(() => trackDurationMs(props.points));
const distance = computed(() => trackDistanceMeters(props.points));

const timeFormatter = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso));
}

const currentTimeLabel = computed(() => {
  if (!props.points.length) return '';
  const startMs = new Date(props.points[0].recorded_at).getTime();
  const endMs = new Date(props.points[props.points.length - 1].recorded_at).getTime();
  const currentMs = startMs + props.progress * (endMs - startMs);
  return timeFormatter.format(new Date(currentMs));
});
</script>

<template>
  <div v-if="points.length >= 1" class="track-playback">
    <div class="track-playback-stats">
      <span
        ><AppIcon :icon="ACTION_ICONS.distance" :size="14" group="actions" />
        {{ formatDistanceShort(distance) }}</span
      >
      <span
        ><AppIcon :icon="ACTION_ICONS.duration" :size="14" group="actions" />
        {{ formatDurationShort(duration) }}</span
      >
    </div>
    <div class="track-playback-controls">
      <button
        type="button"
        class="playback-btn"
        :aria-label="playing ? 'Pause' : 'Abspielen'"
        @click="togglePlay"
      >
        <AppIcon
          :icon="playing ? ACTION_ICONS.pause : ACTION_ICONS.play"
          :size="16"
          group="actions"
        />
      </button>
      <input
        type="range"
        class="playback-slider"
        min="0"
        max="1000"
        :value="progress * 1000"
        @input="onScrub"
        aria-label="Position in der Aufzeichnung"
      />
      <span class="playback-time">{{ currentTimeLabel }}</span>
    </div>
    <div class="track-playback-range">
      <span>{{ formatTime(points[0].recorded_at) }}</span>
      <span>{{ formatTime(points[points.length - 1].recorded_at) }}</span>
    </div>
  </div>
</template>

<style scoped>
.track-playback {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.track-playback-stats {
  display: flex;
  gap: var(--space-3);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.track-playback-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.playback-btn {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: var(--color-primary-tint);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.playback-slider {
  flex: 1;
  min-width: 0;
}

.playback-time {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.track-playback-range {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
