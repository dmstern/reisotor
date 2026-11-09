<script setup lang="ts">
import type { ShoppingItem, User } from '../api/types';
import CheckableListItem from './primitives/CheckableListItem.vue';
import Checkbox from './primitives/Checkbox.vue';
import Badge from './primitives/Badge.vue';
import AppIcon from './AppIcon.vue';
import AssigneeMenu from './AssigneeMenu.vue';
import EditButton from './EditButton.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
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
  (e: 'reassign', item: ShoppingItem, assignedUserId: number | null): void;
  (e: 'edit', item: ShoppingItem): void;
}>();
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
      <AssigneeMenu
        v-if="users.length > 1 && groupBy !== 'buyer'"
        :users="users"
        :assigned-user-id="item.assigned_to_user_id"
        role-label="Käufer:in"
        @select="(userId) => emit('reassign', item, userId)"
      />
      <EditButton small @click="emit('edit', item)" />
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
  min-height: 24px;
}

.check :deep(input[type='checkbox']),
.check :deep(.ui-checkbox) {
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  border-width: 2px;
}

.check :deep(input[type='checkbox']:focus-visible),
.check :deep(.ui-checkbox:focus-visible) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.item-title {
  flex: 1;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: break-word;
  font-size: var(--font-size-md);
  line-height: 1.4;
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
  margin-left: calc(24px + var(--space-2));
  font-size: var(--font-size-xs);
}

.shop-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 34px;
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  max-width: 100%;
  min-width: 0;
}

.shop-badge span,
.period-badge span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 4px 8px;
  border-radius: var(--radius-sm-squircle);
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  flex-shrink: 0;
}

.link:hover {
  color: var(--color-primary-dark);
}

.link:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.note {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
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
</style>
