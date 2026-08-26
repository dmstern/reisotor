<script setup lang="ts">
import { computed } from 'vue';
import { useUiSettingsStore, type GlassStyle, computeGlassCssValues } from '../stores/uiSettings';
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

const uiSettings = useUiSettingsStore();

const GLASS_OPTIONS = [
  { value: 'glass', label: 'Glass' },
  { value: 'frosted', label: 'Frosted' },
  { value: 'opaque', label: 'Solide' },
  { value: 'custom', label: 'Anpassen' },
];

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
  <div class="card">
    <h2>Glass-Effekt & Transparenz</h2>
    <p class="hint">
      Passe das Erscheinungsbild der schwebenden Navigationsleiste und Overlays an. Wähle zwischen
      Klassischem Glas, mattem Milchglas (Frosted), komplett blickdicht (Solide) oder erstelle dein
      eigenes Muster per Schieberegler.
    </p>

    <div class="preset-toggle-wrap">
      <SegmentedToggle
        :model-value="uiSettings.glassStyle"
        :options="GLASS_OPTIONS"
        @update:model-value="(v) => (uiSettings.glassStyle = v as GlassStyle)"
      />
    </div>

    <!-- Interaktiver Live-Vorschau-Kasten -->
    <div class="preview-stage">
      <div class="preview-bg-text">
        <span class="preview-tag warning">Extreme Hitze 36°C</span>
        <span>Urlaub am Strand • 14. Juli • Sonnig • Packliste 12/15 erledigt</span>
      </div>
      <div class="preview-glass-pill" :style="previewStyle">
        <div class="preview-pill-item active">
          <AppIcon :icon="SECTION_ICON_DEFS.calendar" :size="16" group="navigation" />
          <span>Übersicht</span>
        </div>
        <div class="preview-pill-item">
          <AppIcon :icon="SECTION_ICON_DEFS.todo" :size="16" group="navigation" />
          <span>Listen</span>
        </div>
        <div class="preview-pill-item">
          <AppIcon :icon="SECTION_ICON_DEFS.budget" :size="16" group="navigation" />
          <span>Budget</span>
        </div>
      </div>
    </div>

    <!-- Regler nur im "Benutzerdefiniert"-Modus -->
    <div v-if="uiSettings.glassStyle === 'custom'" class="sliders-wrap">
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
          class="range-input"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.preset-toggle-wrap {
  margin-top: var(--space-3);
}

.preview-stage {
  position: relative;
  margin-top: var(--space-4);
  padding: var(--space-4) var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: linear-gradient(135deg, #fef3c7 0%, #dbeafe 50%, #fce7f3 100%);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 110px;
}

:root[data-theme='dark'] .preview-stage,
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .preview-stage {
    background: linear-gradient(135deg, #2a2115 0%, #17253d 50%, #2b172a 100%);
  }
}

.preview-bg-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: center;
  pointer-events: none;
  user-select: none;
}

.preview-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  background: #fef3c7;
  color: #92400e;
}

.preview-glass-pill {
  position: absolute;
  bottom: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 6px 16px;
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transition:
    background 0.2s ease,
    backdrop-filter 0.2s ease;
}

.preview-pill-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.preview-pill-item.active {
  color: var(--color-primary);
}

.sliders-wrap {
  margin-top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-hover);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
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
</style>
