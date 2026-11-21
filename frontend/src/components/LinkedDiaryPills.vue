<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { DiaryEntry, LocationTrack } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate } from '../utils/dateFormat';
import LinkedEntityButton from './primitives/LinkedEntityButton.vue';

const props = withDefaults(
  defineProps<{
    entries: DiaryEntry[];
    tracks?: LocationTrack[];
  }>(),
  {
    tracks: () => [],
  }
);

const router = useRouter();
const tripStore = useTripStore();
const drawers = useDrawersStore();

const visibleEntries = computed(() => props.entries.filter((entry) => !entry.is_draft));

function jumpToDiaryEntry(entryId: number) {
  const path = tripStore.currentTripId ? `/trip/${tripStore.currentTripId}/diary` : '/diary';
  void router.push({ path, hash: `#entry-${entryId}` });
}

function trackTooltip(track: LocationTrack): string {
  const title = track.title || 'Aufzeichnung';
  const authorSuffix = track.author_username ? ` von ${track.author_username}` : '';
  return `Aufzeichnung „${title}“${authorSuffix} auf Karte abspielen`;
}
</script>

<template>
  <div v-if="tracks.length || visibleEntries.length" class="diary-link-pills">
    <LinkedEntityButton
      v-for="track in tracks"
      :key="`track-${track.id}`"
      :icon="ACTION_ICONS.recordStart"
      icon-group="actions"
      :label="track.title || 'Aufzeichnung'"
      :title="trackTooltip(track)"
      :aria-label="trackTooltip(track)"
      class="linked-track-btn"
      @click.stop="drawers.openMapForTrack(track.id)"
    />
    <LinkedEntityButton
      v-for="entry in visibleEntries"
      :key="`diary-${entry.id}`"
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
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
}
</style>
