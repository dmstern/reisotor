<script setup lang="ts">
defineProps<{ count: number; liked: boolean }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <button type="button" class="secondary like-btn" :class="{ liked }" @click="emit('toggle')">
    {{ liked ? '❤️' : '🤍' }} {{ count || '' }}
  </button>
</template>

<style scoped>
.like-btn.liked {
  border-color: var(--color-danger);
}
</style>
