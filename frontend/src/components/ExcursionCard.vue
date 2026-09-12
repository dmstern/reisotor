<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { excursionStationKeys, resolveStations } from '../utils/excursionStations';
import {
  fetchMergedWeather,
  summarizeWeatherRange,
  type DailyWeather,
  type WeatherRangeSummary,
} from '../utils/weather';
import { usePointerDrag } from '../composables/usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import { useTripStore } from '../stores/trip';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import EditButton from './EditButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import SpotImageCollage from './SpotImageCollage.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import PolaroidStack from './primitives/PolaroidStack.vue';
import FileAttachments from './FileAttachments.vue';
import WeatherIcon from './WeatherIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import { computePopoverPosition } from '../utils/popoverPosition';
import { TRAVEL_ROLE_META } from '../utils/travelRole';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { formatTravelDuration, travelDurationMinutes } from '../utils/travelDuration';

const props = defineProps<{
  excursion: Excursion;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  stations: Spot[];
  travelItems: TravelItem[];
  highlighted?: boolean;
  expanded: boolean;
}>();
const emit = defineEmits<{
  (e: 'edit', excursion: Excursion): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'drop-spot', spotId: number): void;
  (e: 'show-on-map'): void;
  (e: 'open', excursion: Excursion): void;
  (e: 'close'): void;
}>();

function onCardClick() {
  if (props.expanded) emit('close');
  else emit('open', props.excursion);
}

const resolvedStations = computed(() =>
  resolveStations(excursionStationKeys(props.excursion.spot_ids), props.stations, props.travelItems)
);

const hasMappedStations = computed(() =>
  resolvedStations.value.some((s) => s.lat != null && s.lng != null)
);

const fallbackImages = computed(() =>
  resolvedStations.value.map((s) => s.imageUrl).filter((url): url is string => !!url)
);
const showCollage = computed(() => !props.excursion.image_url && fallbackImages.value.length >= 2);
const displayImage = computed(() => {
  if (props.excursion.image_url) return props.excursion.image_url;
  return fallbackImages.value.length === 1 ? fallbackImages.value[0] : null;
});

const showComments = ref(false);

function formatDate(d: string) {
  return formatDateShared(d, { includeYear: false });
}

// Wetter für den geplanten Tag an allen Orten der kartierten Stationen der Tour (Issue #152)
// mit Temperatur-Range und prägnantestem Weathercode.
const weatherProvider = useWeatherProviderStore();
const mappedStations = computed(() =>
  resolvedStations.value.filter((s) => s.lat != null && s.lng != null)
);
const weatherSummary = ref<WeatherRangeSummary | null>(null);

watch(
  () => [props.excursion.date, mappedStations.value, weatherProvider.model] as const,
  async ([date, stations, model]) => {
    weatherSummary.value = null;
    if (!date || !stations.length) return;
    try {
      const stationWeathers: DailyWeather[] = [];
      const fetchedKeys = new Set<string>();

      for (const st of stations) {
        if (st.lat == null || st.lng == null) continue;
        const locKey = `${st.lat.toFixed(3)},${st.lng.toFixed(3)}`;
        if (fetchedKeys.has(locKey)) continue;
        fetchedKeys.add(locKey);

        const days = await fetchMergedWeather(props.excursion.trip_id, st.lat, st.lng, model);
        const match = days.find((d) => d.date === date);
        if (match) stationWeathers.push(match);
      }

      weatherSummary.value = summarizeWeatherRange(stationWeathers);
    } catch {
      // best effort
    }
  },
  { immediate: true }
);

// Nur noch das Datum als String - Icon/Wetter rendert das Template direkt (siehe dort), statt es
// wie zuvor in einen einzigen, nicht auftrennbaren String einzubacken.
const statusDateLabel = computed(() =>
  props.excursion.date ? formatDate(props.excursion.date) : ''
);

// #176: Anreise/Abreise/Weiterreise (ehemalige Reise-Etappe) - dieselbe Card wie eine normale Tour,
// mit zusätzlicher Rollen-/Route-/Dauer-Anzeige (übernommen aus der früheren TravelView.vue).
// resolvedStations[0]/[1] sind bei gesetzter role immer Von/Nach (siehe routes/ideas.ts's
// Zwei-Stationen-Validierung).
const routeLabel = computed(() => {
  if (!props.excursion.role || resolvedStations.value.length < 2) return null;
  if (resolvedStations.value.length === 2) {
    return `${resolvedStations.value[0].title} → ${resolvedStations.value[1].title}`;
  }
  const stopCount = resolvedStations.value.length - 2;
  const stopText = stopCount === 1 ? '1 Zwischenstopp' : `${stopCount} Zwischenstopps`;
  return `${resolvedStations.value[0].title} → ${resolvedStations.value[resolvedStations.value.length - 1].title} · ${stopText}`;
});
const travelDuration = computed(() => {
  const minutes = travelDurationMinutes(
    props.excursion.departure_time,
    props.excursion.arrival_time
  );
  return minutes == null ? null : formatTravelDuration(minutes);
});

