<script setup lang="ts">
import { computed } from 'vue';
import {
  useIconStyleStore,
  ICON_GROUP_OPTIONS,
  type IconStyle,
  type IconVariant,
  type ConfigurableIconGroup,
} from '../stores/iconStyle';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Card from './primitives/Card.vue';
import SegmentedToggle from './SegmentedToggle.vue';

// Issue #74: die Bereichseinstellungen sind der zentrale, immer sichtbare Teil dieser Karte
// geworden (kein <details> mehr) - der "für alle Bereiche umstellen"-Umschalter oben in der
// Tabelle ist bewusst KEIN eigener persistenter Zustand, sondern nur ein Bulk-Setter
// (iconStyle.setAllGroups) auf die einzelnen Bereichs-Werte darunter.
const iconStyle = useIconStyleStore();

const PREVIEW_ICONS = [
  SECTION_ICON_DEFS.calendar,
  SECTION_ICON_DEFS.budget,
  FORM_FIELD_ICONS.location,
];
// Ein einzelnes, immer gleiches Beispiel-Icon für die Emoji/Symbole- bzw. Outline/Gefüllt-Toggles
// je Bereich (statt eines bereichs-spezifischen Icons) - der Bereich ist schon per Zeilen-Label
// benannt, das Beispiel-Icon soll nur zeigen, WIE die jeweilige Option aussieht.
const DEMO_ICON = SECTION_ICON_DEFS.calendar;

