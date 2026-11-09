<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue';
import type { Spot } from '../api/types';
import { IconFlag, IconFlagFilled } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { useDrawersStore } from '../stores/drawers';
import CategoryChip from './CategoryChip.vue';
import EditButton from './EditButton.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import FileAttachments from './FileAttachments.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SpotLocationBadge from './SpotLocationBadge.vue';
import SocialRow from './SocialRow.vue';
import AppIcon from './AppIcon.vue';
import Accordion from './primitives/Accordion.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import Card from './primitives/Card.vue';
import SpotCoverImage from './SpotCoverImage.vue';
import SpotDetails from './SpotDetails.vue';
import SpotDoneStatus from './SpotDoneStatus.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatTravelDuration } from '../utils/travelDuration';

const props = withDefaults(
  defineProps<{
    spot: Spot;
    creatorLabel: string | null;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    // Liegt beim Elternteil (ExcursionsView.vue), nicht lokal hier: dieselbe Information steuert dort
    // gleichzeitig, welcher Pin auf der direkt danebenliegenden Karte vergrößert wird (siehe
    // onCardClick unten) – ein Pin-Klick auf der Karte muss diese Karte hier aufklappen können, ohne
    // dass TripMap.vue direkten Zugriff auf SpotCard-Instanzen bräuchte.
    expanded: boolean;
    // Frühestes Datum, an dem dieser Spot über einen Kalender-Termin (schedule_items.spot_id)
    // eingeplant ist, oder null falls (noch) nicht geplant – vom Elternteil aus dem scheduleStore
    // abgeleitet (analog zu Excursion.date), da mehrere Karten sich denselben Stand teilen müssen.
    scheduledDate: string | null;
    highlighted?: boolean;
    excursionContext?: { id: number; isDestination: boolean; hasDestination: boolean };
    /** Nur für Kategorie "Unterkunft" mit gesetztem paid_by_user_id relevant (siehe
     *  Migrationskommentar in db/index.ts). */
    payerLabel?: string | null;
    hasMultipleMembers?: boolean;
    /** Umsteige-/Aufenthaltszeit in Minuten, wenn die Station Teil einer Tour ist (#396) */
    layoverMinutes?: number | null;
    /** Reduziert das Kategorie-Badge optional explizit auf sein Icon */
    iconOnlyCategory?: boolean;
    /** Semantisches HTML-Überschriften-Tag für den Card-Titel (Standard: 'h4') */
    headingTag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  }>(),
  {
    headingTag: 'h4',
  }
);

const isAccommodation = computed(() => props.spot.category === 'Unterkunft');

const DESTINATION_ICON: IconDef = {
  id: 'flag',
  emoji: '🏁',
  outline: IconFlag,
  filled: IconFlagFilled,
};

const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'update-comment', id: number, content: string): void;
  (e: 'toggle-comment-like', id: number): void;
  (e: 'open', spot: Spot, el?: HTMLElement | null): void;
  (e: 'close'): void;
  (e: 'toggle-destination'): void;
  (e: 'show-on-map'): void;
}>();

const showComments = ref(false);
const drawers = useDrawersStore();

// Klick auf die Karte klappt sie nur auf-/zu, statt einen Modal-Dialog zu öffnen
const cardRoot = ref<ComponentPublicInstance | HTMLElement | null>(null);

function getCardDomElement(event?: MouseEvent): HTMLElement | null {
  if (event?.currentTarget instanceof HTMLElement) {
    return event.currentTarget;
  }

  const root = cardRoot.value;

  if (!root) {
    return null;
  }

  if (root instanceof HTMLElement) {
    return root;
  }

  if ('$el' in root && root.$el instanceof HTMLElement) {
    return root.$el;
  }

  return null;
}

function onCardClick(event?: MouseEvent) {
  const target = event?.target as HTMLElement | null;

  if (target?.closest('.spot-edit-btn, a, button')) {
    return;
  }

  if (props.expanded) {
    if (target && !target.closest('.image, .card-badge-group')) {
      return;
    }

    emit('close');

    if (drawers.mapFocusKey === `spot-${props.spot.id}`) {
      drawers.mapFocusKey = null;
    }
  } else {
    emit('open', props.spot, getCardDomElement(event));
  }
}

function onShowOnMap() {
  emit('show-on-map');
}

const isMapFocused = computed(() => drawers.mapFocusKey === `spot-${props.spot.id}`);