const stationsSummaryText = computed(() => {
  if (!resolvedStations.value.length) return null;
  if (resolvedStations.value.length === 1) {
    return resolvedStations.value[0].title;
  }
  if (resolvedStations.value.length === 2) {
    return `${resolvedStations.value[0].title} → ${resolvedStations.value[1].title}`;
  }
  const stopCount = resolvedStations.value.length - 2;
  const stopText = stopCount === 1 ? '1 Zwischenstopp' : `${stopCount} Zwischenstopps`;
  return `${resolvedStations.value[0].title} → ${resolvedStations.value[resolvedStations.value.length - 1].title} · ${stopText}`;
});

// Einplanen per Zeige-/Touch-Drag am eigenen Anfasser (📅 Einplanen) statt am gesamten Card-Root:
// natives HTML5-draggable/dragstart wurde ersetzt, da es auf Touch-Geräten (v. a. Android Chrome)
// nicht zuverlässig funktioniert. onStart öffnet die Kalender-Schublade automatisch, damit die
// Tageszellen im DOM existieren; onDrop sucht per elementFromPoint die getroffene Tageszelle
// (data-date, siehe CalendarWeek.vue) und plant den Ausflug direkt über den Store ein.
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();
const { dragging, ghostStyle, onPointerDown } = usePointerDrag({
  onStart: () => {
    drawers.calendarOpen = true;
  },
  onDrop: (targetEl) => {
    const dayEl = targetEl?.closest<HTMLElement>('[data-date]');
    if (!dayEl?.dataset.date) return;
    excursionsStore.setDate(props.excursion.id, dayEl.dataset.date);
  },
  // Klick-Alternative zum Drag: öffnet die Kalender-Schublade und merkt sich den Ausflug, der beim
  // nächsten Tages-Klick eingeplant werden soll (siehe drawers.startPendingSchedule/
  // ScheduleView.vue's selectDay()).
  onTap: () => {
    drawers.startPendingSchedule('excursion', props.excursion.id);
  },
});

const tripStore = useTripStore();
const unplannedPopoverOpen = ref(false);
const unplannedPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });
const defaultDate = computed(() => {
  const trip = tripStore.currentTrip;
  const today = toLocalDateString(new Date());
  if (trip && trip.start_date && trip.end_date) {
    if (today >= trip.start_date && today <= trip.end_date) return today;
    return trip.start_date;
  }
  return today;
});
const unplannedDoneDate = ref(defaultDate.value);
watch(defaultDate, (d) => {
  unplannedDoneDate.value = d;
});

// #106/#147: Status-Kette in Planung -> geplant -> gemacht statt (wie zuvor) eines von geplant/
// ungeplant unabhängigen Flags - eine Tour darf nicht ohne Datum "gemacht" sein. Zurück auf
// "geplant" braucht dafür kein neues Datum (setDone(false) direkt). Beim Übergang zu "gemacht":
// mit Datum direkt markieren; ohne Datum (noch "in Planung") öffnet sich direkt ein kompaktes
// Popover zur Datumsauswahl (inkl. Option, in den Kalender abzuspringen).
async function onToggleDone(event?: MouseEvent) {
  if (props.excursion.done) {
    await excursionsStore.setDone(props.excursion.id, false);
  } else if (props.excursion.date) {
    await excursionsStore.setDone(props.excursion.id, true);
  } else {
    const triggerEl = (event?.currentTarget as HTMLElement | undefined) ?? null;
    if (triggerEl) {
      unplannedPopoverStyle.value = computePopoverPosition(triggerEl, {
        menuWidth: 260,
        menuHeight: 180,
      });
    }
    unplannedPopoverOpen.value = true;
    await nextTick();
    const menuEl = document.querySelector('.tour-unplanned-popover') as HTMLElement | null;
    if (menuEl && triggerEl) {
      const rect = menuEl.getBoundingClientRect();
      unplannedPopoverStyle.value = computePopoverPosition(triggerEl, {
        menuWidth: rect.width,
        menuHeight: rect.height,
      });
    }
  }
}

