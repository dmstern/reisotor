<script setup lang="ts">
defineProps<{ count: number; liked: boolean }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <!-- .stop hier statt an den Verwendungsstellen – siehe EditButton.vue für die Begründung
       (dort wäre der emittierte Payload undefined, .stop dort würde crashen). -->
  <button type="button" class="secondary like-btn" :class="{ liked }" @click.stop="emit('toggle')">
    {{ liked ? '❤️' : '🤍' }} {{ count || '' }}
  </button>
</template>

<style scoped>
.like-btn.liked {
  border-color: var(--color-danger);
}
</style>
