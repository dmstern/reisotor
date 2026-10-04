<script setup lang="ts">
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
  <Teleport v-if="active" :to="to">
    <slot />
  </Teleport>
  <slot v-else />
</template>
