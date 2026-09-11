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

// Polaroid-Kacheln für die Spots der Tour im collapsed Zustand (#235)
const polaroidStations = computed(() => resolvedStations.value.slice(0, 4));
const extraStationCount = computed(() =>
  Math.max(0, resolvedStations.value.length - polaroidStations.value.length)
);

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

function polaroidStyle(idx: number, total: number) {
  if (total === 1) {
    return {
      transform: 'rotate(-2deg) translate(0px, 0px)',
      zIndex: 1,
    };
  }
  const angles = [-8, 6, -3, 7];
  const xOffsets = [-6, 4, 1, 6];
  const yOffsets = [2, -2, 1, 0];
  return {
    transform: `rotate(${angles[idx % angles.length]}deg) translate(${xOffsets[idx % xOffsets.length]}px, ${yOffsets[idx % yOffsets.length]}px)`,
    zIndex: idx + 1,
  };
}

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
    }"
    @click="onCardClick"
    @dragover.prevent
    @dragenter.prevent="onSpotDragEnter"
    @dragleave="onSpotDragLeave"
    @drop.prevent="onSpotDrop"
  >
    <!-- Akzentbalken an der abgerundeten linken Kante mit Rollen-/Rucksack-Icon -->
    <div
      class="tour-accent-bar"
      :title="excursion.role ? TRAVEL_ROLE_META[excursion.role].label : 'Tour / Ausflug'"
      aria-hidden="true"
    >
      <div class="tour-accent-badge">
        <AppIcon
          :icon="
            excursion.role ? TRAVEL_ROLE_META[excursion.role].tabler : SECTION_ICON_DEFS.excursions
          "
          group="categories"
          :size="14"
        />
      </div>
      <span class="tour-bar-label">{{ excursion.role ? 'REISE' : 'TOUR' }}</span>
    </div>
    <div class="tour-card-main">
      <div class="image" :style="displayImage ? { backgroundImage: `url(${displayImage})` } : {}">
        <SpotImageCollage v-if="showCollage" :images="fallbackImages" />
        <AppIcon
          v-else-if="!displayImage"
          class="placeholder"
          :size="35"
          :icon="
            excursion.role
              ? travelTypeIconDef(excursion.transport_type)
              : SECTION_ICON_DEFS.excursions
          "
          group="categories"
        />

        <!-- Expanded Cover Overlay: Halbdunkles Gradient-Overlay mit Edit-Button -->
        <Transition name="overlay-fade">
          <div v-if="expanded" class="image-expanded-overlay">
            <div class="overlay-top-row">
              <EditButton floating class="overlay-edit-btn" @click="emit('edit', excursion)" />
            </div>
          </div>
        </Transition>
      </div>

      <!-- Gleitende Badge-Gruppe: Ein einziges Element, das nahtlos zwischen Body und Cover-Ecke gleitet -->
      <div class="card-badge-group">
        <span v-if="excursion.role" class="role-badge">
          <AppIcon :icon="TRAVEL_ROLE_META[excursion.role].tabler" :size="14" group="categories" />
          {{ TRAVEL_ROLE_META[excursion.role].label }}
        </span>
        <span v-else class="tour-type-badge" title="Tour / Ausflug">
          <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="12" group="categories" /> Tour
        </span>
        <PendingSyncBadge v-if="excursion._pending" />
      </div>

      <div class="body">
        <!-- Einheitlicher Card-Titel: gleitet beim Expandieren nahtlos vom Body in den Cover-Header -->
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
              <span v-if="routeLabel" class="overlay-submeta">{{ routeLabel }}</span>
              <span v-else-if="resolvedStations.length" class="overlay-submeta">
                {{ resolvedStations.length }}
                {{ resolvedStations.length === 1 ? 'Station' : 'Stationen' }}
              </span>
              <span v-if="travelDuration" class="overlay-submeta">· {{ travelDuration }}</span>
            </div>
          </Transition>
        </div>
        <!-- Stationen-Vorschau mit Polaroid-Stapel (#235) -->
        <div
          v-if="resolvedStations.length"
          class="tour-stations-preview"
          :class="{ 'is-fanned-out': expanded }"
        >
          <!-- Polaroid-Stapel: Mini-Polaroids im collapsed Zustand, morpht beim Aufklappen -->
          <div
            class="tour-polaroid-stack"
            :class="{ 'has-multiple': polaroidStations.length > 1 }"
            :title="`${resolvedStations.length} Stationen`"
            aria-hidden="true"
          >
            <div
              v-for="(st, idx) in polaroidStations"
              :key="st.key"
              class="polaroid-tile"
              :style="polaroidStyle(idx, polaroidStations.length)"
            >
              <div class="polaroid-photo-frame">
                <img
                  v-if="st.imageUrl"
                  :src="st.imageUrl"
                  class="polaroid-photo"
                  alt=""
                  loading="lazy"
                />
                <div
                  v-else
                  class="polaroid-placeholder"
                  :style="{ backgroundColor: st.color || 'var(--color-primary-tint)' }"
                >
                  <AppIcon :icon="st.tabler" :size="16" group="categories" />
                </div>
              </div>
              <div class="polaroid-chin">
                <span class="polaroid-caption">{{ st.title }}</span>
              </div>
              <span
                v-if="idx === polaroidStations.length - 1 && extraStationCount > 0"
                class="polaroid-badge"
              >
                +{{ extraStationCount }}
              </span>
            </div>
          </div>

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

        <!-- Tour-Notiz: Im collapsed Zustand 1-2-zeilig mit Ellipsis, klappt beim Aufklappen weich auf (#235) -->
        <div v-if="excursion.note" class="tour-note-container" :class="{ 'is-expanded': expanded }">
          <RichTextDisplay
            class="note"
            :class="{ 'is-clamped': !expanded }"
            :content="excursion.note"
            :format="excursion.note_format"
          />
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
  border-color: var(--color-tour-border);
  background: var(--color-surface);
  cursor: pointer;
  overflow: hidden;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance, 48px));
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.excursion-card:hover {
  border-color: var(--color-tour);
  box-shadow: var(--shadow-sm);
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

/* Akzentbalken an der abgerundeten linken Kante */
.tour-accent-bar {
  width: 32px;
  flex-shrink: 0;
  background: linear-gradient(180deg, var(--color-tour) 0%, var(--color-tour-dark) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: var(--space-2);
  gap: 8px;
  border-radius: var(--radius-md-squircle) 0 0 var(--radius-md-squircle);
  corner-shape: squircle;
  user-select: none;
  z-index: 1;
}

.tour-accent-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.tour-bar-label {
  writing-mode: vertical-lr;
  transform: rotate(180deg);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.95);
  opacity: 0.9;
  margin-top: 2px;
}

.tour-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Spot per Drag&Drop aus der Spots-Sicht darauf ablegen (SpotCard.vue ist die Drag-Quelle). */
.excursion-card.drop-target {
  border-color: var(--color-tour);
  background: var(--color-tour-tint);
}

/* Ersetzt den früheren ExcursionDetailDialog.vue-Modal-Dialog (#92): die Karte wächst an Ort und
   Stelle leicht (zusätzliche Zeilen für Ersteller:in/Notiz, siehe Template), statt einen Dialog
   über die Karte zu legen - exakt dasselbe Prinzip wie SpotCard.vue's .spot-card.expanded. Fester
   statt gestrichelter Rahmen (anders als .drop-target oben), damit die beiden Zustände optisch
   unterscheidbar bleiben. */
.excursion-card.expanded {
  border-style: solid;
  border-color: var(--color-tour);
  background: var(--color-tour-tint);
}

.image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 200px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 0;
  /* Beim Aufklappen: Bild morpht sofort zum Vollbild-Banner oben (Stufe 1) */
  transition:
    width 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    height 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s;
}

