<script setup lang="ts">
import { computed } from 'vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useTrackRecordingStore } from '../stores/trackRecording';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';

const props = defineProps<{
  trackRecordingError?: string | null;
  tileDownloadState: 'idle' | 'downloading' | 'done';
  tileDownloadProgress?: { done: number; total: number };
  tileDownloadResult?: { downloaded: number; failed: number } | null;
}>();

const emit = defineEmits<{
  (e: 'dismiss-track-error'): void;
  (e: 'dismiss-download-result'): void;
}>();

const trackRecordingStore = useTrackRecordingStore();

const effectiveTrackError = computed(() => {
  return props.trackRecordingError !== undefined
    ? props.trackRecordingError
    : trackRecordingStore.startError;
});

function dismissTrackError() {
  trackRecordingStore.startError = null;
  emit('dismiss-track-error');
}
</script>

<template>
  <div v-if="effectiveTrackError" class="tile-download-pill" role="alert">
    <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
    <span>{{ effectiveTrackError }}</span>
    <IconButton
      variant="ghost"
      size="sm"
      :icon="ACTION_ICONS.close"
      aria-label="Meldung schließen"
      title="Schließen"
      @click="dismissTrackError"
    />
  </div>

  <div v-else-if="tileDownloadState === 'downloading'" class="tile-download-pill" role="status">
    <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" />
    <span>
      Lädt Kartenkacheln…
      <template v-if="tileDownloadProgress">
        {{ tileDownloadProgress.done }}/{{ tileDownloadProgress.total }}
      </template>
    </span>
  </div>

  <div
    v-else-if="tileDownloadState === 'done' && tileDownloadResult"
    class="tile-download-pill"
    role="status"
  >
    <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
    <span>
      {{ tileDownloadResult.downloaded }} Kacheln offline gespeichert{{
        tileDownloadResult.failed ? `, ${tileDownloadResult.failed} fehlgeschlagen` : ''
      }}
    </span>
    <IconButton
      variant="ghost"
      size="sm"
      :icon="ACTION_ICONS.close"
      aria-label="Meldung schließen"
      title="Schließen"
      @click="emit('dismiss-download-result')"
    />
  </div>
</template>

<style scoped>
.tile-download-pill {
  position: absolute;
  top: calc(var(--fit-btn-top-inset, var(--space-3)) + 52px);
  left: var(--space-3);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-md);
  max-width: calc(100% - 60px);
}

@container trip-map (min-width: 720px) {
  .tile-download-pill {
    bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-4));
    right: var(--space-4);
    top: unset;
    left: unset;
  }
}
</style>
