<script setup lang="ts">
import type { TodoItem, User } from '../api/types';
import CheckableListItem from './primitives/CheckableListItem.vue';
import Checkbox from './primitives/Checkbox.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { TODO_PRIORITY_META as PRIORITY_META } from '../composables/useTodoGrouping';

const props = defineProps<{
  item: TodoItem;
  users: User[];
  groupBy: 'assignee' | 'period';
  isHighlighted: boolean;
  isFocused: boolean;
  periodLabel?: string | null;
  formattedDate?: string | null;
  isOverdue?: boolean;
  hasMeta?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-done', item: TodoItem): void;
  (e: 'click'): void;
  (e: 'edit', item: TodoItem): void;
}>();

function userAvatar(id: number | null | undefined) {
  if (id == null) return null;
  const u = props.users.find((u) => u.id === id);
  return u ? u.avatar : '👤';
}

function userName(id: number | null | undefined) {
  if (id == null) return null;
  const u = props.users.find((u) => u.id === id);
  return u ? u.username : 'Ehemaliges Mitglied';
}
</script>

<template>
  <CheckableListItem
    :id="`todo-${item.id}`"
    :done="!!item.done"
    :highlighted="isHighlighted"
    :focused="isFocused"
    @click="emit('click')"
  >
    <div class="item-main">
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
      <label :for="'todo-item-' + item.id" class="check">
        <Checkbox
          :id="'todo-item-' + item.id"
          :checked="!!item.done"
          @change="emit('toggle-done', item)"
        />
        <span
          v-if="item.priority"
          class="priority"
          :title="`Priorität: ${PRIORITY_META[item.priority].label}`"
          :aria-label="`Priorität: ${PRIORITY_META[item.priority].label}`"
        >
          <AppIcon
            :icon="ACTION_ICONS.priorityDot"
            :size="10"
            :color="PRIORITY_META[item.priority].color"
            group="actions"
          />
        </span>
        <span
          class="item-title title"
          :class="{ 'row__text--done': item.done, 'text-done': item.done }"
        >
          {{ item.title }}
        </span>
      </label>

      <div v-if="hasMeta" class="item-meta">
        <PendingSyncBadge v-if="item._pending" />
        <Badge
          v-if="item.due_date"
          :variant="isOverdue ? 'danger' : 'default'"
          size="sm"
          class="due-badge"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="11" group="formFields" />
          <span>{{ formattedDate }}</span>
        </Badge>
        <Badge v-if="groupBy !== 'period' && periodLabel" size="sm" class="period-badge">
          <AppIcon :icon="FORM_FIELD_ICONS.period" :size="11" group="formFields" />
          <span>{{ periodLabel }}</span>
        </Badge>
        <span v-if="item.note" class="note" :title="item.note">
          <AppIcon :icon="FORM_FIELD_ICONS.note" :size="11" group="formFields" />
          <span class="note-text">{{ item.note }}</span>
        </span>
      </div>
    </div>

    <template #actions>
      <span
        v-if="users.length > 1 && groupBy !== 'assignee' && userAvatar(item.assigned_to_user_id)"
        class="assignee-avatar-pill"
        :title="`Zugewiesen an: ${userName(item.assigned_to_user_id)}`"
      >
        {{ userAvatar(item.assigned_to_user_id) }}
      </span>
      <button
        type="button"
        class="edit-btn"
        aria-label="Bearbeiten"
        title="Bearbeiten"
        @click.stop="emit('edit', item)"
      >
        <AppIcon :icon="ACTION_ICONS.edit" :size="14" group="actions" />
      </button>
    </template>
  </CheckableListItem>
</template>

<style scoped>
.item-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  width: 100%;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  min-width: 0;
}

.priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: break-word;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.item-title.text-done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-left: calc(var(--space-4) + var(--space-2));
  font-size: var(--font-size-xs);
}

.due-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  min-width: 0;
}

.due-badge span,
.period-badge span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  max-width: min(200px, 100%);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignee-avatar-pill {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--color-hover);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

.edit-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}

@media (pointer: coarse) {
  .edit-btn::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
}

.edit-btn:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

.edit-btn:focus-visible {
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 2px;
}
</style>
