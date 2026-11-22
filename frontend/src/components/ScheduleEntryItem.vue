<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarEntry } from '../api/types';
import Checkbox from './primitives/Checkbox.vue';
import AppIcon from './AppIcon.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import CalendarExportDropdown from './CalendarExportDropdown.vue';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { isEmptyRichText } from '../utils/richText';

const props = withDefaults(
  defineProps<{
    entry: CalendarEntry;
    index?: number;
    isDone?: boolean;
  }>(),
  {
    index: 0,
    isDone: false,
  }
);

defineEmits<{
  (e: 'click'): void;
  (e: 'toggleTodo'): void;
}>();

const categoryMeta = computed(
  () => SCHEDULE_CATEGORY_META[props.entry.category] ?? SCHEDULE_CATEGORY_META.other
);

const jumpLabel = computed<string | undefined>(() => {
  switch (props.entry.kind) {
    case 'todo':
      return 'Zur To-do-Liste springen';
    case 'excursion':
    case 'travel':
      return 'Zur Tour springen';
    case 'spot':
      return 'Zum Spot springen';
    case 'diary':
      return 'Zum Tagebucheintrag springen';
    default:
      return undefined;
  }
});

const hasObjectJump = computed(() => jumpLabel.value !== undefined);
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -->
  <li
    class="item clickable animate-cascade"
    :class="{ 'item--todo': entry.kind === 'todo' }"
    tabindex="0"
    :title="jumpLabel"
    :aria-label="jumpLabel ? `${entry.title} – ${jumpLabel}` : undefined"
    :style="{
      '--stagger-delay': index != null ? `${index * 40}ms` : undefined,
      '--entry-cat-color': categoryMeta.color,
      borderLeftColor: categoryMeta.color,
    }"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <div class="item-leading">
      <Checkbox
        v-if="entry.kind === 'todo'"
        class="todo-checkbox"
        :aria-label="isDone ? 'Als unerledigt markieren' : 'Als erledigt markieren'"
        :title="isDone ? 'Als unerledigt markieren' : 'Als erledigt markieren'"
        :checked="isDone"
        @click.stop="$emit('toggleTodo')"
      />
      <div v-else class="item-cat-icon" :title="categoryMeta.label">
        <AppIcon :size="16" :icon="entry.iconDef ?? categoryMeta.tabler" group="categories" />
      </div>
    </div>

    <div class="item-main">
      <div class="item-header-line">
        <span v-if="entry.time" class="item-time-badge">
          <AppIcon :icon="FORM_FIELD_ICONS.time" :size="11" group="formFields" />
          {{ entry.time }}<template v-if="entry.endTime"> – {{ entry.endTime }}</template>
        </span>
        <span class="item-category-pill">
          {{ categoryMeta.label }}
        </span>
      </div>
      <div class="title" :class="{ 'todo-done': entry.kind === 'todo' && isDone }">
        {{ entry.title }}
      </div>
      <p v-if="entry.location" class="location">
        <AppIcon :icon="FORM_FIELD_ICONS.location" :size="12" group="formFields" />
        {{ entry.location }}
      </p>
      <RichTextDisplay
        v-if="entry.note && !isEmptyRichText(entry.note)"
        :content="entry.note"
        format="html"
        class="note"
      />
    </div>

    <div class="item-actions">
      <span v-if="hasObjectJump" class="todo-nav-indicator" :title="jumpLabel" aria-hidden="true">
        <AppIcon :icon="ACTION_ICONS.arrowRight" :size="16" group="actions" />
      </span>
      <CalendarExportDropdown :entry="entry" variant="ghost" />
    </div>
  </li>
</template>

<style lang="scss" scoped>
.item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-left: 3px solid var(--entry-cat-color, var(--color-primary));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  min-width: 0;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.item.clickable {
  cursor: pointer;
}

@include can-hover {
  .item.clickable:hover {
    background: var(--color-hover);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  .item.clickable:hover .todo-nav-indicator {
    color: var(--color-primary);
    transform: translateX(3px);
  }
}

.item.clickable:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.item-leading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding-top: var(--space-2xs);
}

.item-cat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  background: color-mix(in srgb, var(--entry-cat-color) 12%, var(--color-surface));
  color: var(--entry-cat-color);
  flex-shrink: 0;
}

.todo-checkbox {
  margin-top: var(--space-2xs);
}

.item-main {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.item-header-line {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
  flex-wrap: wrap;
}

.item-time-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  padding: var(--space-2xs) var(--space-1-5);
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  line-height: var(--line-height-tight);
  white-space: nowrap;
}

.item-category-pill {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: var(--line-height-tight);
  white-space: nowrap;
}

.item .title {
  font-weight: 600;
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: var(--line-height-snug);
}

.item .title.todo-done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.item .location {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  min-width: 0;
}

.item .location :deep(.app-icon) {
  flex-shrink: 0;
  margin-top: var(--space-2xs);
}

.item .note {
  margin: var(--space-xs) 0 0;
  font-size: var(--font-size-sm);
}

.item-actions {
  display: flex;
  gap: var(--space-xs);
  flex-shrink: 0;
  align-items: center;
  padding-top: var(--space-2xs);
}

.todo-nav-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  padding: var(--space-2xs);
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}

@media (prefers-reduced-motion: reduce) {
  .item,
  .todo-nav-indicator {
    transition: none;
  }
}
</style>
