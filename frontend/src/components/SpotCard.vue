<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue';
import type { Spot } from '../api/types';
import { IconFlag, IconFlagFilled } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { useDrawersStore } from '../stores/drawers';
import { useSpotTourAssignment } from '../composables/useSpotTourAssignment';
import CategoryChip from './CategoryChip.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import TourAssignDropdown from './TourAssignDropdown.vue';
import FileAttachments from './FileAttachments.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SocialRow from './SocialRow.vue';
import AppIcon from './AppIcon.vue';
import Accordion from './primitives/Accordion.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import Card from './primitives/Card.vue';
import SpotCoverImage from './SpotCoverImage.vue';
import SpotDetails from './SpotDetails.vue';
import SpotDoneStatus from './SpotDoneStatus.vue';
import SpotCalendarDragHandle from './SpotCalendarDragHandle.vue';
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
    // Ob die Spots-Liste gerade nach Kategorie oder nach Touren gruppiert ist (ExcursionsView.vue) -
    // steuert (#106), ob zusätzlich zum "Tour zuordnen"-Dropdown auch der native Drag-Anfasser
    // gezeigt wird: der ergibt nur in der Touren-Gruppierung Sinn, wo echte Tour-Karten als
    // Ablageziele sichtbar sind (siehe onDragStart unten).
    groupMode: 'category' | 'tours';
    // Alle bestehenden Tour-Titel, fürs "Tour zuordnen"-Dropdown (TourAssignDropdown.vue).
    tourOptions?: string[];
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
  (e: 'assign-tour', title: string): void;
  (e: 'show-on-map'): void;
}>();

const showComments = ref(false);
const drawers = useDrawersStore();

// Tour-Zuordnungen als Checkliste & natives Drag-and-Drop (#106, #226, #227)
const { tourAssignments, onToggleTour, onCreateTour, onDragStart, onDragEnd } =
  useSpotTourAssignment({
    spot: () => props.spot,
    groupMode: () => props.groupMode,
  });

// Klick auf die Karte klappt sie nur auf-/zu, statt einen Modal-Dialog zu öffnen
const cardRoot = ref<ComponentPublicInstance | HTMLElement | null>(null);

function getCardDomElement(event?: MouseEvent): HTMLElement | null {
  if (event?.currentTarget instanceof HTMLElement) {
    return event.currentTarget;
  }
  const root = cardRoot.value;
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  if ('$el' in root && root.$el instanceof HTMLElement) return root.$el;
  return null;
}

