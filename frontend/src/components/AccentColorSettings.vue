<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  useUiSettingsStore,
  VIBRANT_PRIMARY_COLOR_PRESETS,
  PASTEL_PRIMARY_COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
} from '../stores/uiSettings';
import SegmentedToggle from './SegmentedToggle.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

const uiSettings = useUiSettingsStore();

const paletteMode = ref<'vibrant' | 'soft'>('vibrant');

const PALETTE_TOGGLE_OPTIONS = [
  { value: 'vibrant', label: 'Kräftig' },
  { value: 'soft', label: 'Pastell / Sanft' },
];

const activePresets = computed(() => {
  return paletteMode.value === 'vibrant'
    ? VIBRANT_PRIMARY_COLOR_PRESETS
    : PASTEL_PRIMARY_COLOR_PRESETS;
});

function resetColor() {
  uiSettings.primaryColor = DEFAULT_PRIMARY_COLOR;
}
</script>

<template>
  <div class="card">
    <h2>Akzentfarbe</h2>
    <p class="hint">
      Wähle deine persönliche Haupt-Akzentfarbe für Buttons, aktive Toggles, Links und Icons.
    </p>

    <!-- Palette Toggle (Kräftig vs Pastell) -->
    <div class="palette-toggle-wrap">
      <SegmentedToggle
        :model-value="paletteMode"
        :options="PALETTE_TOGGLE_OPTIONS"
        @update:model-value="(v) => (paletteMode = v as 'vibrant' | 'soft')"
      />
    </div>

    <!-- Farbauswahl-Grid -->
    <div class="color-presets-grid">
      <button
        v-for="preset in activePresets"
        :key="preset.hex"
        type="button"
        class="color-preset-btn"
        :class="{ active: uiSettings.primaryColor.toLowerCase() === preset.hex.toLowerCase() }"
        :style="{ '--preset-color': preset.hex }"
        :aria-label="`Akzentfarbe ${preset.name} wählen`"
        :title="preset.name"
        @click="uiSettings.primaryColor = preset.hex"
      >
        <span class="color-swatch"></span>
        <span class="color-name">{{ preset.name }}</span>
      </button>
    </div>

    <!-- Eigene Farbe (Color Picker) & Reset -->
    <div class="color-picker-row">
      <label for="accent-color-picker" class="picker-label">
        <span class="picker-title">Eigene Farbe wählen</span>
        <div class="picker-input-wrap">
          <input
            id="accent-color-picker"
            type="color"
            v-model="uiSettings.primaryColor"
            class="color-input"
          />
          <span class="hex-code">{{ uiSettings.primaryColor.toUpperCase() }}</span>
        </div>
      </label>

      <Button
        v-if="uiSettings.primaryColor.toLowerCase() !== DEFAULT_PRIMARY_COLOR.toLowerCase()"
        type="button"
        variant="secondary"
        size="sm"
        @click="resetColor"
      >
        <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Standard (Türkis)
      </Button>
    </div>

    <!-- Live Demo Vorschau -->
    <div class="color-preview-stage">
      <div class="preview-header">
        <AppIcon :icon="SECTION_ICON_DEFS.dashboard" :size="20" group="navigation" />
        <span class="preview-title">Live Vorschau</span>
        <span class="preview-badge">Aktiv</span>
      </div>
      <div class="preview-actions">
        <Button variant="primary" size="sm">Primär-Button</Button>
        <Button variant="secondary" size="sm">Sekundär-Button</Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-toggle-wrap {
  margin-top: var(--space-3);
}

.color-presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.color-preset-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.color-preset-btn:hover {
  transform: translateY(-1px);
  border-color: var(--color-border-strong);
}

.color-preset-btn.active {
  border-color: var(--preset-color);
  box-shadow: 0 0 0 2px var(--preset-color);
  background: var(--color-primary-tint);
}

.color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--preset-color);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

.color-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: var(--ui-border-width, 1px) solid var(--color-border);
  flex-wrap: wrap;
}

.picker-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}

.picker-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.picker-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 8px;
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
}

.color-input {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input::-webkit-color-swatch {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
}

.color-input::-moz-color-swatch {
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
}

.hex-code {
  font-family: monospace;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.color-preview-stage {
  margin-top: var(--space-4);
  padding: var(--space-3);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-hover);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary);
}

.preview-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text);
  flex: 1;
}

.preview-badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: var(--color-primary-tint);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.preview-actions {
  display: flex;
  gap: var(--space-2);
}
</style>
