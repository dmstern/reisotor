<script setup lang="ts">
import { computed } from 'vue';
import type { IdeaRole } from '../api/types';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import { TOUR_ROLE_META, type TourRoleFilterOption } from '../utils/travelRole';

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
</script>

<template>
  <Badge variant="custom" class="tour-type-badge" :title="meta.label">
    <AppIcon :icon="meta.tabler" :size="size" group="categories" />
    {{ meta.label }}
  </Badge>
</template>

<style scoped>
.tour-type-badge {
  flex-shrink: 0;
  --badge-bg: var(--excursion-theme-tint);
  --badge-color: var(--excursion-theme-color);
  --badge-border: var(--excursion-theme-border);
}
</style>
