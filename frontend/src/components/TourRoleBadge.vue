<script setup lang="ts">
import { computed } from 'vue';
import type { IdeaRole } from '../api/types';
import CategoryChip from './CategoryChip.vue';
import { TOUR_ROLE_META, type TourRoleFilterOption } from '../utils/travelRole';
import { TOUR_COLOR, TRAVEL_COLOR } from '../utils/scheduleCategory';

const props = withDefaults(
  defineProps<{
    role?: IdeaRole | TourRoleFilterOption | '' | null;
    size?: number;
  }>(),
  {
    role: null,
    size: 14,
  }
);

const meta = computed(() => {
  return (props.role && TOUR_ROLE_META[props.role]) || TOUR_ROLE_META.excursion;
});

const customMeta = computed(() => {
  const isTravel = props.role && props.role !== 'excursion';
  return {
    label: meta.value.label,
    icon: meta.value.icon,
    color: isTravel
      ? 'var(--color-travel, ' + TRAVEL_COLOR + ')'
      : 'var(--color-tour, ' + TOUR_COLOR + ')',
    tabler: meta.value.tabler,
  };
});
</script>

<template>
  <CategoryChip
    class="tour-type-badge"
    :category="meta.label"
    :custom-meta="customMeta"
    :size="size"
  />
</template>

<style scoped>
.tour-type-badge {
  flex-shrink: 0;
}
</style>
