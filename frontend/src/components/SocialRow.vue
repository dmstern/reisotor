<script setup lang="ts">
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

withDefaults(
  defineProps<{
    likeCount: number;
    liked: boolean;
    commentCount: number;
    commentsOpen?: boolean;
    active?: boolean;
  }>(),
  {
    commentsOpen: false,
    active: false,
  }
);

const emit = defineEmits<{ (e: 'toggle-like'): void; (e: 'toggle-comments'): void }>();
</script>

<template>
  <div class="card-social-actions social-row">
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="comment-btn"
      :class="{ 'has-comments': commentCount > 0, active: active || commentsOpen }"
      :aria-label="commentsOpen || active ? 'Kommentare ausblenden' : 'Kommentare anzeigen'"
      :title="commentCount ? `${commentCount} Kommentare` : 'Kommentar schreiben'"
      @click.stop="emit('toggle-comments')"
    >
      <AppIcon :icon="ACTION_ICONS.comment" :size="15" group="actions" />
      <span v-if="commentCount > 0" class="social-count">{{ commentCount }}</span>
    </Button>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="like-btn"
      :class="{ liked }"
      :aria-label="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
      :title="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
      @click.stop="emit('toggle-like')"
    >
      <AppIcon
        :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked"
        :size="15"
        group="actions"
      />
      <span v-if="likeCount > 0" class="social-count">{{ likeCount }}</span>
    </Button>
  </div>
</template>

<style scoped>
.card-social-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  flex-shrink: 0;
}

.like-btn,
.comment-btn {
  color: var(--color-text-muted);
}

.like-btn.liked {
  color: var(--color-like);
}

.like-btn.liked:hover {
  background: var(--color-like-tint);
}

.comment-btn.active,
.comment-btn.has-comments {
  color: var(--color-primary);
}

.social-count {
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 2px;
}
</style>