// Subtile, deterministische Drehung für den authentischen Polaroid-Look (z. B. -1.1° bis +0.95°)
// Bleibt stabil pro Spot-ID, damit die Kärtchen beim Sortieren/Filtern nicht hin- und herwackeln.
const ROTATION_ANGLES = [-0.85, 0.75, -0.6, 0.95, -1.1, 0.65];
const cardRotation = computed(() => {
  if (props.expanded) {
    return '0deg';
  }

  const angle = ROTATION_ANGLES[Math.abs(props.spot.id) % ROTATION_ANGLES.length];
  return `${angle}deg`;
});
</script>

<template>
  <Card
    ref="cardRoot"
    variant="polaroid"
    class="spot-card"
    :class="{ expanded, 'new-highlight': highlighted, 'has-layover': layoverMinutes != null }"
    :highlight="highlighted"
    :map-focused="isMapFocused"
    :style="{ '--card-rotate': cardRotation }"
    @click="onCardClick"
  >
    <SpotCoverImage
      :spot="spot"
      :expanded="expanded"
      :creator-label="creatorLabel"
      :is-accommodation="isAccommodation"
      :heading-tag="headingTag"
    />

    <div class="body">
      <!-- Dynamischer Flex-Header im Body (Titel + Badge-Gruppe ohne Überlappung) -->
      <div class="card-header-row" :class="{ 'is-expanded': expanded }">
        <div v-if="!expanded" class="card-title-block">
          <component :is="headingTag" class="card-title" :title="spot.title">
            {{ spot.title }}
          </component>
        </div>

        <div class="card-badge-group">
          <SpotLocationBadge
            v-if="spot.lat == null || spot.lng == null"
            :spot="spot"
            :expanded="expanded"
            @edit="emit('edit', spot)"
          />
          <CategoryChip
            :category="spot.category"
            :icon-only="expanded ? false : iconOnlyCategory"
          />
          <PendingSyncBadge v-if="spot._pending" />
          <EditButton
            small
            shape="circle"
            variant="surface"
            class="spot-edit-btn"
            @click="emit('edit', spot)"
          />
        </div>
      </div>

      <!-- Spot-Notiz: Trunkiert mit Ellipsis im collapsed Zustand (#235) -->
      <div v-if="!expanded && spot.note" class="spot-note-container">
        <RichTextDisplay class="note is-clamped" :content="spot.note" :format="spot.note_format" />
      </div>

      <!-- Eigene, explizite Aktionen (#109, #381) – nur im aufgeklappten Zustand sichtbar -->
      <div class="map-actions" v-if="expanded && spot.lat != null && spot.lng != null">
        <Button
          variant="card-action"
          size="sm"
          class="show-on-map-btn"
          aria-label="Auf Karte anzeigen"
          title="Auf Karte anzeigen"
          @click.stop="onShowOnMap"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
          <span class="btn-label">Auf Karte anzeigen</span>
        </Button>
        <MapsAppPicker
          :lat="spot.lat"
          :lng="spot.lng"
          :title="spot.title"
          :maps-link="spot.maps_link"
          @click.stop
        />
      </div>
      <div class="map-actions map-actions--missing" v-else-if="expanded">
        <Button
          variant="card-action"
          size="sm"
          class="set-location-btn"
          aria-label="Standort festlegen"
          title="Standort jetzt im Bearbeiten-Dialog festlegen"
          @click.stop="emit('edit', spot)"
        >
          <AppIcon
            :icon="ACTION_ICONS.warning"
            :size="14"
            group="actions"
            class="map-action-warning-icon"
          />
          <span class="btn-label">Standort festlegen</span>
        </Button>
      </div>

      <SpotDetails
        :spot="spot"
        :expanded="expanded"
        :is-accommodation="isAccommodation"
        :payer-label="payerLabel"
        :has-multiple-members="hasMultipleMembers"
      />

      <div class="card-actions-wrapper" :class="{ 'is-expanded': expanded }">
        <div class="actions-accordion" :class="{ 'is-expanded': expanded }">
          <div class="actions-accordion-inner accordion-stagger">
            <div class="card-actions">
              <Button
                v-if="
                  expanded &&
                  excursionContext &&
                  (!excursionContext.hasDestination || excursionContext.isDestination)
                "
                key="btn-destination"
                variant="secondary"
                size="sm"
                class="spot-destination-toggle"
                :class="{ 'is-active': excursionContext.isDestination }"
                :active="excursionContext.isDestination"
                title="Als Ziel der Tour markieren (für Hin-/Rückweg-Farbverlauf)"
                @click.stop="$emit('toggle-destination')"
              >
                <AppIcon
                  :icon="DESTINATION_ICON"
                  :size="14"
                  group="formFields"
                  :filled="excursionContext.isDestination"
                />
                Ziel der Tour
              </Button>
              <!-- Verschmolzener Status-Button (Geplant-Status + Gemacht-Checkbox) -->
              <SpotDoneStatus
                v-if="!isAccommodation"
                :spot="spot"
                :scheduled-date="scheduledDate"
                :expanded="expanded"
                @card-click="onCardClick"
              />

              <!-- Expanded Social Actions: Fließt nahtlos im Aktionen-Raster mit (schließt Leerräume bei Umbrüchen) -->
              <SocialRow
                v-if="expanded"
                class="is-expanded"
                :like-count="likeCount"
                :liked="liked"
                :comment-count="comments.length"
                :comments-open="showComments"
                @toggle-like="emit('toggle-like')"
                @toggle-comments="showComments = !showComments"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Untere Zeile (Footer): Umsteigezeit/Anhänge links, Social Actions & Aufklapp-Hinweis im collapsed Zustand -->
      <div
        class="card-footer-row"
        :class="{ 'is-expanded': expanded, 'has-layover': layoverMinutes != null }"
      >
        <div class="card-footer-left" :class="{ 'is-expanded': expanded }">
          <div class="card-attachments-wrap" :class="{ 'is-expanded': expanded }">
            <FileAttachments
              domain="spots"
              :entity-id="spot.id"
              :editable="false"
              :collapsed="!expanded"
            />
          </div>

          <Badge
            v-if="layoverMinutes != null"
            variant="default"
            size="sm"
            class="spot-layover-badge"
            :class="{ 'is-expanded': expanded }"
            :title="`Umsteigezeit an dieser Station: ${formatTravelDuration(layoverMinutes)}`"
          >
            <AppIcon :icon="ACTION_ICONS.duration" :size="12" group="actions" />
            <span class="spot-layover-text"
              >{{ formatTravelDuration(layoverMinutes) }} Umstieg</span
            >
          </Badge>
        </div>

        <div v-if="!expanded" class="card-footer-right">
          <SocialRow
            readonly
            :like-count="likeCount"
            :liked="liked"
            :comment-count="comments.length"
          />
          <span
            class="spot-expand-pill"
            :class="{
              'is-compact': likeCount > 0 || comments.length > 0 || layoverMinutes != null,
            }"
            aria-hidden="true"
          >
            <span class="spot-expand-label">Details</span>
            <AppIcon
              :icon="ACTION_ICONS.chevronDown"
              :size="13"
              group="actions"
              class="spot-expand-chevron"
            />
          </span>
        </div>
      </div>

      <Accordion :expanded="expanded && showComments">
        <Comments
          :comments="comments"
          @click.stop
          @submit="(content) => emit('submit-comment', content)"
          @remove="(id) => emit('remove-comment', id)"
          @update="(id, content) => emit('update-comment', id, content)"
          @toggle-like="(id) => emit('toggle-comment-like', id)"
        />
      </Accordion>
    </div>
  </Card>
</template>

<style scoped lang="scss">
.spot-card {
  --spot-cover-height: 120px;
  --spot-card-pad: var(--space-2);
  container: spot-card / inline-size;
  position: relative;
  z-index: var(--z-card);
  isolation: isolate;
  padding: var(--spot-card-pad) var(--spot-card-pad) 14px var(--spot-card-pad);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
  box-sizing: border-box;
  width: 100%;
}

.spot-card:hover {
  z-index: var(--z-card-elevated);
}

.spot-card:not(.expanded) {
  height: auto;
  min-height: 0;
}

.spot-card.expanded {
  border-color: var(--color-primary);
  transform: translateY(0) rotate(0deg) scale(1);
  cursor: default;
}

/* Dynamischer Flex-Header im eingeklappten Zustand (Titel links, Badges rechts ohne Überlappung) */
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.card-header-row.is-expanded {
  display: contents;
}

.card-badge-group {
  flex-shrink: 0;
  z-index: var(--z-card-elevated);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  pointer-events: auto;
}

.card-badge-group > * {
  box-shadow: var(--shadow-xs);
}

.spot-card.expanded .card-badge-group {
  position: absolute;
  top: calc(var(--spot-card-pad) + var(--space-2));
  right: calc(var(--spot-card-pad) + var(--space-2));
  cursor: pointer;
}

.card-badge-group :deep(.category-chip) {
  cursor: inherit;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    padding 0.2s ease,
    gap 0.2s ease;
}

.spot-card.expanded .card-badge-group :deep(.category-chip),
.spot-card.expanded .card-badge-group :deep(.spot-location-badge) {
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.15);
}