async function submitUnplannedDone() {
  if (!unplannedDoneDate.value) return;
  await excursionsStore.setDate(props.excursion.id, unplannedDoneDate.value);
  await excursionsStore.setDone(props.excursion.id, true);
  unplannedPopoverOpen.value = false;
}

function openCalendarConfirmDone() {
  unplannedPopoverOpen.value = false;
  drawers.startPendingSchedule('excursion', props.excursion.id, 'confirm-done');
}

// Drop-Zone fürs Zuordnen: ein Spot kann direkt auf diese Karte gezogen werden (SpotCard.vue's
// "🎒 Auf Tour ziehen"-Anfasser), um ihn als Station hinzuzufügen – "Tour zuordnen" im Spot-Formular
// (TourAssignPicker.vue, ExcursionsView.vue) bleibt daneben als schnellerer Weg ohne Reihenfolge
// bestehen, beide Wege schreiben in dasselbe spot_ids-Feld. Zähler statt Boolean, da dragenter/
// dragleave beim Überqueren von Kind-Elementen mehrfach feuern. Der types-Check filtert gezielt auf
// den von SpotCard.vue gesetzten MIME-Typ, damit andere Drags (z. B. SpotOrderPicker.vue's interne
// Umsortierung) hier keine ungewollte drop-target-Hervorhebung auslösen.
const spotDragOverCount = ref(0);
function isStationDrag(event: DragEvent) {
  return !!event.dataTransfer?.types.includes('text/spot-id');
}
function onSpotDragEnter(event: DragEvent) {
  if (!isStationDrag(event)) return;
  spotDragOverCount.value++;
}
function onSpotDragLeave(event: DragEvent) {
  if (!isStationDrag(event)) return;
  spotDragOverCount.value = Math.max(0, spotDragOverCount.value - 1);
}
function onSpotDrop(event: DragEvent) {
  spotDragOverCount.value = 0;
  const rawSpotId = event.dataTransfer?.getData('text/spot-id');
  if (rawSpotId) emit('drop-spot', Number(rawSpotId));
}
</script>

