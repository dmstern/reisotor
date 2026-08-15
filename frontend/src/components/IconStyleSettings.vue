<script setup lang="ts">
import { useIconStyleStore, ICON_VARIANT_OPTIONS, type IconVariant } from '../stores/iconStyle';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import SegmentedToggle from './SegmentedToggle.vue';

// Eigene Vorschau-Karten statt eines reinen <select> (anders als z. B. WEEK_START_OPTIONS/
// DATE_FORMAT_OPTIONS in ProfileView.vue) - der Witz dieser Einstellung ist, den Unterschied
// tatsächlich zu SEHEN, nicht nur eine Text-Beschriftung zu lesen. forceStyle auf AppIcon.vue
// zeigt beide Optionen nebeneinander, unabhängig vom gerade aktiven Store-Wert.
const iconStyle = useIconStyleStore();

const PREVIEW_ICONS = [SECTION_ICON_DEFS.calendar, SECTION_ICON_DEFS.budget, FORM_FIELD_ICONS.location];
</script>

<template>
  <div class="card">
    <h2>Icons</h2>
    <p class="hint">
      Emoji oder Symbole für Navigation, Kategorien und Formulare – dein Profilbild bleibt davon unberührt.
    </p>
    <div class="icon-style-preview-row">
      <button
        type="button"
        class="icon-style-preview"
        :class="{ active: iconStyle.style === 'emoji' }"
        :aria-pressed="iconStyle.style === 'emoji'"
        @click="iconStyle.style = 'emoji'"
      >
        <span class="icon-style-preview-icons">
          <AppIcon v-for="icon in PREVIEW_ICONS" :key="icon.id" :icon="icon" force-style="emoji" :size="22" />
        </span>
        <span class="icon-style-preview-label">Emoji</span>
      </button>
      <button
        type="button"
        class="icon-style-preview"
        :class="{ active: iconStyle.style === 'icons' }"
        :aria-pressed="iconStyle.style === 'icons'"
        @click="iconStyle.style = 'icons'"
      >
        <span class="icon-style-preview-icons">
          <AppIcon
            v-for="icon in PREVIEW_ICONS"
            :key="icon.id"
            :icon="icon"
            force-style="icons"
            :force-variant="iconStyle.variant"
            :size="22"
          />
        </span>
        <span class="icon-style-preview-label">Symbole (Tabler)</span>
      </button>
    </div>

    <div v-if="iconStyle.style === 'icons'" class="icon-variant-row">
      <span class="icon-variant-label">Stil</span>
      <SegmentedToggle
        :model-value="iconStyle.variant"
        :options="[...ICON_VARIANT_OPTIONS]"
        @update:model-value="(v) => (iconStyle.variant = v as IconVariant)"
      />
    </div>
  </div>
</template>

<style scoped>
.icon-style-preview-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
}

.icon-style-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.icon-style-preview.active {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.icon-style-preview-icons {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-primary-dark);
}

.icon-style-preview-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.icon-style-preview.active .icon-style-preview-label {
  color: var(--color-primary-dark);
}

.icon-variant-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.icon-variant-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
</style>