.body {
  display: flex;
  flex-direction: column;
  padding: var(--spot-card-pad) var(--space-2) 0 var(--space-2);
  gap: var(--space-2);
  min-width: 0;
  transition:
    padding 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease;
  box-sizing: border-box;
}

.spot-card.expanded:has(
    .image.is-expanded:hover:not(:has(a:hover)),
    .card-badge-group:hover:not(:has(.spot-location-badge:hover, .spot-edit-btn:hover))
  )
  .body {
  transform: translateY(-2px);
  opacity: 0.84;
}

.spot-card.expanded:has(
    .card-badge-group:hover:not(:has(.spot-location-badge:hover, .spot-edit-btn:hover))
  )
  :deep(.image.is-expanded) {
  box-shadow:
    inset 0 0 0 2px var(--color-primary),
    0 4px 12px rgba(0, 0, 0, 0.18);
}

.spot-card.expanded:has(
    .card-badge-group:hover:not(:has(.spot-location-badge:hover, .spot-edit-btn:hover))
  )
  :deep(.spot-collapse-pill) {
  background: var(--color-primary);
  border-color: rgba(255, 255, 255, 0.65);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.spot-card.expanded:has(
    .card-badge-group:hover:not(:has(.spot-location-badge:hover, .spot-edit-btn:hover))
  )
  :deep(.spot-collapse-chevron) {
  transform: translateY(-2px);
}

.spot-edit-btn {
  flex-shrink: 0;
}

.spot-card:not(.expanded) .body {
  min-height: 80px;
  overflow: hidden;
}

.spot-card.expanded .body {
  padding-top: var(--space-3);
  gap: var(--space-3);
}

.card-title-block {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
}

.card-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease;
}

