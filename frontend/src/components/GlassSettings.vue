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
  if (preset) {
    uiSettings.glassOpacity = preset.opacity;
    uiSettings.glassBlur = preset.blur;
    uiSettings.glassStyle = style;
  }
}

function onSliderChange() {
  if (uiSettings.glassOpacity === 55 && uiSettings.glassBlur === 6) {
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
    background: `rgb(255 255 255 / ${opacity})`,
    backdropFilter: `blur(${blur}px) saturate(180%)`,
    webkitBackdropFilter: `blur(${blur}px) saturate(180%)`,
    border: `1px solid rgb(232 226 217 / ${Math.min(1, opacity * 0.9)})`,
  };
});
</script>

<template>
  <Card>
    <h2>Glass-Effekt & Transparenz</h2>
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
        <div class="bg-row header-row">
          <span class="preview-tag warning">🔥 Extreme Hitze 36°C</span>
          <span class="preview-tag success">✓ Budget im Grünen</span>
          <span class="preview-badge">🏖️ Sommerurlaub 2026</span>
        </div>
        <div class="bg-row text-row">
          <span>🏝️ Strandpromenade • 🍕 Trattoria Bella • 🚲 E-Bike Tour 14:00 Uhr</span>
        </div>
        <div class="bg-row text-row text-row-sub">
          <span>🧳 Packliste: Sonnencreme, Badehose, Reisepass, Kamera 📸</span>
        </div>
        <div class="bg-row icon-pattern-row">
          <span>✈️ 🗺️ 🏨 🧭 🌊 ☀️ 🌴 🍹 🎒 🧗 ⛵ 🚴 📍 🎟️ 📸</span>
        </div>
        <div class="bg-row text-row pill-underlay-text">
          <span>📍 Lisboa • 🏰 Torre de Belém • 🥐 Pastéis de Nátas • 🍷 Vinho Verde</span>
        </div>
        <div class="bg-row icon-pattern-row pill-underlay-icons">
          <span>🏖️ 🍕 🍷 🥐 ⛵ 🚴 🏖️ 🍕 🍷 🥐 ⛵ 🚴</span>
        </div>
        <div class="bg-row text-row pill-underlay-text">
          <span>🍕 Trattoria Bella • ☀️ Sonnenschein 28°C • 🗺️ Stadtplan</span>
        </div>
        <div class="bg-row icon-pattern-row pill-underlay-icons">
          <span>✈️ 🗺️ 🏨 🧭 🌊 ☀️ 🌴 🍹 🎒 🧗 ⛵ 🚴 📍 🎟️ 📸</span>
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

<style scoped>
.preset-toggle-wrap {
  margin-top: var(--space-3);
}

.sliders-wrap {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-hover);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  border: var(--ui-border-width, 1px) solid var(--color-border);
}

.slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.preview-stage {
  position: relative;
  margin-top: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: linear-gradient(135deg, #fef3c7 0%, #dbeafe 50%, #fce7f3 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  min-height: 220px;
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
  gap: 6px;
  width: 100%;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: center;
  pointer-events: none;
  user-select: none;
}

.bg-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  line-height: 1.3;
}

.text-row {
  color: var(--color-text);
  font-size: 0.82rem;
}

.text-row-sub {
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.pill-underlay-text {
  font-weight: 700;
  color: var(--color-primary-dark);
  font-size: 0.85rem;
  margin-top: 2px;
}

.pill-underlay-icons {
  font-size: 1.25rem;
  letter-spacing: 0.15em;
  opacity: 1;
}

.icon-pattern-row {
  font-size: 1.15rem;
  letter-spacing: 0.15em;
  opacity: 0.9;
  margin-top: 2px;
}

.preview-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
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
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}

.preview-glass-pill {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 10px 24px;
  border-radius: 999px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  transition:
    background 0.2s ease,
    backdrop-filter 0.2s ease;
  z-index: 2;
  white-space: nowrap;
}

.preview-pill-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.preview-pill-item.active {
  color: var(--color-primary);
}
</style>