<template>
  <Card
    class="excursion-card"
    :class="{
      'drop-target': spotDragOverCount > 0,
      'new-highlight': highlighted,
      expanded,
      'has-role': !!excursion.role,
      'is-travel': !!excursion.role,
    }"
    @click="onCardClick"
    @dragover.prevent
    @dragenter.prevent="onSpotDragEnter"
    @dragleave="onSpotDragLeave"
    @drop.prevent="onSpotDrop"
  >
    <div class="tour-card-main">
      <div
        class="tour-image"
        :style="displayImage ? { backgroundImage: `url(${displayImage})` } : {}"
      >
        <SpotImageCollage v-if="showCollage" :images="fallbackImages" />
        <AppIcon
          v-else-if="!displayImage"
          class="placeholder"
          :size="30"
          :icon="
            excursion.role
              ? travelTypeIconDef(excursion.transport_type)
              : SECTION_ICON_DEFS.excursions
          "
          group="categories"
        />

        <!-- Floating Edit-Button im aufgeklappten Zustand -->
        <Transition name="fade">
          <EditButton
            v-if="expanded"
            floating
            class="tour-image-edit-btn"
            @click="emit('edit', excursion)"
          />
        </Transition>
      </div>

      <div class="body">
        <div class="card-header-row">
          <div class="card-title-block">
            <h3 class="card-title" :title="excursion.title">{{ excursion.title }}</h3>
            <Transition name="fade">
              <div
                v-if="
                  expanded &&
                  (creatorLabel || routeLabel || resolvedStations.length || travelDuration)
                "
                class="card-title-meta"
              >
                <span v-if="creatorLabel" class="overlay-author">Von {{ creatorLabel }}</span>
                <span v-if="routeLabel" class="overlay-submeta">
                  <template v-if="creatorLabel">· </template>{{ routeLabel }}
                </span>
                <span v-else-if="resolvedStations.length" class="overlay-submeta">
                  <template v-if="creatorLabel">· </template>{{ resolvedStations.length }}
                  {{ resolvedStations.length === 1 ? 'Station' : 'Stationen' }}
                </span>
                <span v-if="travelDuration" class="overlay-submeta">· {{ travelDuration }}</span>
              </div>
            </Transition>
          </div>

          <div class="card-badge-group">
            <span v-if="excursion.role" class="role-badge">
              <AppIcon
                :icon="TRAVEL_ROLE_META[excursion.role].tabler"
                :size="14"
                group="categories"
              />
              {{ TRAVEL_ROLE_META[excursion.role].label }}
            </span>
            <span v-else class="tour-type-badge" title="Tour / Ausflug">
              <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="12" group="categories" /> Tour
            </span>
            <PendingSyncBadge v-if="excursion._pending" />
          </div>
        </div>
        <!-- Stationen-Vorschau mit Polaroid-Stapel (#235) -->
        <div
          v-if="resolvedStations.length"
          class="tour-stations-preview"
          :class="{ 'is-fanned-out': expanded }"
        >
          <!-- Polaroid-Stapel: Mini-Polaroids im collapsed Zustand, morpht beim Aufklappen -->
          <PolaroidStack
            class="tour-polaroid-stack"
            :items="resolvedStations"
            :expanded="expanded"
            :interactive="false"
            :title="`${resolvedStations.length} Stationen`"
            aria-hidden="true"
          />

          <div class="tour-stations-meta" v-if="!expanded">
            <p v-if="routeLabel" class="route">{{ routeLabel }}</p>
            <p v-else-if="stationsSummaryText" class="route tour-stations-summary">
              {{ stationsSummaryText }}
            </p>
            <p
              v-if="
                (excursion.role || excursion.legs?.length) &&
                (excursion.departure_time || excursion.arrival_time)
              "
              class="departure-arrival"
            >
              <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" />
              <span v-if="excursion.departure_time"
                >{{ excursion.departure_time
                }}<span v-if="excursion.arrival_time">–{{ excursion.arrival_time }}</span> Uhr</span
              >
              <span v-if="travelDuration" class="duration">({{ travelDuration }})</span>
            </p>
          </div>
        </div>

        <template v-else>
          <p v-if="!expanded && routeLabel" class="route">{{ routeLabel }}</p>
          <p
            v-if="
              !expanded &&
              (excursion.role || excursion.legs?.length) &&
              (excursion.departure_time || excursion.arrival_time)
            "
            class="departure-arrival"
          >
            <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" />
            <span v-if="excursion.departure_time"
              >{{ excursion.departure_time
              }}<span v-if="excursion.arrival_time">–{{ excursion.arrival_time }}</span> Uhr</span
            >
            <span v-if="travelDuration" class="duration">({{ travelDuration }})</span>
          </p>
        </template>

        <!-- Tour-Notiz: Trunkiert mit Ellipsis sowohl im collapsed als auch im expanded Zustand (#235) -->
        <div v-if="excursion.note" class="tour-note-container" :class="{ 'is-expanded': expanded }">
          <RichTextDisplay
            class="note is-clamped"
            :class="{ 'is-expanded': expanded }"
            :content="excursion.note"
            :format="excursion.note_format"
          />
        </div>

        <!-- Tour-Anhänge (Dateien / Tickets / Buchungen) - nur im aufgeklappten Zustand laden -->
        <div v-if="expanded" class="tour-attachments-wrap">
          <FileAttachments domain="ideas" :entity-id="excursion.id" :editable="false" />
        </div>

        <div class="links" v-if="hasMappedStations">
          <Button
            variant="card-action"
            class="show-on-map-btn"
            aria-label="Auf Karte anzeigen"
            title="Auf Karte anzeigen"
            @click.stop="emit('show-on-map')"
          >
            <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
            <span class="btn-label">Auf Karte anzeigen</span>
          </Button>
        </div>
        <div class="card-actions-wrapper">
          <div class="card-actions">
            <button
              v-if="!excursion.date"
              type="button"
              class="calendar-drag-handle"
              aria-label="Auf Kalender ziehen zum Einplanen"
              title="Auf Kalender ziehen zum Einplanen"
              @pointerdown="onPointerDown"
              @click.stop
            >
              <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Einplanen
            </button>
            <!-- Verschmolzener Status-Button (Geplant-Status + Gemacht-Checkbox) – in beiden Zuständen -->
            <button
              type="button"
              class="done-toggle"
              :class="{
                status: !!(excursion.date || excursion.done),
                planned: !!(excursion.date && !excursion.done),
                'status-done': !!excursion.done,
                active: !!excursion.done,
              }"
              :aria-pressed="!!excursion.done"
              :aria-label="
                excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'
              "
              :title="excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
              @click.stop="onToggleDone"
            >
              <template v-if="excursion.done">
                <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
                <span class="status-text">
                  <template v-if="excursion.date">Gemacht am {{ statusDateLabel }}</template>
                  <template v-else>Gemacht</template>
                  <template v-if="weatherSummary">
                    · <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
                    {{ weatherSummary.tempLabel }}
                  </template>
                </span>
              </template>
              <template v-else-if="excursion.date">
                <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" />
                <span class="status-text">
                  Geplant für {{ statusDateLabel }}
                  <template v-if="weatherSummary">
                    · <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
                    {{ weatherSummary.tempLabel }}
                  </template>
                </span>
              </template>
              <template v-else>
                <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" />
                <span>Als gemacht markieren</span>
              </template>
            </button>
          </div>

          <div class="card-social-actions" :class="{ 'is-expanded': expanded }">
            <Transition name="comment-pop">
              <Button
                v-if="expanded"
                type="button"
                variant="ghost"
                size="sm"
                class="comment-btn"
                :class="{ 'has-comments': comments.length > 0, active: showComments }"
                aria-label="Kommentare anzeigen"
                :title="comments.length ? `${comments.length} Kommentare` : 'Kommentar schreiben'"
                @click.stop="showComments = !showComments"
              >
                <AppIcon :icon="ACTION_ICONS.comment" :size="15" group="actions" />
                <span v-if="comments.length > 0" class="social-count">{{ comments.length }}</span>
              </Button>
            </Transition>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="like-btn"
              :class="{ liked }"
              :aria-label="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
              :title="liked ? 'Gefällt mir nicht mehr' : 'Gefällt mir'"
              @click.stop="emit('toggle-like')"
            >
              <AppIcon
                :icon="liked ? ACTION_ICONS.liked : ACTION_ICONS.unliked"
                :size="15"
                group="actions"
              />
              <span v-if="likeCount > 0" class="social-count">{{ likeCount }}</span>
            </Button>
          </div>
        </div>

        <Teleport to="body">
          <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">
            <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" />
            {{ excursion.title }}
          </div>
          <PickerMenu
            v-if="unplannedPopoverOpen"
            class="tour-unplanned-popover"
            :style="unplannedPopoverStyle"
            @close="unplannedPopoverOpen = false"
          >
            <div class="unplanned-popover-content">
              <div class="popover-title-row">
                <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
                <span class="popover-heading">Tour als gemacht markieren</span>
              </div>
              <p class="popover-subtext">An welchem Tag wurde diese Tour gemacht?</p>
              <Input
                v-model="unplannedDoneDate"
                type="date"
                class="popover-date-input"
                aria-label="Datum der gemachten Tour"
                @keyup.enter="submitUnplannedDone"
              />
              <div class="popover-buttons">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  :disabled="!unplannedDoneDate"
                  @click="submitUnplannedDone"
                >
                  Als gemacht markieren
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="calendar-alt-link"
                  @click="openCalendarConfirmDone"
                >
                  <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
                  Im Kalender auswählen
                </Button>
              </div>
            </div>
          </PickerMenu>
        </Teleport>

        <div
          class="excursion-accordion"
          :class="{ 'is-expanded': expanded && showComments }"
          :inert="!expanded || !showComments"
        >
          <div class="excursion-accordion-inner accordion-stagger">
            <Comments
              v-if="showComments"
              :comments="comments"
              @click.stop
              @submit="(content) => emit('submit-comment', content)"
              @remove="(id) => emit('remove-comment', id)"
            />
          </div>
        </div>
      </div>
    </div>
  </Card>
</template>

<style scoped>
/* Volle Breite statt kleiner Grid-Card (wie Tagebucheinträge) – macht Ausflüge auf einen Blick von
   den (weiterhin als Grid angezeigten) Spots unterscheidbar. Bild als schmale, feste Miniatur
   links statt großem Banner oben, damit es bei voller Breite nicht unnötig gestreckt wirkt. */
.excursion-card {
  --excursion-theme-color: var(--color-tour);
  --excursion-theme-dark: var(--color-tour-dark);
  --excursion-theme-tint: var(--color-tour-tint);
  --excursion-theme-border: var(--color-tour-border);

  position: relative;
  z-index: 1;
  isolation: isolate;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 120px;
  border-width: var(--ui-border-width, 1px);
  border-style: solid;
  border-color: var(--excursion-theme-border);
  background: var(--color-surface);
  cursor: pointer;
  overflow: hidden;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance, 48px));
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.excursion-card.is-travel,
.excursion-card.has-role {
  --excursion-theme-color: var(--color-travel);
  --excursion-theme-dark: var(--color-travel-dark);
  --excursion-theme-tint: var(--color-travel-tint);
  --excursion-theme-border: var(--color-travel-border);
}

