<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { DiaryEntry } from '../api/types';
import { useTripStore } from '../stores/trip';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate } from '../utils/dateFormat';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  entries: DiaryEntry[];
}>();

const router = useRouter();
const tripStore = useTripStore();

const visibleEntries = computed(() => props.entries.filter((entry) => !entry.is_draft));

function jumpToDiaryEntry(entryId: number) {
  const path = tripStore.currentTripId ? `/trip/${tripStore.currentTripId}/diary` : '/diary';
  void router.push({ path, hash: `#entry-${entryId}` });
}
</script>

<template>
  <div v-if="visibleEntries.length" class="diary-link-pills">
    <button
      v-for="entry in visibleEntries"
      :key="entry.id"
      type="button"
      class="diary-link-pill"
      :title="`Tagebucheintrag öffnen (${formatDate(entry.date)})`"
      :aria-label="`Tagebucheintrag öffnen: ${entry.title?.trim() || formatDate(entry.date)}`"
      @click.stop="jumpToDiaryEntry(entry.id)"
    >
      <AppIcon :icon="SECTION_ICON_DEFS.diary" :size="12" group="navigation" />
      <span class="diary-link-pill-label">
        {{ entry.title?.trim() || formatDate(entry.date) }}
      </span>
      <AppIcon :icon="ACTION_ICONS.arrowRight" :size="11" group="actions" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.diary-link-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.diary-link-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  border: var(--border-width) solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: 500;
  line-height: 1.3;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast);
}

.diary-link-pill-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@include can-hover {
  .diary-link-pill:hover {
    background: var(--color-hover);
    border-color: var(--color-primary);
  }
}

.diary-link-pill:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
}
</style>
