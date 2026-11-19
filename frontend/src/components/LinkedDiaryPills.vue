<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { DiaryEntry } from '../api/types';
import { useTripStore } from '../stores/trip';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDate } from '../utils/dateFormat';
import LinkedEntityButton from './primitives/LinkedEntityButton.vue';

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
    <LinkedEntityButton
      v-for="entry in visibleEntries"
      :key="entry.id"
      :icon="SECTION_ICON_DEFS.diary"
      icon-group="navigation"
      :label="entry.title?.trim() || formatDate(entry.date)"
      :title="`Tagebucheintrag öffnen (${formatDate(entry.date)})`"
      :aria-label="`Tagebucheintrag öffnen: ${entry.title?.trim() || formatDate(entry.date)}`"
      class="diary-link-pill"
      @click.stop="jumpToDiaryEntry(entry.id)"
    />
  </div>
</template>

<style scoped lang="scss">
.diary-link-pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
</style>