.excursion-card:not(.expanded) .image {
  width: 140px;
  height: 100%;
  /* Beim Zuklappen: Bild wartet kurz auf Akkordeon (Stufe 2) */
  transition:
    width 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s,
    height 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s;
}

.tour-type-badge {
  flex-shrink: 0;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--color-tour-tint);
  color: var(--color-tour);
  border: 1px solid var(--color-tour-border);
}

.placeholder {
  font-size: 2.5rem;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.excursion-card.expanded .placeholder {
  position: absolute;
  opacity: 0.15;
  transform: scale(1.8);
  pointer-events: none;
}

.overlay-fade-enter-active {
  transition: opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.overlay-fade-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* Expanded Cover Overlay: Halbdunkles Gradient-Overlay mit Titel, Kategorie/Rolle und Metadaten */
.image-expanded-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-3);
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.15) 35%,
    rgba(0, 0, 0, 0.85) 100%
  );
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
}

.image-expanded-overlay > * {
  pointer-events: auto;
}

.overlay-top-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.overlay-edit-btn {
  animation: editBtnSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}

@keyframes editBtnSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.overlay-author {
  font-weight: 600;
}

.overlay-submeta {
  opacity: 0.85;
}

.body {
  position: relative;
  z-index: 2;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  box-sizing: border-box;
  margin-left: 0;
  margin-top: 200px;
  /* Beim Aufklappen: gleitet sofort nach unten (Stufe 1) */
  transition:
    margin-left 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    margin-top 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    padding 0.32s ease 0s;
}

