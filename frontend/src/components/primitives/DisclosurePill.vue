<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    /** Darstellungsvariante: 'tonal' auf Kartenflächen, 'overlay' über Fotos. */
    variant?: 'tonal' | 'overlay';
    /** Ob die zugehörige Karte aktuell aufgeklappt ist (steuert Pfeilrichtung & Default-Label). */
    expanded?: boolean;
    /** Kompakte 26×26px-Kreisform ohne Text-Label. */
    compact?: boolean;
    /** Optionales benutzerdefiniertes Label (Standard: 'Einklappen' bzw. 'Details'). */
    label?: string;
  }>(),
  {
    variant: 'tonal',
    expanded: false,
    compact: false,
    label: undefined,
  }
);

const displayLabel = computed(() => props.label ?? (props.expanded ? 'Einklappen' : 'Details'));
</script>

<template>
  <span
    class="disclosure-pill"
    :class="[
      `disclosure-pill--${variant}`,
      {
        'is-compact': compact,
        'is-expanded': expanded,
      },
    ]"
    aria-hidden="true"
  >
    <span v-if="!compact" class="disclosure-label">{{ displayLabel }}</span>
    <AppIcon
      :icon="expanded ? ACTION_ICONS.chevronUp : ACTION_ICONS.chevronDown"
      :size="14"
      group="actions"
      class="disclosure-chevron"
    />
  </span>
</template>

<style scoped lang="scss">
.disclosure-pill--tonal {
  @include card-disclosure-pill('tonal');
}

.disclosure-pill--overlay {
  @include card-disclosure-pill('overlay');
}

.disclosure-chevron {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@include can-hover {
  .disclosure-pill--tonal:hover {
    @include card-disclosure-pill-hover('tonal');
  }

  .disclosure-pill--overlay:hover {
    @include card-disclosure-pill-hover('overlay');
  }
}

@media (prefers-reduced-motion: reduce) {
  .disclosure-pill,
  .disclosure-chevron {
    transform: none !important;
    translate: none !important;
    transition: opacity 0.15s ease !important;
  }
}
</style>
