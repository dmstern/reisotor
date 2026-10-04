<script setup lang="ts">
import DockTeleport from './primitives/DockTeleport.vue';

withDefaults(
  defineProps<{
    active: boolean;
    to?: string;
  }>(),
  {
    to: '#map-focus-dock',
  }
);
</script>

<template>
  <DockTeleport :active="active" :to="to">
    <slot />
  </DockTeleport>
</template>
