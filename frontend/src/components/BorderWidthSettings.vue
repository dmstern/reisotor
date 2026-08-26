<script setup lang="ts">
import { computed } from 'vue';
import { useUiSettingsStore, DEFAULT_BORDER_WIDTH } from '../stores/uiSettings';
import SegmentedToggle from './SegmentedToggle.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const uiSettings = useUiSettingsStore();

const BORDER_PRESET_OPTIONS = [
  { value: '0', label: '0px' },
  { value: '1', label: '1px' },
  { value: '2', label: '2px' },
  { value: '4', label: '4px' },
];

const currentPresetValue = computed(() => {
  const widthStr = String(uiSettings.borderWidth);
  return BORDER_PRESET_OPTIONS.some((o) => o.value === widthStr) ? widthStr : '';
});
</script>

<template>
  <div class="card">
    <h2>Rahmendicke (Borders)</h2>
    <p class="hint">
      Passe die Rahmendicke für Karten, Panels, Formularfelder und Buttons an (0 bis 10 Pixel).
    </p>

    <!-- Schnellauswahl (Presets) -->
    <div class="preset-wrap">
      <SegmentedToggle
        :model-value="currentPresetValue"
        :options="BORDER_PRESET_OPTIONS"
        @update:model-value="(v) => (uiSettings.borderWidth = parseInt(v as string, 10))"
      />
    </div>

    <!-- Schieberegler (immer sichtbar) -->
    <div class="slider-wrap">
      <div class="slider-header">
        <label for="border-width-slider">Rahmendicke feineinstellen</label>
        <span class="slider-value">{{ uiSettings.borderWidth }}px</span>
      </div>
      <input
        id="border-width-slider"
        type="range"
        min="0"
        max="10"
        step="1"
        v-model.number="uiSettings.borderWidth"
        class="range-input"
      />
    </div>

    <!-- Live Vorschau -->
    <div class="border-preview-stage">
      <div class="preview-card" :style="{ borderWidth: `${uiSettings.borderWidth}px` }">
        <span class="card-label">Beispiel-Karte (Card / Panel)</span>
        <Button variant="secondary" size="sm" :style="{ borderWidth: `${uiSettings.borderWidth}px` }">
          Beispiel-Button
        </Button>
      </div>
    </div>

    <div
      v-if="uiSettings.borderWidth !== DEFAULT_BORDER_WIDTH"
      class="reset-row"
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        @click="uiSettings.borderWidth = DEFAULT_BORDER_WIDTH"
      >
        <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Standard (1px)
      </Button>
    </div>
  </div>
</template>

<style scoped>
.preset-wrap {
  margin-top: var(--space-3);
}

.slider-wrap {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 600;
}

.slider-value {
  font-family: var(--font-sans);
  font-weight: 700;
  color: var(--color-primary);
}

.range-input {
  width: 100%;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.border-preview-stage {
  margin-top: var(--space-4);
}

.preview-card {
  padding: var(--space-3);
  border-style: solid;
  border-color: var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
  transition: border-width 0.15s ease;
}

.card-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.reset-row {
  margin-top: var(--space-3);
  display: flex;
  justify-content: flex-end;
}
</style>
