<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ count: number; liked: boolean }>();
const emit = defineEmits<{ (e: 'toggle'): void }>();
</script>

<template>
  <!-- .stop hier statt an den Verwendungsstellen – siehe EditButton.vue für die Begründung
       (dort wäre der emittierte Payload undefined, .stop dort würde crashen). -->
  <button type="button" class="secondary like-btn" :class="{ liked }" @click.stop="emit('toggle')">
    <AppIcon :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked" :size="15" group="actions" />
    {{ count || '' }}
  </button>
</template>

<style scoped>
.like-btn.liked {
  border-color: var(--color-danger);
}
</style>