.excursion-card:not(.expanded):hover {
  transform: translateY(-4px) scale(1.015);
  border-color: var(--excursion-theme-color);
  box-shadow: var(--shadow-md);
  z-index: 5;
}

.excursion-card:not(.expanded):active {
  transform: translateY(0) scale(0.99);
}

.excursion-card.expanded {
  transform: translateY(0) scale(1);
}

.excursion-accordion {
  display: grid;
  grid-template-rows: 0fr;
  /* Beim Zuklappen sofort zusammenfalten (Stufe 1) */
  transition: grid-template-rows 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0s;
}

.excursion-accordion.is-expanded {
  grid-template-rows: 1fr;
  /* Beim Aufklappen nach Bild-Morph entfalten (Stufe 2) */
  transition: grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s;
}

.excursion-accordion-inner {
  overflow: hidden;
}

.tour-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  position: relative;
  padding: 10px 14px 10px 10px;
  gap: 12px;
}

/* Spot per Drag&Drop aus der Spots-Sicht darauf ablegen (SpotCard.vue ist die Drag-Quelle). */
.excursion-card.drop-target {
  border-color: var(--excursion-theme-color);
  background: var(--excursion-theme-tint);
}

/* Ersetzt den früheren ExcursionDetailDialog.vue-Modal-Dialog (#92): die Karte wächst an Ort und
   Stelle leicht (zusätzliche Zeilen für Ersteller:in/Notiz, siehe Template), statt einen Dialog
   über die Karte zu legen - exakt dasselbe Prinzip wie SpotCard.vue's .spot-card.expanded. Fester
   statt gestrichelter Rahmen (anders als .drop-target oben), damit die beiden Zustände optisch
   unterscheidbar bleiben. */
