<script setup lang="ts">
import { computed } from 'vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    likeCount: number;
    liked: boolean;
    commentCount?: number;
    commentsOpen?: boolean;
    active?: boolean;
    showCommentsButton?: boolean;
    /** Reiner Anzeigemodus (z. B. im Collapsed-Zustand von Karten): rendert keine klickbaren Buttons,
     *  sondern nur statische Info-Indikatoren sofern Likes oder Kommentare (> 0) vorhanden sind. */
    readonly?: boolean;
  }>(),
  {
    commentCount: 0,
    commentsOpen: false,
    active: false,
    showCommentsButton: true,
    readonly: false,
  }
);

const emit = defineEmits<{ (e: 'toggle-like'): void; (e: 'toggle-comments'): void }>();

const hasVisibleReadonlyItems = computed(
  () => (props.showCommentsButton && (props.commentCount ?? 0) > 0) || props.likeCount > 0
);
</script>

<template>
  <div
    v-if="!readonly || hasVisibleReadonlyItems"
    class="card-social-actions social-row"
    :class="{ 'is-readonly': readonly }"
  >
    <template v-if="readonly">
      <span
        v-if="showCommentsButton && (commentCount ?? 0) > 0"
        class="social-indicator comment-indicator has-comments"
        :title="`${commentCount} ${commentCount === 1 ? 'Kommentar' : 'Kommentare'}`"
      >
        <AppIcon :icon="ACTION_ICONS.comment" :size="14" group="actions" />
        <span class="social-count">{{ commentCount }}</span>
      </span>
      <span
        v-if="likeCount > 0"
        class="social-indicator like-indicator"
        :class="{ liked }"
        :title="`${likeCount} ${likeCount === 1 ? 'Person gefällt das' : 'Personen gefällt das'}`"
      >
        <AppIcon
          :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked"
          :size="14"
          group="actions"
        />
        <span class="social-count">{{ likeCount }}</span>
      </span>
    </template>
    <template v-else>
      <Button
        v-if="showCommentsButton"
        type="button"
        variant="ghost"
        size="sm"
        class="comment-btn"
        :class="{ 'has-comments': (commentCount ?? 0) > 0, active: active || commentsOpen }"
        :aria-label="commentsOpen || active ? 'Kommentare ausblenden' : 'Kommentare anzeigen'"
        :title="commentCount ? `${commentCount} Kommentare` : 'Kommentar schreiben'"
        @click.stop="emit('toggle-comments')"
      >
        <AppIcon
          :icon="ACTION_ICONS.comment"
          :active="commentsOpen || active"
          :size="15"
          group="actions"
        />
        <span v-if="(commentCount ?? 0) > 0" class="social-count">{{ commentCount }}</span>
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
    </template>
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
.comment-btn,
.social-indicator {
  color: var(--color-text-muted);
}

.social-indicator {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-xs);
  line-height: 1;
  padding: 2px var(--space-1);
  user-select: none;
}

.like-btn.liked,
.like-indicator.liked {
  color: var(--color-like);
}

.like-btn.liked:hover {
  background: var(--color-like-tint);
}

.comment-btn.active,
.comment-btn.has-comments,
.comment-indicator.has-comments {
  color: var(--color-primary);
}

.social-count {
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 2px;
}
</style>
