<script setup lang="ts">
import { computed } from 'vue';
import { useIconStyleStore, type IconGroup, type IconStyle, type IconVariant } from '../stores/iconStyle';
import { resolveIconComponent, type IconDef } from '../utils/icon';

// Zentrale Render-Stelle für ein "Konzept"-Icon (siehe utils/icon.ts) - ersetzt {{ someEmoji }} an
// jeder Stelle, die künftig zwischen Emoji und Tabler-Icons umschaltbar sein soll. `group` ordnet
// die Aufrufstelle einem der ICON_GROUP_OPTIONS zu (stores/iconStyle.ts) - Nutzer:innen können den
// Icon-Stil pro Bereich abweichend vom globalen Default einstellen (IconStyleSettings.vue), z. B.
// Kategorien auf Symbole, Navigation weiter auf Emoji. forceStyle/forceVariant sind ausschließlich
// für die Vorschau-Karten in IconStyleSettings.vue gedacht, die mehrere Optionen gleichzeitig
// nebeneinander zeigen müssen, unabhängig vom aktuell aktiven Store-Wert. `color` überschreibt das
// Standard-`currentColor` (z. B. DashboardView.vue's Kachel-Akzentfarben, siehe utils/widgetColors.ts).
const props = withDefaults(
  defineProps<{
    icon: IconDef;
    group: IconGroup;
    size?: number;
    color?: string;
    forceStyle?: IconStyle;
    forceVariant?: IconVariant;
  }>(),
  { size: 20, color: 'currentColor' },
);

const iconStyle = useIconStyleStore();
const component = computed(() =>
  resolveIconComponent(
    props.icon,
    props.forceStyle ?? iconStyle.styleForGroup(props.group),
    props.forceVariant ?? iconStyle.styleVariantForGroup(props.group),
  ),
);
</script>

<template>
  <span
    v-if="!component"
    class="app-icon app-icon-emoji"
    :style="{ fontSize: size + 'px' }"
    aria-hidden="true"
    >{{ icon.emoji }}</span
  >
  <component :is="component" v-else class="app-icon app-icon-tabler" :size="size" :color="color" aria-hidden="true" />
</template>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
}
</style>