.excursion-card.expanded {
  border-style: solid;
  border-color: var(--excursion-theme-color);
  background: var(--excursion-theme-tint);
}

.tour-image {
  width: 110px;
  flex-shrink: 0;
  align-self: stretch;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  overflow: hidden;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.tour-type-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--excursion-theme-tint);
  color: var(--excursion-theme-color);
  border: 1px solid var(--excursion-theme-border);
}

.placeholder {
  font-size: 2rem;
  color: var(--excursion-theme-color);
  opacity: 0.7;
}

.tour-image-edit-btn {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
}

.body {
  position: relative;
  z-index: 2;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.card-header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}

.card-title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    font-size 0.2s ease,
    color 0.2s ease;
}

.excursion-card.expanded .card-title {
  font-size: 1.125rem;
  line-height: 1.3;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-title-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  flex-wrap: wrap;
  margin-top: 2px;
}

.overlay-author {
  font-weight: 600;
}

.overlay-submeta {
  opacity: 0.9;
}

.card-badge-group {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.show-on-map-btn {
  transition:
    width 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.28s ease,
    padding 0.28s ease;
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

/* Unten statt oben rechts positioniert (#210, analog zu SpotCard.vue) */
.status {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  max-width: calc(100% - var(--space-4));
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  box-sizing: border-box;
  /* Beim Aufklappen: Text entfaltet sich erst, wenn Banner Breite gewonnen hat */
  transition:
    width 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s,
    height 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s,
    padding 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s,
    gap 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.08s,
    border-radius 0.28s ease 0.08s;
}

.status-text {
  display: inline-block;
  opacity: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: opacity 0.2s ease 0.14s;
}

.status.planned,
.status.status-done {
  color: var(--color-success);
}

:root[data-theme='dark'] .status {
  background: rgba(35, 34, 32, 0.85);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .status {
    background: rgba(35, 34, 32, 0.85);
  }
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

/* Eigener Anfasser statt des gesamten Card-Roots als Drag-Quelle (siehe usePointerDrag-Wiring im
   Script) – touch-action:none verhindert, dass der Browser das Ziehen als Seiten-Scroll
   interpretiert. Das ::before-Punkte-Raster macht ihn auf einen Blick als Zieh-Griff statt als
   normalen Button erkennbar (identisches Muster wie SpotCard.vue's Anfasser). */
.calendar-drag-handle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  corner-shape: round;
  padding: 3px 10px 3px 8px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Verschmolzener Status-Toggle (Geplant-Status + Gemacht-Checkbox) */
.done-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  corner-shape: round;
  padding: 3px 10px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.done-toggle:hover {
  background: var(--color-surface);
  border-color: var(--excursion-theme-color);
  color: var(--color-text);
}

.done-toggle.planned {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-surface);
}

.done-toggle.planned:hover {
  border-color: var(--color-success);
  color: var(--color-success);
}

.done-toggle.active,
.done-toggle.status-done {
  color: var(--color-success);
  font-weight: 600;
  background: var(--excursion-theme-tint);
  border-color: var(--color-success);
}

.card-actions .done-toggle.status {
  position: static;
  bottom: auto;
  right: auto;
}

.calendar-drag-handle::before {
  content: '';
  flex-shrink: 0;
  width: 6px;
  height: 12px;
  background-image:
    radial-gradient(circle, currentColor 1px, transparent 1.3px),
    radial-gradient(circle, currentColor 1px, transparent 1.3px);
  background-size:
    3px 4px,
    3px 4px;
  background-position:
    0 0,
    3px 0;
  background-repeat: repeat-y, repeat-y;
  opacity: 0.6;
}

.calendar-drag-handle:active {
  cursor: grabbing;
}

/* Schwebt während des Drags am Zeiger, per Teleport außerhalb der Karte (sonst würde sie beim
   Öffnen der Kalender-Schublade durch deren Backdrop/Panel überlagert). z-index 60: über dem
   Drawer-Overlay (11/12), unter Modal.vue (100, wird während eines Drags nie gleichzeitig
   gebraucht). Fester dunkler Chip statt Dark-Mode-Override, da sie über beliebigem Seiteninhalt
   schwebt statt über einem Foto. */
.drag-ghost {
  position: fixed;
  z-index: 60;
  transform: translate(-50%, -130%);
  pointer-events: none;
  background: rgba(35, 34, 32, 0.92);
  color: #f2efe9;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
}

.card-actions-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: auto;
  position: relative;
  z-index: 2;
}

.card-social-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  flex-shrink: 0;
}

