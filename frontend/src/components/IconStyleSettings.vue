<script setup lang="ts">
import { computed } from 'vue';
import {
  useIconStyleStore,
  ICON_VARIANT_OPTIONS,
  ICON_GROUP_OPTIONS,
  type IconVariant,
  type IconStyle,
  type IconGroup,
} from '../stores/iconStyle';
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

// 'default' statt null/undefined als dritter SegmentedToggle-Wert, da dessen modelValue ein
// einfacher String sein muss (siehe SegmentedToggle.vue) - eigener Getter/Setter pro Bereich
// übersetzt das auf stores/iconStyle.ts's setGroupOverride()/styleForGroup().
const GROUP_OVERRIDE_OPTIONS = [
  { value: 'default', label: 'Standard' },
  { value: 'emoji', label: 'Emoji' },
  { value: 'icons', label: 'Symbole' },
];

function groupOverrideValue(group: IconGroup): string {
  return iconStyle.groupOverrides[group] ?? 'default';
}
function setGroupOverrideValue(group: IconGroup, value: string) {
  iconStyle.setGroupOverride(group, value === 'default' ? null : (value as IconStyle));
}

const navColorRelevant = computed(
  () => iconStyle.styleForGroup('navigation') === 'icons',
);
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
          <AppIcon v-for="icon in PREVIEW_ICONS" :key="icon.id" :icon="icon" group="navigation" force-style="emoji" :size="22" />
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
            group="navigation"
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

    <label class="nav-colored-row" :class="{ dimmed: !navColorRelevant }">
      <input type="checkbox" v-model="iconStyle.navColored" />
      <span>
        Icons in der Navigation einfärben
        <span class="hint">
          Nutzt dieselben Akzentfarben wie die Dashboard-Kacheln – wirkt sich nur aus, wenn die
          Navigation auf Symbole steht (aktuell{{ navColorRelevant ? '' : ' nicht' }} der Fall).
        </span>
      </span>
    </label>

    <details class="group-overrides">
      <summary>
        Für einzelne Bereiche anpassen
        <span v-if="iconStyle.hasGroupOverrides" class="override-badge">aktiv</span>
      </summary>
      <div class="group-override-row" v-for="group in ICON_GROUP_OPTIONS" :key="group.value">
        <span class="group-override-label">{{ group.label }}</span>
        <SegmentedToggle
          :model-value="groupOverrideValue(group.value)"
          :options="GROUP_OVERRIDE_OPTIONS"
          @update:model-value="(v) => setGroupOverrideValue(group.value, v)"
        />
      </div>
    </details>
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

.nav-colored-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-3);
  cursor: pointer;
}

.nav-colored-row input {
  margin-top: 3px;
  flex-shrink: 0;
}

.nav-colored-row .hint {
  display: block;
  margin-top: 2px;
}

.nav-colored-row.dimmed {
  opacity: 0.7;
}

.group-overrides {
  margin-top: var(--space-3);
}

.group-overrides summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.override-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  background: var(--color-primary);
  padding: 1px 8px;
  border-radius: 999px;
}

.group-override-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.group-override-label {
  font-size: 0.85rem;
  color: var(--color-text);
}
</style>