// forceStyle/forceVariant sorgen dafür, dass jede Option IMMER ihre eigene Darstellung zeigt
// (unabhängig vom aktuell aktiven Wert) - gleiches Prinzip wie die große Vorschau oben.
const STYLE_OPTIONS = [
  {
    value: 'emoji',
    label: 'Emoji',
    icon: DEMO_ICON,
    iconGroup: 'navigation' as ConfigurableIconGroup,
    forceStyle: 'emoji' as IconStyle,
  },
  {
    value: 'icons',
    label: 'Symbole',
    icon: DEMO_ICON,
    iconGroup: 'navigation' as ConfigurableIconGroup,
    forceStyle: 'icons' as IconStyle,
  },
];
const VARIANT_OPTIONS = [
  {
    value: 'outline',
    label: 'Outline',
    icon: DEMO_ICON,
    iconGroup: 'navigation' as ConfigurableIconGroup,
    forceStyle: 'icons' as IconStyle,
    forceVariant: 'outline' as IconVariant,
  },
  {
    value: 'filled',
    label: 'Gefüllt',
    icon: DEMO_ICON,
    iconGroup: 'navigation' as ConfigurableIconGroup,
    forceStyle: 'icons' as IconStyle,
    forceVariant: 'filled' as IconVariant,
  },
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
const categoriesColorRelevant = computed(() => iconStyle.groups.categories === 'icons');
</script>

<template>
  <Card>
    <h2>Icons</h2>
    <p class="hint">
      Emoji oder Symbole für Navigation, Kategorien und Wetter – dein Profilbild bleibt davon
      unberührt. Formularfelder und Aktionen/Buttons zeigen immer Symbole.
    </p>

    <div class="icon-style-preview-row">
      <div class="icon-style-preview">
        <span class="icon-style-preview-icons">
          <AppIcon
            v-for="icon in PREVIEW_ICONS"
            :key="icon.id"
            :icon="icon"
            group="navigation"
            force-style="emoji"
            :size="22"
          />
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
            @update:model-value="
              (v) =>
                iconStyle.setGroupOverride(group.value as ConfigurableIconGroup, v as IconStyle)
            "
          />
        </div>
        <div
          v-if="iconStyle.groups[group.value] === 'icons'"
          class="group-override-row variant-row"
        >
          <span class="group-override-label">Stil</span>
          <SegmentedToggle
            :model-value="iconStyle.variants[group.value]"
            :options="VARIANT_OPTIONS"
            @update:model-value="
              (v) =>
                iconStyle.setGroupVariant(group.value as ConfigurableIconGroup, v as IconVariant)
            "
          />
        </div>
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
        <label
          v-if="group.value === 'navigation'"
          class="colorize-row"
          :class="{ dimmed: !navColorRelevant }"
        >
          <input type="checkbox" v-model="iconStyle.navColored" />
          <span>
            Icons in der Navigation einfärben
            <span class="hint">
              Nutzt dieselben Akzentfarben wie die Dashboard-Kacheln – wirkt sich nur aus, wenn die
              Navigation auf Symbole steht (aktuell{{ navColorRelevant ? '' : ' nicht' }} der Fall).
            </span>
          </span>
        </label>
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
        <label
          v-if="group.value === 'weather'"
          class="colorize-row"
          :class="{ dimmed: !weatherColorRelevant }"
        >
          <input type="checkbox" v-model="iconStyle.colorizeWeather" />
          <span>
            Wetter-Icons passend einfärben
            <span class="hint">
              Sonne gelb, Wolken grau, Regen blau, Blitze gelb, … – wirkt sich nur aus, wenn Wetter
              auf Symbole steht (aktuell{{ weatherColorRelevant ? '' : ' nicht' }} der Fall).
            </span>
          </span>
        </label>
        <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
        <label
          v-if="group.value === 'categories'"
          class="colorize-row"
          :class="{ dimmed: !categoriesColorRelevant }"
        >
          <input type="checkbox" v-model="iconStyle.colorizeCategories" />
          <span>
            Kategorie-Icons einfärben
            <span class="hint">
              Färbt die Icons in Kategorie-Überschriften und der Kategorie-Navigation in derselben
              Akzentfarbe wie die bunten Kategorie-Badges (die sind immer eingefärbt) – wirkt sich
              nur aus, wenn Kategorien auf Symbole stehen (aktuell{{
                categoriesColorRelevant ? '' : ' nicht'
              }}
              der Fall).
            </span>
          </span>
        </label>
      </template>
    </div>

    <Button variant="secondary" class="reset-button" @click="iconStyle.resetToDefaults()">
      <AppIcon :icon="ACTION_ICONS.refresh" :size="16" group="actions" />
      Auf Standard-Einstellungen zurücksetzen
    </Button>
  </Card>
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
  border: var(--ui-border-width, 1px) solid var(--color-border);
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

/* container statt globalem @media: betrifft nur die Toggles dieser Karte, nicht die vielen
   anderen SegmentedToggle-Stellen in der App (gleiches Prinzip wie SpotCard.vue's
   @container spots-col). */
.group-overrides {
  margin-top: var(--space-4);
  container-type: inline-size;
}

/* grid statt flex+space-between: der Toggle bleibt IMMER in der rechten Spalte fixiert, auch wenn
   das Label lang ist und in eine zweite Zeile umbricht - vorher landete der Toggle je nach Umbruch
   mal rechts, mal links (space-between mit nur einem Element auf der zweiten Zeile). */
.group-override-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.all-groups-row {
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-2);
  border-bottom: var(--ui-border-width, 1px) solid var(--color-border);
}

.all-groups-row .group-override-label {
  font-weight: 700;
  color: var(--color-text);
}

.variant-row {
  margin-top: var(--space-1);
  opacity: 0.85;
}

.variant-row .group-override-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.group-override-label {
  font-size: 0.85rem;
  color: var(--color-text);
}

/* Auf schmalen Karten (Mobil) das Wort-Label der Toggle-Optionen ausblenden, nur das Beispiel-Icon
   bleibt - spart die Breite, die sonst zum Umbruch/Missalignment der Zeile geführt hat. */
@container (max-width: 380px) {
  .group-override-row :deep(.segmented-option-label) {
    display: none;
  }
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

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding: var(--space-2) var(--space-3);
  font-size: 0.85rem;
}
</style>