.spot-card:not(.expanded):hover:not(:has(.spot-edit-btn:hover)) .card-title {
  color: var(--color-primary-dark);
}

.spot-note-container {
  overflow: hidden;
  max-height: 2.85em;
  margin-top: calc(-1 * var(--space-1));
}

.note {
  overflow-wrap: anywhere;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.note.is-clamped {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.note.is-clamped :deep(.richtext) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note.is-clamped :deep(p),
.note.is-clamped :deep(div) {
  display: inline;
  margin: 0;
}

.note.is-clamped :deep(p + p::before),
.note.is-clamped :deep(div + div::before) {
  content: ' · ';
}

.card-actions-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.spot-card:not(.expanded) .card-actions-wrapper {
  display: none;
}

.spot-card.expanded .card-actions-wrapper {
  display: flex;
}

.card-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 28px;
  position: relative;
  z-index: var(--z-card);
  box-sizing: border-box;
}

.spot-card.expanded .card-footer-row:not(:has(.file-attachments, .spot-layover-badge)) {
  display: none;
}

.card-footer-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.spot-card:not(.expanded) .card-footer-row {
  margin-top: auto;
}

.spot-card.has-layover:not(.expanded) .card-footer-row {
  align-items: flex-end;
  min-height: 32px;
}

.card-footer-right {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  flex-shrink: 0;
}

.spot-expand-pill {
  @include control-3d-raised;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 24px;
  min-width: 24px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

.spot-expand-pill.is-compact {
  width: 24px;
  height: 24px;
  padding: 0;
}

.spot-expand-pill.is-compact .spot-expand-label {
  display: none;
}

.spot-expand-chevron {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.spot-card:not(.expanded):hover:not(:has(.spot-edit-btn:hover)) .spot-expand-pill,
.spot-expand-pill:hover {
  background-color: var(--color-primary-tint);
  border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
  color: var(--color-primary-dark);
  box-shadow: var(--shadow-control-hover);
  translate: 0 -1px;
}

.spot-expand-pill:active {
  transform: translateY(0.5px) scale(0.96);
  translate: 0 0;
  box-shadow: var(--shadow-control-active);
}

.spot-card:not(.expanded):hover:not(:has(.spot-edit-btn:hover)) .spot-expand-chevron {
  transform: translateY(1.5px);
}

.spot-layover-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
}

.spot-card.expanded .spot-layover-badge {
  margin-top: 2px;
}

.spot-layover-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-attachments-wrap {
  width: 100%;
}

.spot-card:not(.expanded) .card-attachments-wrap {
  position: absolute;
  top: calc(var(--spot-card-pad) + var(--space-1));
  left: calc(var(--spot-card-pad) + var(--space-1));
  z-index: var(--z-map-focus);
  width: auto;
}

.spot-card:not(.expanded) .card-attachments-wrap :deep(.file-attachments) {
  padding: 0;
}

.card-attachments-wrap :deep(.file-attachments) {
  width: 100%;
}

.card-attachments-wrap :deep(.heading) {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}

.card-attachments-wrap :deep(.attachments-polaroid-wrap) {
  display: flex;
}

.card-social-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.card-social-actions.is-expanded {
  margin-left: auto;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.spot-card.expanded .card-actions {
  display: flex;
}

.spot-card:not(.expanded) .card-actions {
  display: none;
}

.map-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.map-action-warning-icon {
  color: var(--color-warning);
}

.spot-destination-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-control);
}

.spot-destination-toggle.is-active {
  color: var(--color-primary-dark);
  border-color: var(--color-primary);
  background-color: var(--color-primary-tint);
  box-shadow: var(--shadow-control);
}

.spot-destination-toggle {
  position: relative;
}

.spot-destination-toggle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  inset-inline: 0;
  height: 44px;
  min-height: 44px;
}

