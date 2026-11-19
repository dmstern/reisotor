<script setup lang="ts">
import type { LocationTrack } from '../api/types';
import { useDrawersStore } from '../stores/drawers';
import Button from './primitives/Button.vue';
import LinkedEntityButton from './primitives/LinkedEntityButton.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

defineProps<{
  hasMappedStations: boolean;
  linkedTracks: LocationTrack[];
}>();

const emit = defineEmits<{
  (e: 'show-on-map'): void;
}>();

const drawers = useDrawersStore();
</script>

<template>
  <div v-if="hasMappedStations || linkedTracks.length" class="links">
    <Button
      v-if="hasMappedStations || linkedTracks.length"
      variant="card-action"
      class="show-on-map-btn"
      aria-label="Auf Karte anzeigen"
      title="Auf Karte anzeigen"
      @click.stop="emit('show-on-map')"
    >
      <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
      <span class="btn-label">Auf Karte anzeigen</span>
    </Button>
    <LinkedEntityButton
      v-for="track in linkedTracks"
      :key="track.id"
      :icon="ACTION_ICONS.recordStart"
      icon-group="actions"
      class="linked-track-btn"
      :title="
        'Aufzeichnung „' +
        (track.title || 'Aufzeichnung') +
        '“' +
        (track.author_username ? ' von ' + track.author_username : '') +
        ' auf Karte abspielen'
      "
      @click.stop="drawers.openMapForTrack(track.id)"
    >
      <span v-if="track.author_avatar" class="track-btn-avatar" :title="track.author_username">{{
        track.author_avatar
      }}</span>
      {{ track.title || 'Aufzeichnung' }}
    </LinkedEntityButton>
  </div>
</template>

<style scoped>
.links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.show-on-map-btn .btn-label {
  display: inline-block;
  max-width: 140px;
  opacity: 1;
  overflow: hidden;
  white-space: nowrap;
  transition:
    max-width 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease,
    margin 0.28s ease;
}

.track-btn-avatar {
  margin-right: 3px;
  line-height: 1;
}

@container spots-col (max-width: 360px) {
  .show-on-map-btn .btn-label {
    max-width: 110px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .show-on-map-btn {
    transform: none !important;
    translate: none !important;
  }

  .show-on-map-btn .btn-label {
    transform: none !important;
    transition: opacity 0.15s ease !important;
  }
}
</style>