.like-btn,
.comment-btn {
  color: var(--color-text-muted);
}

.like-btn.liked {
  color: var(--color-like);
}

.like-btn.liked:hover {
  background: var(--color-like-tint);
}

.comment-btn.active,
.comment-btn.has-comments {
  color: var(--color-primary);
}

.social-count {
  font-size: 0.8rem;
  font-weight: 600;
  margin-left: 2px;
}

.comment-pop-enter-active,
.comment-pop-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.2s cubic-bezier(0.32, 0.72, 0, 1),
    max-width 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
}

.comment-pop-enter-from,
.comment-pop-leave-to {
  opacity: 0;
  max-width: 0;
  transform: scale(0.85) translateX(6px);
}

.comment-pop-enter-to,
.comment-pop-leave-from {
  opacity: 1;
  max-width: 65px;
  transform: scale(1) translateX(0);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: 4px;
}

/* Tour-Notiz: Fließender Übergang zwischen 1-2-zeiligem Teaser und voller Höhe (#235) */
.tour-note-container {
  display: block;
  position: relative;
  margin-top: 2px;
  overflow: hidden;
  transition:
    max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin 0.25s ease;
}

.tour-note-container:not(.is-expanded) {
  max-height: 2.8em;
}

.tour-note-container.is-expanded {
  max-height: 500px;
}

.note {
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text);
  transition: color 0.2s ease;
}

.note.is-clamped {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--color-text-muted);
}

.note.is-clamped.is-expanded {
  -webkit-line-clamp: unset;
  display: block;
  color: var(--color-text);
}

.note.is-clamped :deep(.richtext) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note.is-clamped.is-expanded :deep(.richtext) {
  -webkit-line-clamp: unset;
  display: block;
}

.note.is-clamped :deep(p),
.note.is-clamped :deep(div) {
  display: inline;
  margin: 0;
}

.note.is-clamped :deep(p + p::before),
.note.is-clamped :deep(div + div::before) {
  content: ' ';
}

.role-badge {
  flex-shrink: 0;
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  border-radius: var(--radius-pill);
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.route {
  overflow-wrap: anywhere;
  margin: 0;
  font-size: 0.9rem;
}

.departure-arrival {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.duration {
  color: var(--color-text-muted);
}

/* Stationen-Vorschau mit Polaroid-Stapel (#235) */
.tour-stations-preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-1) 0;
  position: relative;
  transition:
    max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin 0.35s ease,
    opacity 0.25s ease;
}