.excursion-card:not(.expanded) .body {
  margin-left: 140px;
  margin-top: 0;
  min-height: 120px;
  overflow: hidden;
  /* Beim Zuklappen: wartet synchron mit Bild auf Akkordeon (Stufe 2) */
  transition:
    margin-left 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s,
    margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s,
    padding 0.28s ease 0.12s;
}

/* Einheitlicher Card-Titel: gleitet beim Expandieren nahtlos vom Body in den Cover-Header */
.card-title-block {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--space-1);
  padding-right: 52px;
  transform: translate3d(0, 0, 0);
  transition:
    transform 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    margin-bottom 0.32s cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}

.excursion-card.has-role .card-title-block {
  padding-right: 74px;
}

.card-title-block > * {
  pointer-events: auto;
}

.excursion-card.expanded .card-title-block {
  transform: translateY(calc(-100% - var(--space-3) * 2));
  margin-bottom: -28px;
  padding-right: 90px;
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    color 0.28s ease,
    font-size 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    line-height 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    text-shadow 0.28s ease;
}

.excursion-card.expanded .card-title {
  color: #ffffff;
  font-size: 1.25rem;
  line-height: 1.25;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
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
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  flex-wrap: wrap;
}

/* Card Badge Group: gleitet sanft zwischen Body und Cover-Ecke */
.card-badge-group {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  pointer-events: none;
  top: var(--space-3);
  right: var(--space-3);
  transition:
    top 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    right 0.32s cubic-bezier(0.32, 0.72, 0, 1);
}

.card-badge-group > * {
  pointer-events: auto;
}

