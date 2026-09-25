<script setup lang="ts">
import { computed } from 'vue';
import Button from './primitives/Button.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    /** Aktuelle Datei (1-basiert) */
    current?: number;
    /** Gesamtanzahl Dateien */
    total?: number;
    /** Prozentualer Fortschritt (0 bis 100). Falls nicht übergeben, wird er aus current / total berechnet. */
    progressPercent?: number;
    /** Name der Datei, die gerade verarbeitet wird */
    filename?: string;
    /** Steuert, ob der Abbrechen-Button sichtbar ist */
    cancellable?: boolean;
    /** Optionaler Fehlerhinweis */
    error?: string;
  }>(),
  {
    current: 1,
    total: 1,
    progressPercent: undefined,
    filename: '',
    cancellable: true,
    error: '',
  }
);

const emit = defineEmits<{
  (e: 'cancel'): void;
}>();

const percent = computed(() => {
  if (props.progressPercent !== undefined) {
    return Math.min(100, Math.max(0, props.progressPercent));
  }
  if (!props.total || props.total <= 0) return 0;
  return Math.min(100, Math.max(0, (props.current / props.total) * 100));
});

const statusLabel = computed(() => {
  const rounded = Math.round(percent.value);
  if (props.total > 1) {
    return `Lade ${props.current} von ${props.total} Dateien hoch… (${rounded}%)`;
  }
  return `Lade Datei hoch… (${rounded}%)`;
});
</script>

<template>
  <div class="upload-progress-container" :class="{ 'has-error': Boolean(error) }">
    <div class="upload-header">
      <div class="upload-info">
        <LoadingSpinner v-if="!error" size="sm" />
        <div class="upload-text-group">
          <span class="upload-status-text">{{ statusLabel }}</span>
          <span v-if="filename" class="upload-filename" :title="filename">{{ filename }}</span>
        </div>
      </div>
      <Button
        v-if="cancellable"
        type="button"
        variant="secondary"
        size="sm"
        :icon="ACTION_ICONS.close"
        @click="emit('cancel')"
      >
        Abbrechen
      </Button>
    </div>

    <div
      class="progress-track"
      role="progressbar"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="Upload-Fortschritt"
    >
      <div class="progress-fill" :style="{ width: `${percent}%` }" />
    </div>

    <p v-if="error" class="upload-error">{{ error }}</p>
  </div>
</template>

<style scoped>
.upload-progress-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-top: var(--space-2);
}

.upload-progress-container.has-error {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
}

.upload-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.upload-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.upload-text-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.upload-status-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  line-height: 1.25;
}

.upload-filename {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
  line-height: 1.25;
}

.progress-track {
  width: 100%;
  height: 6px;
  background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-hover));
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-reduced-motion: reduce) {
  .progress-fill {
    transition: none;
  }
}

.upload-error {
  font-size: 0.8rem;
  color: var(--color-danger);
  margin: 0;
}
</style>
