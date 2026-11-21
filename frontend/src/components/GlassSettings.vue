<script setup lang="ts">
import { computed } from 'vue';
import {
  useUiSettingsStore,
  type GlassStyle,
  computeGlassCssValues,
  getPresetGlassValues,
} from '../stores/uiSettings';
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import SettingsCardHeader from './settings/SettingsCardHeader.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

const uiSettings = useUiSettingsStore();

const GLASS_OPTIONS = [
  { value: 'glass', label: 'Glass' },
  { value: 'frosted', label: 'Frosted' },
  { value: 'opaque', label: 'Solide' },
];

function selectPreset(val: string) {
  const style = val as GlassStyle;
  const preset = getPresetGlassValues(style);

  if (!preset) {
    return;
  }

  uiSettings.glassOpacity = preset.opacity;
  uiSettings.glassBlur = preset.blur;
  uiSettings.glassStyle = style;
}

const isDefault = computed(() => {
  return (
    uiSettings.glassStyle === 'glass' &&
    uiSettings.glassOpacity === 42 &&
    uiSettings.glassBlur === 6
  );
});

function resetGlass() {
  selectPreset('glass');
}

function onSliderChange() {
  if (uiSettings.glassOpacity === 42 && uiSettings.glassBlur === 6) {
    uiSettings.glassStyle = 'glass';
  } else if (uiSettings.glassOpacity === 80 && uiSettings.glassBlur === 24) {
    uiSettings.glassStyle = 'frosted';
  } else if (uiSettings.glassOpacity === 100 && uiSettings.glassBlur === 0) {
    uiSettings.glassStyle = 'opaque';
  } else {
    uiSettings.glassStyle = 'custom';
  }
}

const activePresetToggleValue = computed(() => {
  return uiSettings.glassStyle === 'custom' ? '' : uiSettings.glassStyle;
});

const previewStyle = computed(() => {
  const { opacity, blur } = computeGlassCssValues(
    uiSettings.glassStyle,
    uiSettings.glassOpacity,
    uiSettings.glassBlur
  );
  return {
    '--preview-glass-opacity': String(opacity),
    '--preview-glass-blur': `${blur}px`,
  };
});
</script>

<template>
  <Card>
    <SettingsCardHeader
      title="Glass-Effekt & Transparenz"
      show-reset
      :is-default="isDefault"
      :reset-title="isDefault ? 'Bereits auf Standard-Glas-Effekt' : 'Auf Standard zurücksetzen'"
      @reset="resetGlass"
    />
    <p class="hint">
      Passe das Erscheinungsbild der schwebenden Navigationsleiste und Overlays an. Wähle zwischen
      Klassischem Glas, mattem Milchglas (Frosted), komplett blickdicht (Solide) oder passe die
      Werte direkt per Schieberegler an.
    </p>

    <!-- Voreinstellungen (Presets) -->
    <div class="preset-toggle-wrap">
      <SegmentedToggle
        :model-value="activePresetToggleValue"
        :options="GLASS_OPTIONS"
        @update:model-value="selectPreset"
      />
    </div>

    <!-- Schieberegler (immer sichtbar) -->
    <div class="sliders-wrap">
      <div class="slider-row">
        <div class="slider-header">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="glass-opacity-slider">Deckkraft (Opazität)</label>
          <span class="slider-value">{{ uiSettings.glassOpacity }}%</span>
        </div>
        <input
          id="glass-opacity-slider"
          type="range"
          min="20"
          max="100"
          step="1"
          v-model.number="uiSettings.glassOpacity"
          @input="onSliderChange"
          class="range-input"
        />
      </div>

      <div class="slider-row">
        <div class="slider-header">
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label for="glass-blur-slider">Weichzeichner (Blur)</label>
          <span class="slider-value">{{ uiSettings.glassBlur }}px</span>
        </div>
        <input
          id="glass-blur-slider"
          type="range"
          min="0"
          max="30"
          step="1"
          v-model.number="uiSettings.glassBlur"
          @input="onSliderChange"
          class="range-input"
        />
      </div>
    </div>

    <!-- Interaktiver Live-Vorschau-Kasten -->
    <div class="preview-stage">
      <div class="preview-bg-content">
        <!-- 1-2 Zeilen über der Navigationsleiste -->
        <div class="bg-row header-row">
          <span class="preview-badge">🏖️ Sommerurlaub 2026</span>
          <span class="preview-tag success">☀️ 28°C Sonnig</span>
        </div>
        <div class="bg-row text-row">
          <span>📍 Strandpromenade • 🍕 Trattoria Bella • 🚲 14:00 E-Bike Tour</span>
        </div>

        <!-- Bunte Inhalte direkt hinter der schwebenden Leiste zur Visualisierung von Opazität & Blur -->
        <div class="bg-row text-row underlay-row">
          <span>🏰 Torre de Belém • 🥐 Pastéis de Nata • 🍷 Vinho Verde</span>
        </div>
        <div class="bg-row underlay-sub">
          <span class="preview-tag warning">📸 Fotospot</span>
          <span class="text-row">🗺️ Altstadt-Tour • 🎒 4/6 gepackt</span>
        </div>
      </div>

      <div class="preview-glass-pill" :style="previewStyle">
        <div class="preview-pill-item active">
          <AppIcon :icon="SECTION_ICON_DEFS.dashboard" :size="18" group="navigation" />
          <span>Übersicht</span>
        </div>
        <div class="preview-pill-item">
          <AppIcon :icon="SECTION_ICON_DEFS.todo" :size="18" group="navigation" />
          <span>Listen</span>
        </div>
        <div class="preview-pill-item">
          <AppIcon :icon="SECTION_ICON_DEFS.budget" :size="18" group="navigation" />
          <span>Budget</span>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.sliders-wrap {
  margin-top: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
  @include surface-sunken-box;
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);
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
  border-radius: var(--radius-pill);
}