.tour-stations-preview.is-fanned-out {
  max-height: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
  overflow: visible;
}

/* Hover-Effekt auf der Collapsed Card: Sanftes Auffächern der Station-Polaroids (#235) */
.excursion-card:not(.expanded):hover :deep(.tour-polaroid-stack .polaroid-tile) {
  transform: var(--tile-fanned-transform);
}

.excursion-card:not(.expanded):hover :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
  box-shadow:
    0 6px 14px rgba(0, 0, 0, 0.2),
    0 2px 5px rgba(0, 0, 0, 0.12);
}

:root[data-theme='dark']
  .excursion-card:not(.expanded):hover
  :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.55),
    0 2px 5px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light'])
    .excursion-card:not(.expanded):hover
    :deep(.tour-polaroid-stack .polaroid-tile:first-child) {
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.55),
      0 2px 5px rgba(0, 0, 0, 0.3);
  }
}

.tour-attachments-wrap {
  margin-top: var(--space-2);
}

.tour-stations-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tour-stations-summary {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.excursion-accordion-inner > * {
  transition:
    opacity 0.2s ease 0s,
    transform 0.2s ease 0s;
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}

.excursion-accordion.is-expanded .excursion-accordion-inner > * {
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx, 0) * 35ms + 140ms);
}

@container spots-col (max-width: 480px) {
  .tour-card-main {
    padding: 8px 10px 8px 8px;
    gap: 8px;
  }

  .tour-image {
    width: 76px;
    border-radius: var(--radius-sm-squircle);
  }

  .tour-image .placeholder {
    font-size: 1.5rem;
  }

  .card-title {
    font-size: 0.9rem;
  }

  .excursion-card.expanded .card-title {
    font-size: 1rem;
  }

  .role-badge {
    font-size: 0.7rem;
    padding: 1px 6px;
  }

  .tour-type-badge {
    font-size: 0.65rem;
    padding: 1px 6px;
  }

  .excursion-card:not(.expanded) .show-on-map-btn {
    width: 22px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    gap: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .excursion-card:not(.expanded) .show-on-map-btn .btn-label {
    max-width: 0;
    opacity: 0;
    margin: 0;
  }

  .excursion-card:not(.expanded) .links {
    margin: 0;
  }

  .excursion-card:not(.expanded) .card-actions {
    display: none;
  }

  .tour-stations-preview {
    gap: var(--space-2);
    margin: 2px 0;
  }

  :deep(.tour-polaroid-stack) {
    width: 46px;
    height: 56px;
  }

  :deep(.tour-polaroid-stack .polaroid-tile) {
    width: 42px;
    height: 52px;
    padding: 2px 2px 8px 2px;
  }

  :deep(.tour-polaroid-stack .polaroid-photo-frame) {
    height: 34px;
  }

  :deep(.tour-polaroid-stack .polaroid-chin) {
    height: 8px;
  }

  :deep(.tour-polaroid-stack .polaroid-caption) {
    font-size: 0.4rem;
  }

  .tour-note-container:not(.is-expanded) {
    max-height: 1.4em;
  }

  .tour-note-container.is-expanded {
    max-height: 300px;
  }

  .note.is-clamped {
    -webkit-line-clamp: 1;
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .note.is-clamped.is-expanded {
    -webkit-line-clamp: unset;
    display: block;
  }

  .note.is-clamped :deep(.richtext) {
    -webkit-line-clamp: 1;
  }

  .note.is-clamped.is-expanded :deep(.richtext) {
    -webkit-line-clamp: unset;
    display: block;
  }
}

@media (prefers-reduced-motion: reduce) {
  .excursion-card,
  .body,
  .excursion-accordion,
  .status,
  .status-text,
  .show-on-map-btn,
  .show-on-map-btn .btn-label,
  .excursion-accordion-inner > *,
  .polaroid-tile,
  .tour-stations-preview,
  .tour-stations-preview.is-fanned-out .polaroid-tile,
  .tour-note-container {
    transform: none !important;
    transition: opacity 0.15s ease !important;
  }
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.unplanned-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  min-width: 250px;
}

.popover-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-text);
}

.popover-subtext {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.3;
}

.popover-date-input {
  width: 100%;
}

.popover-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.calendar-alt-link {
  font-size: 0.78rem !important;
  color: var(--color-text-muted) !important;
  justify-content: center;
}

.calendar-alt-link:hover {
  color: var(--color-primary) !important;
}
</style>
