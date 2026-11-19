<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { DiaryEntry } from '../api/types';
import { useDiaryStore } from '../stores/diary';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDate } from '../utils/dateFormat';
import AppIcon from './AppIcon.vue';
import Checkbox from './primitives/Checkbox.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';

const props = withDefaults(
  defineProps<{
    dates?: string[];
    idPrefix: string;
  }>(),
  {
    dates: () => [],
  }
);

const modelValue = defineModel<number[]>({ default: () => [] });

const diaryStore = useDiaryStore();
const expanded = ref(modelValue.value.length > 0);

onMounted(() => {
  if (!diaryStore.loaded) {
    void diaryStore.load();
  }
});

watch(
  () => modelValue.value.length,
  (length) => {
    if (length > 0) {
      expanded.value = true;
    }
  }
);

const referenceDateSet = computed(() => {
  const validDates = new Set<string>();

  for (const dateValue of props.dates) {
    const trimmed = dateValue?.trim();

    if (trimmed) {
      validDates.add(trimmed);
    }
  }

  return validDates;
});

function compareEntriesNewestFirst(first: DiaryEntry, second: DiaryEntry): number {
  if (first.date !== second.date) {
    return second.date.localeCompare(first.date);
  }

  return second.id - first.id;
}

const publishedEntries = computed(() => {
  const published = diaryStore.entries.filter((entry) => !entry.is_draft);
  const matching: DiaryEntry[] = [];
  const remaining: DiaryEntry[] = [];

  for (const entry of published) {
    if (referenceDateSet.value.has(entry.date)) {
      matching.push(entry);
    } else {
      remaining.push(entry);
    }
  }

  matching.sort(compareEntriesNewestFirst);
  remaining.sort(compareEntriesNewestFirst);
  return [...matching, ...remaining];
});

function isMatchingDate(entry: DiaryEntry): boolean {
  return referenceDateSet.value.has(entry.date);
}

function entryLabel(entry: DiaryEntry): string {
  return entry.title?.trim() || formatDate(entry.date);
}
</script>

<template>
  <CollapsibleFieldset
    v-if="publishedEntries.length"
    v-model="expanded"
    label="Tagebucheinträge"
    :icon="SECTION_ICON_DEFS.diary"
    icon-group="navigation"
    :count="modelValue.length ? `(${modelValue.length} zugeordnet)` : undefined"
  >
    <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
    <label
      v-for="entry in publishedEntries"
      :key="entry.id"
      :for="`${idPrefix}-${entry.id}`"
      class="diary-picker-option"
    >
      <Checkbox :id="`${idPrefix}-${entry.id}`" v-model="modelValue" :value="entry.id" />
      <span class="diary-picker-option-content">
        <span class="diary-picker-option-title">
          <span class="diary-picker-option-name">{{ entryLabel(entry) }}</span>
        </span>
        <span v-if="isMatchingDate(entry)" class="diary-picker-badge recommended">
          <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" />
          <span class="diary-picker-badge-text">Empfohlen – gleicher Tag</span>
        </span>
        <span
          v-else
          class="diary-picker-badge date-chip"
          :class="{ 'is-muted': referenceDateSet.size > 0 }"
        >
          <span class="diary-picker-badge-text">{{ formatDate(entry.date) }}</span>
        </span>
      </span>
    </label>
  </CollapsibleFieldset>
</template>

<style lang="scss" scoped>
.diary-picker-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  user-select: none;
  font-size: var(--font-size-sm);
  font-weight: 400;
  transition: background-color var(--transition-fast);
}

@include can-hover {
  .diary-picker-option:hover {
    background-color: var(--color-hover);
  }
}

.diary-picker-option:focus-within {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.diary-picker-option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

@container (min-width: 480px) {
  .diary-picker-option-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
}

.diary-picker-option-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.4;
  min-height: 24px;
}

.diary-picker-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diary-picker-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  max-width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  width: fit-content;
}

.diary-picker-badge-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diary-picker-badge.recommended {
  background: var(--color-primary-tint);
  color: var(--color-text);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 600;
}

.diary-picker-badge.date-chip {
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  color: var(--color-text-muted);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 500;
}

.diary-picker-badge.date-chip.is-muted {
  background: var(--color-hover);
}

@media (prefers-reduced-motion: reduce) {
  .diary-picker-option {
    transition: none;
  }
}
</style>