.range-input:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
  border-radius: var(--radius-pill);
}

.preview-stage {
  position: relative;
  margin-top: var(--space-xl);
  padding: var(--space-lg) var(--space-lg) var(--space-xl);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: linear-gradient(135deg, #fef3c7 0%, #dbeafe 50%, #fce7f3 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 165px;
}

:root[data-theme='dark'] .preview-stage {
  background: linear-gradient(135deg, #2a2115 0%, #17253d 50%, #2b172a 100%);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .preview-stage {
    background: linear-gradient(135deg, #2a2115 0%, #17253d 50%, #2b172a 100%);
  }
}

.preview-bg-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  text-align: center;
  pointer-events: none;
  user-select: none;
  padding-top: var(--space-2xs);
}

.bg-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  line-height: var(--line-height-snug);
}

.text-row {
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.underlay-row {
  font-weight: 600;
  color: var(--color-primary-dark);
  font-size: var(--font-size-sm);
  margin-top: var(--space-2xs);
}

.underlay-sub {
  font-size: var(--font-size-sm);
}

.preview-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.preview-tag.warning {
  background: #fef3c7;
  color: #92400e;
}

.preview-tag.success {
  background: #dcfce7;
  color: #166534;
}

.preview-badge {
  background: #e0f2fe;
  color: #075985;
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.preview-glass-pill {
  position: absolute;
  bottom: var(--space-md);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding: var(--space-sm) var(--space-xl);
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  background: rgb(255 255 255 / var(--preview-glass-opacity, 0.42));
  border: 1px solid rgb(232 226 217 / calc(var(--preview-glass-opacity, 0.42) * 0.9));
  backdrop-filter: blur(var(--preview-glass-blur, 6px)) saturate(180%);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    backdrop-filter 0.2s ease;
  z-index: 2;
  white-space: nowrap;
}

:root[data-theme='dark'] .preview-glass-pill,
[data-theme='dark'] .preview-glass-pill {
  background: rgb(35 34 32 / var(--preview-glass-opacity, 0.42));
  border-color: rgb(56 53 47 / calc(var(--preview-glass-opacity, 0.42) * 0.9));
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .preview-glass-pill {
    background: rgb(35 34 32 / var(--preview-glass-opacity, 0.42));
    border-color: rgb(56 53 47 / calc(var(--preview-glass-opacity, 0.42) * 0.9));
  }
}

.preview-pill-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.preview-pill-item.active {
  color: var(--color-primary);
}
</style>