function onCardClick(event?: MouseEvent) {
  if (props.expanded) {
    emit('close');
    if (drawers.mapFocusKey === `spot-${props.spot.id}`) drawers.mapFocusKey = null;
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
  if (props.expanded) return '0deg';
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
      @edit="emit('edit', spot)"
    />

    <!-- Gleitende Badge-Gruppe: Ein einziges Element, das nahtlos zwischen Body und Cover-Ecke gleitet -->
    <div class="card-badge-group">
      <CategoryChip :category="spot.category" :icon-only="iconOnlyCategory" />
      <PendingSyncBadge v-if="spot._pending" />
    </div>

    <div class="body">
      <!-- Einheitlicher Card-Titel und Notiz im Body (nur im eingeklappten Zustand) -->
      <template v-if="!expanded">
        <div class="card-title-block">
          <component :is="headingTag" class="card-title" :title="spot.title">
            {{ spot.title }}
          </component>
        </div>
        <!-- Spot-Notiz: Trunkiert mit Ellipsis im collapsed Zustand (#235) -->
        <div v-if="spot.note" class="spot-note-container">
          <RichTextDisplay
            class="note is-clamped"
            :content="spot.note"
            :format="spot.note_format"
          />
        </div>
      </template>

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
              <TourAssignDropdown
                :tours="tourAssignments"
                :can-drag="groupMode === 'tours'"
                @toggle-tour="onToggleTour"
                @create-tour="onCreateTour"
                @dragstart="onDragStart"
                @dragend="onDragEnd"
              />
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
              <SpotCalendarDragHandle v-if="!isAccommodation" :spot="spot" />
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

      <!-- Untere Zeile (Footer): Umsteigezeit/Anhänge links, Social Actions im collapsed Zustand -->
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

        <SocialRow
          v-if="!expanded"
          :like-count="likeCount"
          :liked="liked"
          :show-comments-button="false"
          @toggle-like="emit('toggle-like')"
        />
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

<style scoped>
.spot-card {
  container: spot-card / inline-size;
  position: relative;
  z-index: 1;
  isolation: isolate;
  padding: 8px 8px 14px 8px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
  box-sizing: border-box;
  width: 100%;
}

.spot-card:hover {
  z-index: 5;
}

.spot-card:not(.expanded) {
  height: auto;
  min-height: 0;
}

.spot-card.expanded {
  border-color: var(--color-primary);
  transform: translateY(0) rotate(0deg) scale(1);
}

/* Card Badge Group: gleitet sanft zwischen Body und Cover-Ecke */
.card-badge-group {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  pointer-events: auto;
}

.card-badge-group > * {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

.spot-card:not(.expanded) .card-badge-group {
  top: calc(8px + 120px + var(--space-1));
  right: calc(8px + var(--space-1));
  transition:
    top 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s,
    right 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s;
}

.spot-card.expanded .card-badge-group {
  top: calc(8px + var(--space-2));
  right: calc(8px + var(--space-2));
  transition:
    top 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    right 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s;
}

.card-badge-group :deep(.category-chip) {
  cursor: default;
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    padding 0.2s ease,
    gap 0.2s ease;
}

.spot-card.expanded .card-badge-group :deep(.category-chip) {
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.15);
}

.body {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 8px var(--space-2) 0 var(--space-2);
  gap: var(--space-2);
  min-width: 0;
  transition: padding 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  box-sizing: border-box;
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
  min-width: 0;
  padding-right: 130px;
  box-sizing: border-box;
  transition:
    padding-right 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    margin-bottom 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.spot-card:not(.expanded):has(.pending-sync-badge) .card-title-block {
  padding-right: 165px;
}

.spot-card:not(.expanded):has(.category-chip.is-icon-only) .card-title-block {
  padding-right: 48px;
}

.spot-card:not(.expanded):has(.category-chip.is-icon-only):has(.pending-sync-badge)
  .card-title-block {
  padding-right: 84px;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-note-container {
  overflow: hidden;
  max-height: 2.8em;
  margin-top: -4px;
}

.note {
  overflow-wrap: anywhere;
  color: var(--color-text-muted);
  font-size: 0.82rem;
  line-height: 1.35;
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
  z-index: 2;
  box-sizing: border-box;
}

.spot-card.expanded .card-footer-row:not(:has(.file-attachments, .spot-layover-badge)) {
  display: none;
}

.card-footer-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.spot-card:not(.expanded) .card-footer-left {
  max-width: calc(100% - 70px);
}

.spot-card:not(.expanded) .card-footer-row {
  margin-top: auto;
}

.spot-card.has-layover:not(.expanded) .card-footer-row {
  align-items: flex-end;
  min-height: 32px;
}

.spot-card.has-layover:not(.expanded) .card-social-actions {
  position: absolute;
  right: 0;
  bottom: 0;
}

.spot-card.has-layover:not(.expanded) .card-actions {
  padding-right: 76px;
}

.spot-layover-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  top: 12px;
  left: 12px;
  z-index: 6;
  width: auto;
}

.spot-card:not(.expanded) .card-attachments-wrap :deep(.file-attachments) {
  padding: 0;
}

.card-attachments-wrap :deep(.file-attachments) {
  width: 100%;
}

.card-attachments-wrap :deep(.heading) {
  font-size: 0.8rem;
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

.spot-card:not(.expanded) .card-social-actions {
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 2;
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

.spot-destination-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  transition: all 0.2s ease;
}

.spot-destination-toggle:hover {
  background: var(--color-background);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.spot-destination-toggle.is-active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.spot-destination-toggle,
:deep(.tour-assign-btn) {
  position: relative;
}

.spot-destination-toggle::after,
:deep(.tour-assign-btn)::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  inset-inline: 0;
  height: 44px;
  min-height: 44px;
}

@media (pointer: fine) {
  .spot-destination-toggle::after,
  :deep(.tour-assign-btn)::after {
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
  padding: 3px;
  margin: -3px;
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
    padding: 6px 6px 10px 6px;
  }

  .spot-card:not(.expanded) {
    height: auto;
    min-height: 0;
  }

  .body {
    padding: 6px var(--space-2) 4px var(--space-2);
  }

  .spot-card:not(.expanded) .body {
    min-height: 64px;
    gap: 2px;
    overflow: hidden;
  }

  .spot-card:not(.expanded) .card-title-block {
    margin-bottom: 0;
    padding-right: 125px;
  }

  .spot-card:not(.expanded):has(.pending-sync-badge) .card-title-block {
    padding-right: 160px;
  }

  .spot-card:not(.expanded) .card-title {
    font-size: 0.92rem;
  }

  .spot-card:not(.expanded) .card-attachments-wrap {
    top: 10px;
    left: 10px;
  }

  .spot-card:not(.expanded) .card-badge-group {
    top: calc(6px + 100px + var(--space-1));
    right: calc(6px + var(--space-1));
    transition:
      top 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s,
      right 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s;
  }

  .spot-card:not(.expanded) .card-badge-group :deep(.category-chip) {
    max-width: 115px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .spot-card.expanded .card-badge-group {
    top: calc(6px + var(--space-2));
    right: calc(6px + var(--space-2));
    transition:
      top 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
      right 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s;
  }

  .spot-card:not(.expanded) .card-social-actions {
    bottom: 6px;
    right: var(--space-2);
  }

  .spot-note-container {
    max-height: 1.4em;
  }

  .note.is-clamped {
    -webkit-line-clamp: 1;
    line-clamp: 1;
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .note.is-clamped :deep(.richtext) {
    -webkit-line-clamp: 1;
    line-clamp: 1;
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
    padding: 3px 6px;
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
    padding: 3px 6px;
    gap: 0;
  }

  .spot-card:not(.expanded) .card-title-block {
    padding-right: 44px;
  }

  .spot-card:not(.expanded):has(.pending-sync-badge) .card-title-block {
    padding-right: 76px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spot-card,
  .body,
  .actions-accordion,
  .actions-accordion-inner > * {
    transition: none;
  }
}
</style>
