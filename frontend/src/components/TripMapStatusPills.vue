<script setup lang="ts">
import { computed } from 'vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useTrackRecordingStore } from '../stores/trackRecording';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';

const props = defineProps<{
  trackRecordingError?: string | null;
}>();

const emit = defineEmits<{
  (e: 'dismiss-track-error'): void;
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
  <div v-if="effectiveTrackError" class="tile-download-pill map-status-pill" role="alert">
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
</template>

<style scoped>
.tile-download-pill,
.map-status-pill {
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
  .tile-download-pill,
  .map-status-pill {
    bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-4));
    right: var(--space-4);
    top: unset;
    left: unset;
  }
}
</style>