@media (pointer: fine) {
  .spot-destination-toggle::after {
    display: none;
  }
}

.actions-accordion {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    visibility 0s linear 0.22s;
  width: 100%;
}

.actions-accordion.is-expanded {
  grid-template-rows: 1fr;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s,
    visibility 0s linear 0.14s;
}

.actions-accordion-inner {
  display: block;
  overflow: hidden;
  padding: 6px;
  margin: -6px;
}

.actions-accordion.is-expanded .actions-accordion-inner {
  overflow: visible;
}

.actions-accordion-inner > * {
  transition:
    opacity 0.2s ease 0s,
    transform 0.2s ease 0s;
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}

.actions-accordion.is-expanded .actions-accordion-inner > * {
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx, 0) * 35ms + 140ms);
}

@container spots-col (max-width: 480px) {
  .spot-card {
    --spot-cover-height: 100px;
    --spot-card-pad: var(--radius-xs);
    padding: var(--radius-xs) var(--radius-xs) 10px var(--radius-xs);
  }

  .spot-card:not(.expanded) {
    height: auto;
    min-height: 0;
  }

  .body {
    padding: var(--radius-xs) var(--space-2) var(--space-1) var(--space-2);
  }

  .spot-card:not(.expanded) .body {
    min-height: 64px;
    gap: 2px;
    overflow: hidden;
  }

  .spot-card:not(.expanded) .card-title-block {
    margin-bottom: 0;
  }

  .spot-card:not(.expanded) .card-title {
    font-size: var(--font-size-md);
  }

  .spot-card:not(.expanded) .card-attachments-wrap {
    top: calc(var(--spot-card-pad) + var(--space-1));
    left: calc(var(--spot-card-pad) + var(--space-1));
  }

  .spot-card:not(.expanded) .card-badge-group :deep(.category-chip) {
    max-width: 115px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spot-card.expanded .card-badge-group {
    top: calc(var(--spot-card-pad) + var(--space-2));
    right: calc(var(--spot-card-pad) + var(--space-2));
  }

  .spot-note-container {
    max-height: 1.45em;
  }

  .note.is-clamped {
    -webkit-line-clamp: 1;
    line-clamp: 1;
    font-size: var(--font-size-sm);
    line-height: 1.4;
  }

  .note.is-clamped :deep(.richtext) {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
}

@container spot-card (max-width: 380px) {
  .spot-card:not(.expanded) .card-badge-group :deep(.spot-location-badge-label) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .spot-card:not(.expanded) .card-badge-group :deep(.spot-location-badge) {
    padding: 2px 4px;
    gap: 2px;
  }
}

@container spot-card (max-width: 340px) {
  .spot-card:not(.expanded) .card-badge-group :deep(.category-chip-label) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .spot-card:not(.expanded) .card-badge-group :deep(.category-chip) {
    padding: 3px var(--radius-xs);
    gap: 0;
    max-width: none;
  }

  .spot-card:not(.expanded) .card-badge-group :deep(.pending-sync-badge span) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .spot-card:not(.expanded) .card-badge-group :deep(.pending-sync-badge) {
    padding: 3px var(--radius-xs);
    gap: 0;
  }

  .spot-expand-pill {
    width: 22px;
    padding: 0;
  }

  .spot-expand-label {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spot-card,
  .body,
  .spot-expand-pill,
  .spot-expand-chevron,
  .actions-accordion,
  .actions-accordion-inner > * {
    transition: none;
    transform: none !important;
  }
}
</style>
