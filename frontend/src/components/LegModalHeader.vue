<script setup lang="ts">
import type { Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import { spotCategoryMeta } from '../utils/spotCategory';

defineProps<{
  fromSpot?: Spot | null;
  toSpot?: Spot | null;
}>();
</script>

<template>
  <span class="leg-modal-title">
    <span>Teilstrecke:</span>
    <span class="leg-modal-spot">
      <AppIcon
        v-if="fromSpot"
        :icon="spotCategoryMeta(fromSpot.category).tabler"
        :size="18"
        group="categories"
      />
      <span class="leg-modal-spot-name">{{ fromSpot?.title || 'Start' }}</span>
    </span>
    <span class="leg-modal-arrow" aria-hidden="true">→</span>
    <span class="leg-modal-spot">
      <AppIcon
        v-if="toSpot"
        :icon="spotCategoryMeta(toSpot.category).tabler"
        :size="18"
        group="categories"
      />
      <span class="leg-modal-spot-name">{{ toSpot?.title || 'Ziel' }}</span>
    </span>
  </span>
</template>

<style scoped>
.leg-modal-title {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
}

.leg-modal-spot {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.leg-modal-spot-name {
  word-break: break-word;
}

.leg-modal-arrow {
  color: var(--color-text-muted);
  font-weight: 700;
  flex-shrink: 0;
}
</style>
