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

// Issue #74: die Bereichseinstellungen sind der zentrale, immer sichtbare Teil dieser Karte
// geworden (kein <details> mehr) - der "für alle Bereiche umstellen"-Umschalter oben in der
// Tabelle ist bewusst KEIN eigener persistenter Zustand, sondern nur ein Bulk-Setter
// (iconStyle.setAllGroups) auf die einzelnen Bereichs-Werte darunter.
const iconStyle = useIconStyleStore();

const PREVIEW_ICONS = [SECTION_ICON_DEFS.calendar, SECTION_ICON_DEFS.budget, FORM_FIELD_ICONS.location];

const STYLE_OPTIONS = [
  { value: 'emoji', label: 'Emoji' },
  { value: 'icons', label: 'Symbole' },
];

// '' statt eines der beiden Werte, wenn die Bereiche aktuell unterschiedlich eingestellt sind -
// SegmentedToggle blendet die Pille dann komplett aus (siehe dortiger activeIndex-Kommentar),
// statt fälschlich eine der beiden Optionen als "aktiv" zu zeigen.
const allGroupsValue = computed(() => {
  const values = ICON_GROUP_OPTIONS.map((g) => iconStyle.groups[g.value]);
  return values.every((v) => v === values[0]) ? values[0] : '';
});

const navColorRelevant = computed(() => iconStyle.groups.navigation === 'icons');
const weatherColorRelevant = computed(() => iconStyle.groups.weather === 'icons');
const anyGroupUsesIcons = computed(() => Object.values(iconStyle.groups).some((v) => v === 'icons'));
</script>

<template>
  <div class="card">
    <h2>Icons</h2>
    <p class="hint">
      Emoji oder Symbole für Navigation, Kategorien und Formulare – dein Profilbild bleibt davon unberührt.
    </p>

    <div class="icon-style-preview-row">
      <div class="icon-style-preview">
        <span class="icon-style-preview-icons">
          <AppIcon v-for="icon in PREVIEW_ICONS" :key="icon.id" :icon="icon" group="navigation" force-style="emoji" :size="22" />
        </span>
        <span class="icon-style-preview-label">Emoji</span>
      </div>
      <div class="icon-style-preview">
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
      </div>
    </div>

    <div class="group-overrides">
      <div class="group-override-row all-groups-row">
        <span class="group-override-label">Für alle Bereiche umstellen</span>
        <SegmentedToggle
          :model-value="allGroupsValue"
          :options="STYLE_OPTIONS"
          @update:model-value="(v) => iconStyle.setAllGroups(v as IconStyle)"
        />
      </div>

      <template v-for="group in ICON_GROUP_OPTIONS" :key="group.value">
        <div class="group-override-row">
          <span class="group-override-label">{{ group.label }}</span>
          <SegmentedToggle
            :model-value="iconStyle.groups[group.value]"
            :options="STYLE_OPTIONS"
            @update:model-value="(v) => iconStyle.setGroupOverride(group.value as IconGroup, v as IconStyle)"
          />
        </div>
        <label v-if="group.value === 'navigation'" class="colorize-row" :class="{ dimmed: !navColorRelevant }">
          <input type="checkbox" v-model="iconStyle.navColored" />
          <span>
            Icons in der Navigation einfärben
            <span class="hint">
              Nutzt dieselben Akzentfarben wie die Dashboard-Kacheln – wirkt sich nur aus, wenn die
              Navigation auf Symbole steht (aktuell{{ navColorRelevant ? '' : ' nicht' }} der Fall).
            </span>
          </span>
        </label>
        <label v-if="group.value === 'weather'" class="colorize-row" :class="{ dimmed: !weatherColorRelevant }">
          <input type="checkbox" v-model="iconStyle.colorizeWeather" />
          <span>
            Wetter-Icons passend einfärben
            <span class="hint">
              Sonne gelb, Wolken grau, Regen blau, Blitze gelb, … – wirkt sich nur aus, wenn Wetter
              auf Symbole steht (aktuell{{ weatherColorRelevant ? '' : ' nicht' }} der Fall).
            </span>
          </span>
        </label>
      </template>
    </div>

    <div v-if="anyGroupUsesIcons" class="icon-variant-row">
      <span class="icon-variant-label">Stil</span>
      <SegmentedToggle
        :model-value="iconStyle.variant"
        :options="[...ICON_VARIANT_OPTIONS]"
        @update:model-value="(v) => (iconStyle.variant = v as IconVariant)"
      />
    </div>

    <button type="button" class="secondary reset-button" @click="iconStyle.resetToDefaults()">
      Auf Standard-Einstellungen zurücksetzen
    </button>
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

.group-overrides {
  margin-top: var(--space-4);
}

.group-override-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.all-groups-row {
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.all-groups-row .group-override-label {
  font-weight: 700;
  color: var(--color-text);
}

.group-override-label {
  font-size: 0.85rem;
  color: var(--color-text);
}

.colorize-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: var(--space-1) 0 var(--space-2) 0;
  cursor: pointer;
}

.colorize-row input {
  margin-top: 3px;
  flex-shrink: 0;
}

.colorize-row .hint {
  display: block;
  margin-top: 2px;
}

.colorize-row.dimmed {
  opacity: 0.7;
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

.reset-button {
  margin-top: var(--space-4);
  padding: var(--space-2) var(--space-3);
  font-size: 0.85rem;
}
</style>
