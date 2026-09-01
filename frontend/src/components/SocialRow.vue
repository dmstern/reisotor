<script setup lang="ts">
import LikeButton from './LikeButton.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{ likeCount: number; liked: boolean; commentCount: number }>();
const emit = defineEmits<{ (e: 'toggle-like'): void; (e: 'toggle-comments'): void }>();
</script>

<template>
  <div class="social-row">
    <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
    <Button
      variant="secondary"
      size="sm"
      class="comment-btn"
      aria-label="Kommentare anzeigen"
      title="Kommentare"
      @click.stop="emit('toggle-comments')"
    >
      <AppIcon :icon="ACTION_ICONS.comment" :size="15" group="actions" /> {{ commentCount || '' }}
    </Button>
  </div>
</template>

<style scoped>
.social-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
