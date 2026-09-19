<script setup lang="ts">
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import { ref, nextTick } from 'vue';
import DeleteButton from './DeleteButton.vue';
import EditButton from './EditButton.vue';
import LikeButton from './LikeButton.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDateTime } from '../utils/dateFormat';

export interface CommentItem {
  id: number;
  avatar: string;
  username: string;
  content: string;
  created_at?: string;
  updated_at?: string | null;
  canRemove: boolean;
  canEdit?: boolean;
  likeCount?: number;
  liked?: boolean;
}

defineProps<{ comments: CommentItem[] }>();
const emit = defineEmits<{
  (e: 'submit', content: string): void;
  (e: 'remove', id: number): void;
  (e: 'update', id: number, content: string): void;
  (e: 'toggle-like', id: number): void;
}>();

const draft = ref('');
const editingId = ref<number | null>(null);
const editDraft = ref('');
const editInputRef = ref<{ $el?: HTMLInputElement } | HTMLInputElement | null>(null);

function submit() {
  const content = draft.value.trim();
  if (!content) return;
  emit('submit', content);
  draft.value = '';
}

function startEdit(c: CommentItem) {
  editingId.value = c.id;
  editDraft.value = c.content;
  nextTick(() => {
    const raw = editInputRef.value;
    const el = (raw && '$el' in raw && raw.$el ? raw.$el : raw) as HTMLInputElement | null;
    el?.focus?.();
  });
}

function cancelEdit() {
  editingId.value = null;
  editDraft.value = '';
}

function submitEdit(id: number) {
  const content = editDraft.value.trim();
  if (!content) return;
  emit('update', id, content);
  editingId.value = null;
  editDraft.value = '';
}

function formatCommentDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return formatDateTime(dateStr);
  } catch {
    return '';
  }
}
</script>

<template>
  <div class="comments">
    <div class="comment" v-for="c in comments" :key="c.id">
      <span class="avatar-sm">{{ c.avatar }}</span>
      <div class="comment-body">
        <div class="comment-header">
          <strong class="comment-username">{{ c.username }}</strong>
          <span v-if="c.created_at" class="comment-date">
            {{ formatCommentDate(c.created_at) }}
            <span v-if="c.updated_at" class="comment-edited">(bearbeitet)</span>
          </span>
        </div>

        <form
          v-if="editingId === c.id"
          class="comment-edit-form"
          @submit.prevent="submitEdit(c.id)"
        >
          <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
          <Input
            ref="editInputRef"
            v-model="editDraft"
            type="text"
            size="sm"
            class="comment-edit-input"
            @keydown.escape="cancelEdit"
          />
          <div class="comment-edit-actions">
            <Button type="button" variant="secondary" size="sm" @click="cancelEdit">
              Abbrechen
            </Button>
            <Button type="submit" variant="primary" size="sm" :disabled="!editDraft.trim()">
              Speichern
            </Button>
          </div>
        </form>
        <span v-else class="comment-text">{{ c.content }}</span>
      </div>

      <div v-if="editingId !== c.id" class="comment-actions">
        <LikeButton
          small
          :count="c.likeCount ?? 0"
          :liked="c.liked ?? false"
          @toggle="emit('toggle-like', c.id)"
        />
        <EditButton v-if="c.canEdit ?? c.canRemove" small @click="startEdit(c)" />
        <DeleteButton v-if="c.canRemove" small @click="emit('remove', c.id)" />
      </div>
    </div>

    <form class="comment-form" @submit.prevent="submit">
      <div class="comment-input-wrap">
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
        <Input
          v-model="draft"
          type="text"
          placeholder="Kommentar schreiben…"
          class="comment-input"
        />
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
  line-height: 1.2;
}

.comment-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  gap: 2px;
}

.comment-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.comment-username {
  font-weight: 600;
  color: var(--color-text);
}

.comment-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.comment-edited {
  font-style: italic;
  margin-left: 2px;
}

.comment-text {
  word-break: break-word;
  white-space: pre-wrap;
  color: var(--color-text);
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: auto;
}

.comment-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
  width: 100%;
}

.comment-edit-input {
  width: 100%;
}

.comment-edit-actions {
  display: flex;
  gap: var(--space-1);
  justify-content: flex-end;
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

.comment-input {
  width: 100%;
  padding-right: 38px;
  box-sizing: border-box;
}

.comment-input-wrap .send-btn {
  position: absolute;
  right: 4px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  translate: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    scale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.comment-input-wrap .send-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.comment-input-wrap .send-btn:hover:not(:disabled) {
  translate: none;
  scale: 1.05;
}

.comment-input-wrap .send-btn:active:not(:disabled) {
  translate: none;
  transform: none;
  scale: 0.95;
}
</style>
