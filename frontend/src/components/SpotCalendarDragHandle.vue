<script setup lang="ts">
import type { Spot } from '../api/types';
import CalendarDragHandle from './CalendarDragHandle.vue';

defineProps<{
  spot: Spot;
}>();
</script>

<template>
  <CalendarDragHandle :spot="spot" />
</template>
