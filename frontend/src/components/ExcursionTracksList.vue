<script setup lang="ts">
import type { Excursion, LocationTrack, User } from '../api/types';
import AppIcon from './AppIcon.vue';
import EmptyState from './primitives/EmptyState.vue';
import IconButton from './primitives/IconButton.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDateTime } from '../utils/dateFormat';
import { useExcursionsStore } from '../stores/excursions';

const props = defineProps<{
  tracks: LocationTrack[];
  users: User[];
  activeTrackId?: number | string | null;
  currentUserId?: number | null;
}>();

const emit = defineEmits<{
  (e: 'showOnMap', trackId: number): void;
  (e: 'stopTrack', track: LocationTrack): void;
  (e: 'editTrack', track: LocationTrack): void;
}>();

const excursionsStore = useExcursionsStore();

function trackTitle(track: LocationTrack): string {
  if (track.title && track.title.trim()) return track.title;
  return `Aufzeichnung vom ${formatDateTime(track.started_at)}`;
}

function trackAuthorAvatar(track: LocationTrack): string {
  const u = props.users.find((user) => user.id === track.user_id);
  return u?.avatar || '👤';
}

function trackAuthorName(track: LocationTrack): string {
  const u = props.users.find((user) => user.id === track.user_id);
  return u?.username || 'Mitreisende:r';
}

function trackAuthorTitle(track: LocationTrack): string {
  return `Aufgezeichnet von ${trackAuthorName(track)}`;
}

function trackDurationLabel(track: LocationTrack): string | null {
  if (!track.started_at || !track.ended_at) return null;
  const startMs = new Date(track.started_at).getTime();
  const endMs = new Date(track.ended_at).getTime();
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (diffSec < 60) return `${diffSec}\u00A0s`;
  const mins = Math.floor(diffSec / 60);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours > 0) return `${hours}\u00A0h ${remMins}\u00A0min`;
  return `${mins}\u00A0min`;
}

function getTourForTrack(track: LocationTrack): Excursion | undefined {
  if (track.excursion_id == null) return undefined;
  return excursionsStore.excursions.find((e) => e.id === track.excursion_id);
}
</script>

<template>
  <div class="tracks-tab-content">
    <EmptyState v-if="!tracks.length" class="tracks-empty-state">
      Noch keine Tracks aufgezeichnet.<br />
      <span class="empty-subtext">
        Starte eine Aufzeichnung über den Button oben oder direkt auf der Karte.
      </span>
    </EmptyState>

    <div v-else class="tracks-view">
      <ul class="tracks-list">
        <li
          v-for="track in tracks"
          :key="track.id"
          class="track-row"
          :class="{ active: Number(activeTrackId) === Number(track.id) }"
        >
          <button type="button" class="track-row-main" @click="emit('showOnMap', track.id)">
            <span class="track-row-title">
              <AppIcon
                v-if="track.visibility === 'private'"
                :icon="ACTION_ICONS.private"
                :size="13"
                group="actions"
                class="track-visibility-lock"
                title="Nur für dich sichtbar (privat)"
              />
              <span>{{ trackTitle(track) }}</span>
            </span>
            <span class="track-row-meta">
              <span class="track-meta-author" :title="trackAuthorTitle(track)">
                <span class="track-meta-avatar">{{ trackAuthorAvatar(track) }}</span>
                <span class="track-meta-name">{{ trackAuthorName(track) }}</span>
                <span class="track-meta-sep" aria-hidden="true">·</span>
              </span>
              <span
                v-if="!trackTitle(track).includes(formatDateTime(track.started_at))"
                class="track-meta-time"
              >
                {{ formatDateTime(track.started_at) }}
                <template
                  v-if="
                    !track.ended_at || track.end_reason === 'aborted' || trackDurationLabel(track)
                  "
                >
                  ·
                </template>
              </span>
              <span v-if="!track.ended_at" class="track-meta-live">
                <span class="recording-pulse-dot" aria-hidden="true"></span>
                Aufzeichnung läuft
              </span>
              <span
                v-else-if="track.end_reason === 'aborted'"
                class="track-meta-aborted"
                title="Aufzeichnung wurde automatisch abgebrochen"
              >
                <AppIcon :icon="ACTION_ICONS.warning" :size="12" group="actions" />
                Abgebrochen
                <template v-if="trackDurationLabel(track)">
                  · {{ trackDurationLabel(track) }}
                </template>
              </span>
              <span v-else-if="trackDurationLabel(track)" class="track-meta-duration">
                <AppIcon :icon="ACTION_ICONS.duration" :size="12" group="actions" />
                {{ trackDurationLabel(track) }}
              </span>
              <span
                v-if="getTourForTrack(track)"
                class="track-meta-tour"
                :title="'Zugeordnete Tour: ' + getTourForTrack(track)?.title"
              >
                ·
                <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="12" group="navigation" />
                {{ getTourForTrack(track)?.title }}
              </span>
            </span>
          </button>
          <div v-if="track.user_id === currentUserId" class="track-row-actions">
            <IconButton
              v-if="!track.ended_at"
              variant="danger"
              size="sm"
              :icon="ACTION_ICONS.recordStop"
              title="Aufzeichnung beenden"
              aria-label="Aufzeichnung beenden"
              @click.stop="emit('stopTrack', track)"
            />
            <IconButton
              variant="secondary"
              size="sm"
              :icon="ACTION_ICONS.edit"
              title="Aufzeichnung bearbeiten"
              aria-label="Aufzeichnung bearbeiten"
              @click="emit('editTrack', track)"
            />
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.tracks-view {
  padding: 0;
}

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.track-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  padding: var(--space-2) var(--space-3);
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.track-row:hover {
  border-color: var(--color-border-strong);
}

.track-row.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary);
}

.track-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.track-row-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-visibility-lock {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.track-row-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-meta-author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.track-meta-avatar {
  flex-shrink: 0;
  line-height: 1;
}

.track-meta-name {
  white-space: nowrap;
}

.track-meta-sep {
  color: var(--color-text-muted);
}

.track-meta-time {
  flex-shrink: 0;
  white-space: nowrap;
}

.track-meta-duration {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
  white-space: nowrap;
}

.track-meta-tour {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.track-meta-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-danger);
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}

.track-meta-aborted {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-warning-dark);
  font-weight: 500;
  flex-shrink: 0;
  white-space: nowrap;
}

.recording-pulse-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  animation: pulse-dot 1.5s infinite;
}

@keyframes pulse-dot {
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.5;
  }
  100% {
    transform: scale(0.95);
    opacity: 1;
  }
}

.empty-subtext {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  display: block;
  margin-top: var(--space-1);
}

@container spots-col (max-width: 480px) {
  .track-row {
    padding: var(--space-2);
    gap: var(--space-1);
  }
}

@container spots-col (max-width: 320px) {
  .track-meta-name {
    display: none;
  }
}

@container app-main (max-width: 719px) {
  .track-meta-name {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recording-pulse-dot {
    animation: none;
  }
  .track-row {
    transition: none;
  }
}
</style>
