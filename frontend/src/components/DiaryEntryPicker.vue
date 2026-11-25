<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { DiaryEntry } from '../api/types';
import { useDiaryStore } from '../stores/diary';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDate } from '../utils/dateFormat';
import AppIcon from './AppIcon.vue';
import Badge from './primitives/Badge.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';

const BADGE_ICON_SIZE = 13;

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

function toggleEntry(entryId: number, checked: boolean) {
  if (checked) {
    if (!modelValue.value.includes(entryId)) {
      modelValue.value = [...modelValue.value, entryId];
    }

    return;
  }

  modelValue.value = modelValue.value.filter((id) => id !== entryId);
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
    <div class="diary-picker-list">
      <DropdownMenuItem
        v-for="entry in publishedEntries"
        :key="entry.id"
        multiselect
        :input-id="`${idPrefix}-${entry.id}`"
        :checked="modelValue.includes(entry.id)"
        :active="modelValue.includes(entry.id)"
        :value="entry.id"
        :label="entryLabel(entry)"
        @update:checked="toggleEntry(entry.id, $event)"
      >
        <template #trailing>
          <Badge v-if="isMatchingDate(entry)" variant="primary" size="sm">
            <AppIcon :icon="ACTION_ICONS.recommended" :size="BADGE_ICON_SIZE" group="actions" />
            Empfohlen – gleicher Tag
          </Badge>
          <Badge v-else size="sm">
            {{ formatDate(entry.date) }}
          </Badge>
        </template>
      </DropdownMenuItem>
    </div>
  </CollapsibleFieldset>
</template>

<style lang="scss" scoped>
.diary-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
}
</style>
