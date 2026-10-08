<script setup lang="ts">
defineProps<{
  active: boolean;
  to: string;
}>();
</script>

<template>
  <Teleport v-if="active" :to="to">
    <slot />
  </Teleport>
  <slot v-else />
</template>