.excursion-card.expanded .card-badge-group .role-badge,
.excursion-card.expanded .card-badge-group .tour-type-badge {
  background: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.excursion-card.expanded .card-badge-group .role-badge :deep(.app-icon),
.excursion-card.expanded .card-badge-group .tour-type-badge :deep(.app-icon),
.excursion-card.expanded .card-badge-group .role-badge :deep(svg),
.excursion-card.expanded .card-badge-group .tour-type-badge :deep(svg) {
  color: #ffffff !important;
}

.card-badge-group .role-badge,
.card-badge-group .tour-type-badge {
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease;
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
  border-color: var(--color-tour);
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
  background: var(--color-tour-tint);
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
  max-height: 2000px;
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

.note.is-clamped :deep(.richtext) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
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

.tour-polaroid-stack {
  position: relative;
  width: 58px;
  height: 68px;
  flex-shrink: 0;
  cursor: pointer;
  perspective: 600px;
}

.polaroid-tile {
  position: absolute;
  top: 2px;
  left: 3px;
  width: 52px;
  height: 62px;
  background: #ffffff;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  padding: 3px 3px 10px 3px;
  box-sizing: border-box;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  transform-origin: center bottom;
  transition:
    transform 0.35s cubic-bezier(0.34, 1.3, 0.64, 1),
    box-shadow 0.25s ease,
    opacity 0.25s ease;
  user-select: none;
  pointer-events: none;
}

:root[data-theme='dark'] .polaroid-tile {
  background: #2a2825;
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.45),
    0 1px 3px rgba(0, 0, 0, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-tile {
    background: #2a2825;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.45),
      0 1px 3px rgba(0, 0, 0, 0.25);
  }
}

:root[data-theme='dark'] .polaroid-caption {
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-caption {
    color: #f2efe9;
  }
}

.polaroid-photo-frame {
  width: 100%;
  height: 40px;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  background: var(--color-surface-sunken);
}

.polaroid-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.polaroid-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.polaroid-placeholder :deep(svg) {
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.polaroid-chin {
  height: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0 1px;
  margin-top: 1px;
}

.polaroid-caption {
  font-size: 0.45rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1;
}

.polaroid-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-tour);
  color: #ffffff;
  font-size: 0.55rem;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1.5px solid #ffffff;
}

/* Hover-Effekt auf der Collapsed Card: Sanftes Auffächern der Polaroids */
.excursion-card:not(.expanded):hover .polaroid-tile:nth-child(1) {
  transform: rotate(-12deg) translate(-7px, 2px) scale(1.02);
}
.excursion-card:not(.expanded):hover .polaroid-tile:nth-child(2) {
  transform: rotate(8deg) translate(6px, -2px) scale(1.02);
}
.excursion-card:not(.expanded):hover .polaroid-tile:nth-child(3) {
  transform: rotate(-4deg) translate(2px, 0px) scale(1.03);
}
.excursion-card:not(.expanded):hover .polaroid-tile:nth-child(4) {
  transform: rotate(11deg) translate(9px, -1px) scale(1.03);
}

/* Morph-Animation beim Aufklappen */
.tour-stations-preview.is-fanned-out .polaroid-tile {
  transform: translateY(32px) rotate(0deg) scale(1.15) !important;
  opacity: 0;
  pointer-events: none;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.22s ease;
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
  .tour-accent-bar {
    width: 28px;
  }

  .excursion-card:not(.expanded) {
    min-height: 64px;
  }

  .excursion-card:not(.expanded) .image {
    width: 64px;
    height: 100%;
    border-radius: 0;
  }

  .excursion-card.expanded .image {
    width: 100%;
    height: 160px;
  }

  .excursion-card:not(.expanded) .body {
    margin-left: 64px;
    margin-top: 0;
    min-height: 64px;
    padding: 6px var(--space-2);
    justify-content: flex-start;
    gap: 2px;
    overflow: hidden;
    height: 100%;
  }

  .role-badge {
    font-size: 0.72rem;
    padding: 1px 7px;
  }

  .excursion-card:not(.expanded) .card-badge-group {
    top: 8px;
    right: var(--space-2);
    transition:
      top 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s,
      right 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s;
  }

  .excursion-card.expanded .card-badge-group {
    top: var(--space-3);
    right: var(--space-3);
    transition:
      top 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
      right 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s;
  }

  .excursion-card.expanded .body {
    margin-left: 0;
    margin-top: 160px;
    padding: var(--space-3);
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

  .tour-polaroid-stack {
    width: 46px;
    height: 56px;
  }

  .polaroid-tile {
    width: 42px;
    height: 52px;
    padding: 2px 2px 8px 2px;
  }

  .polaroid-photo-frame {
    height: 34px;
  }

  .polaroid-chin {
    height: 8px;
  }

  .polaroid-caption {
    font-size: 0.4rem;
  }

  .tour-note-container:not(.is-expanded) {
    max-height: 1.4em;
  }

  .note.is-clamped {
    -webkit-line-clamp: 1;
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .note.is-clamped :deep(.richtext) {
    -webkit-line-clamp: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image,
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
