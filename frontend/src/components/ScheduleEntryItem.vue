<script setup lang="ts">
import { computed } from 'vue';
import type { CalendarEntry } from '../api/types';
import Checkbox from './primitives/Checkbox.vue';
import AppIcon from './AppIcon.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import CalendarExportDropdown from './CalendarExportDropdown.vue';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
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
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -->
  <li
    class="item clickable animate-cascade"
    tabindex="0"
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
        aria-label="Erledigt"
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
      <CalendarExportDropdown :entry="entry" />
    </div>
  </li>
</template>

<style scoped>
.item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--entry-cat-color, var(--color-primary));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.item.clickable {
  cursor: pointer;
}

.item.clickable:hover {
  background: var(--color-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.item-leading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding-top: 2px;
}

.item-cat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs-squircle, 6px);
  corner-shape: squircle;
  background: color-mix(in srgb, var(--entry-cat-color) 12%, var(--color-surface));
  color: var(--entry-cat-color);
  flex-shrink: 0;
}

.todo-checkbox {
  margin-top: 2px;
}

.item-main {
  min-width: 0;
  flex: 1;
  word-break: break-word;
  overflow-wrap: break-word;
}

.item-header-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 3px;
  flex-wrap: wrap;
}

.item-time-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.25;
}

.item-category-pill {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.25;
}

.item .title {
  font-weight: 600;
  font-size: 0.94rem;
  color: var(--color-text);
  line-height: 1.3;
}

.item .title.todo-done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.item .location {
  margin: 3px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}

.item .note {
  margin: 4px 0 0;
  font-size: 0.86rem;
}

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
  padding-top: 1px;
}
</style>
