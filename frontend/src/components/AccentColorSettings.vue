<script setup lang="ts">
import { computed } from 'vue';
import {
  useUiSettingsStore,
  PRIMARY_COLOR_PRESETS,
  DEFAULT_PRIMARY_COLOR,
} from '../stores/uiSettings';
import Button from './primitives/Button.vue';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import SettingsCardHeader from './settings/SettingsCardHeader.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

const uiSettings = useUiSettingsStore();

const isDefault = computed(() => {
  return uiSettings.primaryColor.toLowerCase() === DEFAULT_PRIMARY_COLOR.toLowerCase();
});

function resetColor() {
  uiSettings.primaryColor = DEFAULT_PRIMARY_COLOR;
}
</script>

<template>
  <Card>
    <SettingsCardHeader
      title="Akzentfarbe"
      show-reset
      :is-default="isDefault"
      :reset-title="isDefault ? 'Bereits auf Standard-Farbe' : 'Auf Standard zurücksetzen'"
      @reset="resetColor"
    />
    <p class="hint">
      Wähle deine persönliche Haupt-Akzentfarbe für Buttons, aktive Toggles, Links und Icons.
    </p>

    <!-- Farbauswahl-Grid -->
    <div class="color-presets-grid">
      <button
        v-for="preset in PRIMARY_COLOR_PRESETS"
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

    <!-- Live Demo Vorschau -->
    <div class="color-preview-stage">
      <div class="preview-header">
        <AppIcon :icon="SECTION_ICON_DEFS.dashboard" :size="20" group="navigation" />
        <span class="preview-title">Live Vorschau</span>
        <Badge variant="primary">Aktiv</Badge>
      </div>
      <div class="preview-actions">
        <Button variant="primary" size="sm">Primär-Button</Button>
        <Button variant="secondary" size="sm">Sekundär-Button</Button>
      </div>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.color-presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--space-sm);
}

.color-preset-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border: var(--border-width) solid var(--color-border-divider);
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
  border-radius: var(--radius-pill);
  background: var(--preset-color);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

.color-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-preview-stage {
  margin-top: var(--space-xl);
  padding: var(--space-lg);
  @include surface-sunken-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-primary);
}

.preview-title {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
  flex: 1;
}

.preview-actions {
  display: flex;
  gap: var(--space-sm);
}
</style>
