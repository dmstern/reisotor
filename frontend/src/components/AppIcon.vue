<script setup lang="ts">
import { computed } from 'vue';
import { useIconStyleStore, type IconStyle, type IconVariant } from '../stores/iconStyle';
import { resolveIconComponent, type IconDef } from '../utils/icon';

// Zentrale Render-Stelle für ein "Konzept"-Icon (siehe utils/icon.ts) - ersetzt {{ someEmoji }} an
// jeder Stelle, die künftig zwischen Emoji und Tabler-Icons umschaltbar sein soll. forceStyle/
// forceVariant sind ausschließlich für die Vorschau-Karten in IconStyleSettings.vue gedacht, die
// beide Optionen gleichzeitig nebeneinander zeigen müssen, unabhängig vom aktuell aktiven Store-Wert.
const props = withDefaults(
  defineProps<{
    icon: IconDef;
    size?: number;
    forceStyle?: IconStyle;
    forceVariant?: IconVariant;
  }>(),
  { size: 20 },
);

const iconStyle = useIconStyleStore();
const component = computed(() =>
  resolveIconComponent(props.icon, props.forceStyle ?? iconStyle.style, props.forceVariant ?? iconStyle.variant),
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
  <component
    :is="component"
    v-else
    class="app-icon app-icon-tabler"
    :size="size"
    color="currentColor"
    aria-hidden="true"
  />
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
