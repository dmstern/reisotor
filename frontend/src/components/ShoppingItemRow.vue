<script setup lang="ts">
import type { ShoppingItem, User } from '../api/types';
import CheckableListItem from './primitives/CheckableListItem.vue';
import Checkbox from './primitives/Checkbox.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { PERIOD_META } from '../utils/period';

const props = defineProps<{
  item: ShoppingItem;
  users: User[];
  groupBy: 'buyer' | 'shop' | 'period';
  isHighlighted: boolean;
  hasMeta: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle', item: ShoppingItem): void;
  (e: 'reassign', item: ShoppingItem, event: Event): void;
  (e: 'edit', item: ShoppingItem): void;
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
    :id="`shopping-${item.id}`"
    :done="!!item.checked"
    :highlighted="isHighlighted"
  >
    <div class="item-main">
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
      <label :for="'shopping-item-' + item.id" class="check">
        <Checkbox
          :id="'shopping-item-' + item.id"
          :checked="!!item.checked"
          @change="emit('toggle', item)"
        />
        <span
          class="item-title"
          :class="{ 'row__text--done': item.checked, 'text-done': item.checked }"
        >
          {{ item.label }}
        </span>
      </label>

      <div v-if="hasMeta" class="item-meta">
        <PendingSyncBadge v-if="item._pending" />
        <Badge v-if="groupBy !== 'shop' && item.shop" size="sm" class="shop-badge">
          <AppIcon :icon="FORM_FIELD_ICONS.shop" :size="12" group="formFields" />
          <span>{{ item.shop }}</span>
        </Badge>
        <Badge v-if="groupBy !== 'period' && item.period" size="sm" class="period-badge">
          <AppIcon :icon="FORM_FIELD_ICONS.period" :size="12" group="formFields" />
          <span>{{ PERIOD_META[item.period] }}</span>
        </Badge>
        <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">
          <AppIcon :icon="FORM_FIELD_ICONS.link" :size="12" group="formFields" /> Link
        </a>
        <span v-if="item.note" class="note" :title="item.note">
          <AppIcon :icon="FORM_FIELD_ICONS.note" :size="12" group="formFields" />
          <span class="note-text">{{ item.note }}</span>
        </span>
      </div>
    </div>

    <template #actions>
      <div
        v-if="users.length > 1 && groupBy !== 'buyer' && userAvatar(item.assigned_to_user_id)"
        class="buyer-avatar-picker"
        :title="`Käufer:in: ${userName(item.assigned_to_user_id)}`"
      >
        <span class="avatar-display" aria-hidden="true">
          {{ userAvatar(item.assigned_to_user_id) }}
        </span>
        <!-- eslint-disable-next-line vuejs-accessibility/no-onchange -->
        <select
          class="buyer-native-select"
          aria-label="Käufer:in"
          :value="item.assigned_to_user_id ?? ''"
          @change="emit('reassign', item, $event)"
        >
          <option value="">Nicht zugewiesen</option>
          <option
            v-if="item.assigned_to_user_id && !users.some((u) => u.id === item.assigned_to_user_id)"
            :value="String(item.assigned_to_user_id)"
            disabled
          >
            Ehemaliges Mitglied
          </option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">
            {{ u.avatar }} {{ u.username }}
          </option>
        </select>
      </div>
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

.item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
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

.shop-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--color-brand);
  text-decoration: underline;
}

.link:hover {
  color: var(--color-brand-hover);
}

.note {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.buyer-avatar-picker {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--color-surface-hover);
  cursor: pointer;
  flex-shrink: 0;
}

.avatar-display {
  font-size: var(--font-size-xs);
  pointer-events: none;
}

.buyer-native-select {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.edit-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}
</style>
