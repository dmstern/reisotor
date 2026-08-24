<script setup lang="ts">
import Button from './primitives/Button.vue';
import { ref } from 'vue';
import DeleteButton from './DeleteButton.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

export interface CommentItem {
  id: number;
  avatar: string;
  username: string;
  content: string;
  canRemove: boolean;
}

defineProps<{ comments: CommentItem[] }>();
const emit = defineEmits<{ (e: 'submit', content: string): void; (e: 'remove', id: number): void }>();

const draft = ref('');

function submit() {
  const content = draft.value.trim();
  if (!content) return;
  emit('submit', content);
  draft.value = '';
}
</script>

<template>
  <div class="comments">
    <div class="comment" v-for="c in comments" :key="c.id">
      <span class="avatar-sm">{{ c.avatar }}</span>
      <div class="comment-body">
        <strong>{{ c.username }}</strong>
        <span>{{ c.content }}</span>
      </div>
      <DeleteButton v-if="c.canRemove" small @click="emit('remove', c.id)" />
    </div>

    <form class="comment-form" @submit.prevent="submit">
      <div class="comment-input-wrap">
        <input v-model="draft" type="text" placeholder="Kommentar schreiben…" />
        <Button
          type="submit"
          class="send-btn"
          title="Kommentar senden"
          aria-label="Kommentar senden"
          :disabled="!draft.trim()"
        >
          <AppIcon :icon="ACTION_ICONS.send" :size="14" group="actions" />
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.comments {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.comment {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.avatar-sm {
  font-size: 1.1rem;
}

.comment-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  font-size: 0.88rem;
}

.comment-form {
  display: flex;
  width: 100%;
}

.comment-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.comment-input-wrap input {
  width: 100%;
  padding-right: 38px;
  box-sizing: border-box;
}

.comment-input-wrap .send-btn {
  position: absolute;
  right: 4px;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}

.comment-input-wrap .send-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
