<script setup lang="ts">
import Button from './primitives/Button.vue';
import { ref } from 'vue';
import DeleteButton from './DeleteButton.vue';

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
      <input v-model="draft" type="text" placeholder="Kommentar schreiben…" />
      <Button type="submit">Senden</Button>
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
  gap: var(--space-2);
}

.comment-form input {
  flex: 1;
}
</style>
