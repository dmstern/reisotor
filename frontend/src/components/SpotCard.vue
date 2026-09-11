<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { ScheduleItem, Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { parseContact } from '../utils/contact';
import { fetchMergedWeather, type DailyWeather } from '../utils/weather';
import { usePointerDrag } from '../composables/usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import { useSpotsStore } from '../stores/spots';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import CategoryChip from './CategoryChip.vue';
import EditButton from './EditButton.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import TourAssignDropdown from './TourAssignDropdown.vue';
import FileAttachments from './FileAttachments.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import Card from './primitives/Card.vue';
import DetailRow from './primitives/DetailRow.vue';
import WeatherIcon from './WeatherIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';
import { computePopoverPosition } from '../utils/popoverPosition';

const props = defineProps<{
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
  /** Nur für Kategorie "Unterkunft" mit gesetztem paid_by_user_id relevant (siehe
   *  Migrationskommentar in db/index.ts). */
  payerLabel?: string | null;
  // Ob die Spots-Liste gerade nach Kategorie oder nach Touren gruppiert ist (ExcursionsView.vue) -
  // steuert (#106), ob zusätzlich zum "Tour zuordnen"-Dropdown auch der native Drag-Anfasser
  // gezeigt wird: der ergibt nur in der Touren-Gruppierung Sinn, wo echte Tour-Karten als
  // Ablageziele sichtbar sind (siehe onDragStart unten).
  groupMode: 'category' | 'tours';
  // Alle bestehenden Tour-Titel, fürs "Tour zuordnen"-Dropdown (TourAssignDropdown.vue).
  tourOptions: string[];
  hasMultipleMembers?: boolean;
}>();

const isAccommodation = computed(() => props.spot.category === 'Unterkunft');

function formatAccommodationDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}
const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'open', spot: Spot): void;
  (e: 'close'): void;
  // Sofort-Zuordnung über TourAssignDropdown.vue (#106, siehe Template) – ersetzt den früheren
  // Tap-Alternative-Mechanismus (Umschalten auf Touren-Gruppierung + manuelles Ablegen), da es
  // jetzt keine Tour-Drawer/-Karten mehr braucht, um eine Zuordnung vorzunehmen.
  (e: 'assign-tour', title: string): void;
  // "Auf Karte anzeigen"-Button (Mini- wie aufgeklappte Karte, siehe onShowOnMap unten) – eigene,
  // explizite Aktion statt (wie vor #109) automatisch beim Aufklappen mitzulaufen: schrumpft das
  // Sheet auf "angeschnitten" UND zentriert/vergrößert den Pin, unabhängig davon, ob die Karte hier
  // gerade auf- oder zugeklappt ist.
  (e: 'show-on-map'): void;
}>();

const showComments = ref(false);

function formatDate(d: string) {
  return formatDateShared(d, { includeYear: false });
}

// Wetter für den geplanten Tag direkt am Chip mit dem Datum (siehe Template) - eigener Fetch statt
// Prop von der Elternview, da utils/weather.ts's fetchWeatherForecast() modulweit pro Koordinate+
// Modell cached; mehrere Karten mit demselben Ort verursachen dadurch ohnehin nur einen echten
// Request. Best effort wie überall sonst bei Wetter (siehe DashboardView.vue) - ein Fehlschlag
// blendet nur das Wetter-Suffix aus, nicht die ganze Karte.
//
// #145: ohne geplantes Datum wird ersatzweise das AKTUELLE Wetter geholt (heutiges Datum) statt gar
// keines zu zeigen - im Template klar als "Aktuelles Wetter" gekennzeichnet, damit es nicht mit
// einer Vorhersage für einen bestimmten Tag verwechselt wird. Ein bereits als "gemacht" markierter
// Spot ohne Datum (Altbestand vor #106/#147, siehe plannedDateLabel-Kommentar unten) zeigt bewusst
// KEIN aktuelles Wetter - das wäre kein sinnvoller Bezug zu einem bereits vergangenen Besuch. Nur in
// der aufgeklappten Karte geholt (props.expanded) - anders als beim geplanten Datum (typischerweise
// wenige Spots) haben in der Mini-Card-Ansicht potenziell sehr viele Spots gar kein Datum; ein Fetch
// pro sichtbarer Mini-Card würde unnötig viele Open-Meteo-Requests auf einmal auslösen.
const excursionsStore = useExcursionsStore();
const scheduleStore = useScheduleStore();
const spotsStore = useSpotsStore();
const tripStore = useTripStore();
const drawers = useDrawersStore();

const scheduledDatesForSpot = computed(() => {
  const dates = new Set<string>();
  for (const item of scheduleStore.items) {
    if (item.spot_id === props.spot.id && item.date) {
      if (item.end_date && item.end_date > item.date) {
        let cur = new Date(`${item.date}T00:00:00`);
        const end = new Date(`${item.end_date}T00:00:00`);
        while (cur <= end) {
          dates.add(toLocalDateString(cur));
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        dates.add(item.date);
      }
    }
  }
  return dates;
});

const scheduledDaysCount = computed(() => scheduledDatesForSpot.value.size);

const weatherProvider = useWeatherProviderStore();
const weatherDate = computed(() => {
  if (scheduledDaysCount.value > 1) return null;
  if (props.scheduledDate) return props.scheduledDate;
  if (props.spot.done || !props.expanded) return null;
  return toLocalDateString(new Date());
});
const dayWeather = ref<DailyWeather | null>(null);
watch(
  () =>
    [
      weatherDate.value,
      props.spot.lat,
      props.spot.lng,
      weatherProvider.model,
      props.expanded,
    ] as const,
  async ([date, lat, lng, model]) => {
    dayWeather.value = null;
    if (!date || lat == null || lng == null) return;
    try {
      const days = await fetchMergedWeather(props.spot.trip_id, lat, lng, model);
      dayWeather.value = days.find((d) => d.date === date) ?? null;
    } catch {
      // best effort, siehe Kommentar oben
    }
  },
  { immediate: true }
);

// Nur noch das Datum als String - das Wetter (falls vorhanden) rendert das Template direkt über ein
// eigenes AppIcon + Temperatur, statt es wie zuvor in einen einzigen, nicht auftrennbaren String
// einzubacken (der hätte sich nicht zwischen Emoji/Tabler-Icon umschalten lassen).
const plannedDateLabel = computed(() =>
  props.scheduledDate ? formatDate(props.scheduledDate) : ''
);

// Tour-Zuordnungen als Checkliste (#226, #227):
const tourAssignments = computed(() =>
  excursionsStore.excursions.map((e) => ({
    id: e.id,
    title: e.title,
    assigned: e.spot_ids.includes(props.spot.id),
  }))
);

async function onToggleTour(excursionId: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  if (!excursion) return;
  const isAssigned = excursion.spot_ids.includes(props.spot.id);
  const nextSpotIds = isAssigned
    ? excursion.spot_ids.filter((id) => id !== props.spot.id)
    : [...excursion.spot_ids, props.spot.id];
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    spot_ids: nextSpotIds,
  });
}

async function onCreateTour(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  await excursionsStore.create({
    title: trimmed,
    spot_ids: [props.spot.id],
  });
}

// Natives Drag (Zuordnen zu einer Tour) startet über den Tour-Zuordnen-Anfasser
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/spot-id', String(props.spot.id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

// Spontanes Einplanen direkt auf einen Kalendertag, ohne vorher einen Ausflug anzulegen: legt
// einen mit diesem Spot verknüpften Termin an (siehe stores/schedule.ts) statt (wie früher) im
// Hintergrund einen unsichtbaren Ein-Spot-Ausflug – 1:1 nach dem Muster von ExcursionCard.vue's
// 📅-Einplanen-Anfasser (eigener Pointer-Events-Drag statt nativem HTML5-DnD, da Letzteres auf
// Touch-Geräten unzuverlässig ist). Eigenständig neben dem bestehenden nativen
const { dragging, ghostStyle, onPointerDown } = usePointerDrag({
  onStart: () => {
    drawers.calendarOpen = true;
  },
  onDrop: (targetEl) => {
    const dayEl = targetEl?.closest<HTMLElement>('[data-date]');
    if (!dayEl?.dataset.date || tripStore.currentTripId == null) return;
    scheduleStore.create({
      trip_id: tripStore.currentTripId,
      date: dayEl.dataset.date,
      title: props.spot.title,
      spot_id: props.spot.id,
      auto_created: 1,
      user_modified: 0,
    });
  },
  // Klick-Alternative zum Drag: öffnet die Kalender-Schublade und merkt sich den Spot, der beim
  // nächsten Tages-Klick eingeplant werden soll (siehe drawers.startPendingSchedule/
  // ScheduleView.vue's selectDay()).
  onTap: () => {
    drawers.startPendingSchedule('spot', props.spot.id);
  },
});

// Klick auf die Karte klappt sie nur auf-/zu, statt (wie zuvor) einen Modal-Dialog zu öffnen – die
// direkt danebenliegende Karte (TripMap.vue) bleibt dadurch immer interaktiv, auch während man
// sich die Details eines Spots ansieht. Fokussiert die Karte NICHT mehr automatisch (#109 - das
// vermischte zwei unabhängige Absichten: "Detail ansehen" vs. "auf der Karte zeigen", Letzteres
// schrumpfte dabei ungewollt ein bereits voll ausgefahrenes Sheet). Zuklappen hebt eine per
// "Auf Karte anzeigen" gesetzte Hervorhebung auf diesen Spot trotzdem mit auf.
function onCardClick() {
  if (props.expanded) {
    emit('close');
    if (drawers.mapFocusKey === `spot-${props.spot.id}`) drawers.mapFocusKey = null;
  } else {
    emit('open', props.spot);
  }
}

function onShowOnMap() {
  emit('show-on-map');
}

const scheduledItemsForSpot = computed(() => {
  return scheduleStore.items
    .filter((i) => i.spot_id === props.spot.id && i.date)
    .sort((a, b) => a.date.localeCompare(b.date));
});

const totalItemsCount = computed(() => scheduledItemsForSpot.value.length);
const doneItemsCount = computed(() => scheduledItemsForSpot.value.filter((i) => !!i.done).length);
const allItemsDone = computed(
  () => totalItemsCount.value > 0 && doneItemsCount.value === totalItemsCount.value
);
const isSpotDone = computed(() => {
  if (totalItemsCount.value > 0) return allItemsDone.value;
  return !!props.spot.done;
});
const isSpotPartiallyDone = computed(() => {
  return totalItemsCount.value > 1 && doneItemsCount.value > 0 && !allItemsDone.value;
});

const datesPopoverOpen = ref(false);
const datesPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

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

// #106/#147: Status-Kette in Planung -> geplant -> gemacht.
// Bei mehreren Terminen (>1): Klick öffnet ein Popover mit Checkliste, um Tage einzeln abzuhaken.
// Bei 1 Termin: Klick hakt direkt diesen Termin ab.
// Bei ungeplant (0 Termine): Klick öffnet Popover zur schnellen Datumswahl (oder Kalender-Absprung).
async function onToggleDone(event?: MouseEvent) {
  if (totalItemsCount.value > 1) {
    const triggerEl = (event?.currentTarget as HTMLElement | undefined) ?? null;
    if (triggerEl) {
      datesPopoverStyle.value = computePopoverPosition(triggerEl, {
        menuWidth: 270,
        menuHeight: 220,
      });
    }
    datesPopoverOpen.value = true;
    await nextTick();
    const menuEl = document.querySelector('.spot-dates-popover') as HTMLElement | null;
    if (menuEl && triggerEl) {
      const rect = menuEl.getBoundingClientRect();
      datesPopoverStyle.value = computePopoverPosition(triggerEl, {
        menuWidth: rect.width,
        menuHeight: rect.height,
      });
    }
  } else if (totalItemsCount.value === 1) {
    const item = scheduledItemsForSpot.value[0];
    await scheduleStore.setDone(item.id, !item.done);
  } else if (props.scheduledDate) {
    await spotsStore.setDone(props.spot.id, !props.spot.done);
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
    const menuEl = document.querySelector('.spot-unplanned-popover') as HTMLElement | null;
    if (menuEl && triggerEl) {
      const rect = menuEl.getBoundingClientRect();
      unplannedPopoverStyle.value = computePopoverPosition(triggerEl, {
        menuWidth: rect.width,
        menuHeight: rect.height,
      });
    }
  }
}

async function toggleScheduledItemDone(item: ScheduleItem) {
  await scheduleStore.setDone(item.id, !item.done);
}

async function submitUnplannedDone() {
  if (!unplannedDoneDate.value) return;
  if (tripStore.currentTripId != null) {
    await scheduleStore.setSpotDate(
      props.spot.id,
      tripStore.currentTripId,
      props.spot.title,
      unplannedDoneDate.value,
      true
    );
  }
  unplannedPopoverOpen.value = false;
}

function openCalendarConfirmDone() {
  unplannedPopoverOpen.value = false;
  drawers.startPendingSchedule('spot', props.spot.id, 'confirm-done');
}
</script>

<template>
  <Card
    variant="polaroid"
    class="spot-card"
    :class="{ expanded, 'new-highlight': highlighted }"
    @click="onCardClick"
  >
    <div class="image" :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}">
      <AppIcon
        v-if="!spot.image_url"
        class="placeholder"
        :size="35"
        :icon="spotCategoryMeta(spot.category).tabler"
        group="categories"
      />

      <!-- Expanded Cover Overlay: Halbdunkles Gradient-Overlay mit Edit-Button -->
      <Transition name="overlay-fade">
        <div v-if="expanded" class="image-expanded-overlay">
          <div class="overlay-top-row">
            <EditButton floating class="overlay-edit-btn" @click="emit('edit', spot)" />
          </div>
        </div>
      </Transition>
    </div>

    <!-- Gleitende Badge-Gruppe: Ein einziges Element, das nahtlos zwischen Body und Cover-Ecke gleitet -->
    <div class="card-badge-group">
      <CategoryChip :category="spot.category" />
      <PendingSyncBadge v-if="spot._pending" />
    </div>

    <div class="body">
      <!-- Einheitlicher Card-Titel: gleitet beim Expandieren nahtlos vom Body in den Cover-Header -->
      <div class="card-title-block">
        <h3 class="card-title" :title="spot.title">{{ spot.title }}</h3>
        <Transition name="fade">
          <div
            v-if="
              expanded &&
              (creatorLabel ||
                (isAccommodation && (spot.start_date || spot.end_date)) ||
                spot.address)
            "
            class="card-title-meta"
          >
            <span v-if="creatorLabel" class="overlay-author">Von {{ creatorLabel }}</span>
            <span
              v-if="isAccommodation && (spot.start_date || spot.end_date)"
              class="overlay-submeta"
            >
              {{ formatAccommodationDate(spot.start_date) || '?' }} –
              {{ formatAccommodationDate(spot.end_date) || '?' }}
            </span>
            <span v-else-if="spot.address" class="overlay-submeta">
              {{ spot.address }}
            </span>
          </div>
        </Transition>
      </div>
      <!-- Spot-Notiz: Trunkiert mit Ellipsis sowohl im collapsed als auch im expanded Zustand (#235) -->
      <div v-if="spot.note" class="spot-note-container" :class="{ 'is-expanded': expanded }">
        <RichTextDisplay
          class="note is-clamped"
          :class="{ 'is-expanded': expanded }"
          :content="spot.note"
          :format="spot.note_format"
        />
      </div>

      <!-- Eigene, explizite Aktion statt am Aufklappen dranzuhängen (#109, siehe onShowOnMap im
           Script) – in Mini- UND aufgeklappter Karte sichtbar (Textlabel schrumpft im Kompakt-Modus
           auf reines Icon, siehe @container-Regel unten), gleiche Konvention wie
           ExcursionCard.vue's "Auf Karte anzeigen"-Button. -->
      <div class="links" v-if="spot.lat != null && spot.lng != null">
        <Button
          variant="card-action"
          class="show-on-map-btn"
          aria-label="Auf Karte anzeigen"
          title="Auf Karte anzeigen"
          @click.stop="onShowOnMap"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
          <span class="btn-label">Auf Karte anzeigen</span>
        </Button>
      </div>

      <div class="spot-accordion" :class="{ 'is-expanded': expanded }" :inert="!expanded">
        <div class="spot-accordion-inner accordion-stagger">
          <DetailRow v-if="creatorLabel && !expanded" label="Von">
            {{ creatorLabel }}
          </DetailRow>
          <template v-if="isAccommodation">
            <DetailRow v-if="spot.start_date || spot.end_date" label="Zeitraum">
              <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
              {{ formatAccommodationDate(spot.start_date) || '?' }} –
              {{ formatAccommodationDate(spot.end_date) || '?' }}
            </DetailRow>
            <DetailRow v-if="spot.address" label="Adresse">
              {{ spot.address }}
            </DetailRow>
            <DetailRow v-if="spot.checkin || spot.checkout" label="Check-in/-out">
              {{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}
            </DetailRow>
            <DetailRow
              v-if="spot.contact && parseContact(spot.contact).kind === 'phone'"
              label="Kontakt"
            >
              <AppIcon :icon="FORM_FIELD_ICONS.contact" :size="14" group="formFields" />
              <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
            </DetailRow>
            <DetailRow
              v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'"
              label="Kontakt"
            >
              <AppIcon :icon="FORM_FIELD_ICONS.email" :size="14" group="formFields" />
              <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
            </DetailRow>
            <DetailRow v-else-if="spot.contact" label="Kontakt">
              <RichTextDisplay class="contact-text" :content="spot.contact" />
            </DetailRow>
            <DetailRow v-if="spot.amount != null" label="Kosten">
              <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="14" group="formFields" />
              {{ spot.amount.toFixed(2) }} €
              <span v-if="hasMultipleMembers !== false && spot.paid_by_user_id">
                · bezahlt von {{ payerLabel }}</span
              >
            </DetailRow>
          </template>
        </div>
      </div>

      <div class="card-actions-wrapper" :class="{ 'is-expanded': expanded }">
        <div class="mobile-only-accordion" :class="{ 'is-expanded': expanded }" :inert="!expanded">
          <div class="mobile-only-accordion-inner accordion-stagger">
            <div class="card-actions">
              <TourAssignDropdown
                :tours="tourAssignments"
                @toggle-tour="onToggleTour"
                @create-tour="onCreateTour"
                @dragstart="onDragStart"
              />
              <button
                v-if="!isAccommodation && !scheduledDate"
                type="button"
                class="calendar-drag-handle"
                aria-label="Auf Kalender ziehen zum spontanen Einplanen"
                title="Auf Kalender ziehen zum spontanen Einplanen"
                @pointerdown="onPointerDown"
                @click.stop
              >
                <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Einplanen
              </button>
              <!-- Verschmolzener Status-Button (Geplant-Status + Gemacht-Checkbox) – in beiden Zuständen -->
              <button
                v-if="!isAccommodation"
                type="button"
                class="done-toggle"
                :class="{
                  status: !!(
                    scheduledDate ||
                    totalItemsCount > 0 ||
                    isSpotDone ||
                    isSpotPartiallyDone
                  ),
                  planned: !!(
                    (scheduledDate || totalItemsCount > 0) &&
                    !isSpotDone &&
                    !isSpotPartiallyDone
                  ),
                  'status-done': isSpotDone || isSpotPartiallyDone,
                  active: isSpotDone,
                }"
                :aria-pressed="isSpotDone"
                :aria-label="
                  isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'
                "
                :title="isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
                @click.stop="onToggleDone"
              >
                <template v-if="totalItemsCount > 1">
                  <template v-if="allItemsDone">
                    <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
                    <span class="status-text">
                      <template v-if="expanded">Besucht an {{ totalItemsCount }} Tagen</template>
                      <template v-else>{{ totalItemsCount }}x besucht</template>
                    </span>
                  </template>
                  <template v-else-if="doneItemsCount > 0">
                    <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
                    <span class="status-text">
                      <template v-if="expanded">
                        Besucht an {{ doneItemsCount }} von {{ totalItemsCount }} Tagen
                      </template>
                      <template v-else>
                        {{ doneItemsCount }}/{{ totalItemsCount }} x besucht
                      </template>
                    </span>
                  </template>
                  <template v-else>
                    <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" />
                    <span class="status-text">
                      <template v-if="expanded">Geplant an {{ totalItemsCount }} Tagen</template>
                      <template v-else>{{ totalItemsCount }}x geplant</template>
                    </span>
                  </template>
                </template>
                <template v-else-if="isSpotDone">
                  <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
                  <span class="status-text">
                    <template v-if="scheduledDate">Besucht am {{ plannedDateLabel }}</template>
                    <template v-else>Gemacht</template>
                    <template v-if="dayWeather && scheduledDaysCount <= 1">
                      · <WeatherIcon :code="dayWeather.weatherCode" :size="14" />
                      {{ Math.round(dayWeather.tempMax) }}°
                    </template>
                  </span>
                </template>
                <template v-else-if="scheduledDate || totalItemsCount === 1">
                  <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" />
                  <span class="status-text">
                    Geplant für {{ plannedDateLabel }}
                    <template v-if="dayWeather && scheduledDaysCount <= 1">
                      · <WeatherIcon :code="dayWeather.weatherCode" :size="14" />
                      {{ Math.round(dayWeather.tempMax) }}°
                    </template>
                  </span>
                </template>
                <template v-else>
                  <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" />
                  <span>Als gemacht markieren</span>
                </template>
              </button>
            </div>
            <MapsAppPicker
              v-if="spot.lat != null && spot.lng != null"
              :lat="spot.lat"
              :lng="spot.lng"
              :title="spot.title"
              :maps-link="spot.maps_link"
              @click.stop
            />
          </div>
        </div>
      </div>

      <!-- Untere Zeile (Footer): Anhänge links, Social Actions rechts (nutzt beide Ecken optimal aus) -->
      <div class="card-footer-row" :class="{ 'is-expanded': expanded }">
        <div class="card-attachments-wrap" :class="{ 'is-expanded': expanded }" :inert="!expanded">
          <FileAttachments domain="spots" :entity-id="spot.id" :editable="false" />
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

      <div
        class="spot-accordion"
        :class="{ 'is-expanded': expanded && showComments }"
        :inert="!expanded || !showComments"
      >
        <div class="spot-accordion-inner accordion-stagger">
          <Comments
            v-if="showComments"
            :comments="comments"
            @click.stop
            @submit="(content) => emit('submit-comment', content)"
            @remove="(id) => emit('remove-comment', id)"
          />
        </div>
      </div>

      <Teleport to="body">
        <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> {{ spot.title }}
        </div>
        <!-- Popover zur Datumsauswahl für ungeplante Spots -->
        <PickerMenu
          v-if="unplannedPopoverOpen"
          class="spot-unplanned-popover"
          :style="unplannedPopoverStyle"
          @close="unplannedPopoverOpen = false"
        >
          <div class="unplanned-popover-content">
            <div class="popover-title-row">
              <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
              <span class="popover-heading">Spot als besucht markieren</span>
            </div>
            <p class="popover-subtext">An welchem Tag wurde dieser Spot besucht?</p>
            <Input
              v-model="unplannedDoneDate"
              type="date"
              class="popover-date-input"
              aria-label="Datum des Besuchs"
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
                Als besucht markieren
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

        <!-- Popover zum Abhaken einzelner Termine bei Multi-Datum-Spots -->
        <PickerMenu
          v-if="datesPopoverOpen"
          class="spot-dates-popover"
          :style="datesPopoverStyle"
          @close="datesPopoverOpen = false"
        >
          <div class="dates-popover-content">
            <div class="popover-title-row">
              <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
              <span class="popover-heading">Besuche abhaken</span>
            </div>
            <p class="popover-subtext">Wähle die Tage aus, an denen dieser Spot besucht wurde:</p>
            <div class="dates-checklist">
              <button
                v-for="item in scheduledItemsForSpot"
                :key="item.id"
                type="button"
                class="date-check-item"
                :class="{ checked: !!item.done }"
                @click="toggleScheduledItemDone(item)"
              >
                <AppIcon
                  :icon="item.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                  :size="15"
                  group="actions"
                />
                <span class="date-check-date">{{ formatDateShared(item.date) }}</span>
                <span class="date-check-status">{{ item.done ? 'Besucht' : 'Geplant' }}</span>
              </button>
            </div>
            <div class="popover-buttons">
              <Button type="button" variant="secondary" size="sm" @click="datesPopoverOpen = false">
                Fertig
              </Button>
            </div>
          </div>
        </PickerMenu>
      </Teleport>
    </div>
  </Card>
</template>

<style scoped>
.spot-card {
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

.spot-card:not(.expanded) {
  height: 268px;
  min-height: 268px;
}

.spot-card.expanded {
  border-color: var(--color-primary);
}

.image {
  height: 120px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: height 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  border-radius: calc(var(--radius-md-squircle) - 4px);
  corner-shape: squircle;
  overflow: hidden;
  flex-shrink: 0;
}

.spot-card.expanded .image {
  height: 200px;
}

.spot-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.spot-accordion.is-expanded {
  grid-template-rows: 1fr;
}

.spot-accordion-inner {
  overflow: hidden;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.2s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

.placeholder {
  font-size: 2.2rem;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.spot-card.expanded .placeholder {
  position: absolute;
  opacity: 0.15;
  transform: scale(1.8);
  pointer-events: none;
}

/* Expanded Cover Overlay: Halbdunkles Gradient-Overlay mit Titel, Autor & Metadaten */
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

.overlay-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  flex-wrap: wrap;
}

.overlay-author {
  font-weight: 600;
}

.overlay-submeta {
  opacity: 0.85;
}

/* Status-/Datums-Chip (#106: EIN gemeinsames Badge statt zweier unabhängiger Chips, ersetzt das
   frühere separate "Gemacht"-Badge) – dasselbe Muster wie ExcursionCard.vue's .status/.status.planned
   (inkl. Dark-Mode-Override unten), damit beide Karten-Typen optisch konsistent bleiben. Unten statt
   oben positioniert. Nur sichtbar, wenn geplant oder gemacht (siehe v-if im Template) statt immer einen
   "Nicht geplant"-Chip zu zeigen – ein Spot muss (anders als ein Ausflug) nicht zwangsläufig einmal
   eingeplant werden. */
.status {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  transition:
    width 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    padding 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    gap 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.3s ease;
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

/* Card Badge Group: gleitet sanft zwischen Body und Cover-Ecke */
.card-badge-group {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  pointer-events: none;
}

.card-badge-group > * {
  pointer-events: auto;
}

/* Auf Desktop (> 480px): Collapsed im Body unter dem 120px-Bild, Expanded im Cover-Overlay */
.spot-card:not(.expanded) .card-badge-group {
  top: calc(8px + 120px + var(--space-2));
  right: calc(8px + var(--space-2));
  transition:
    top 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s,
    right 0.28s cubic-bezier(0.32, 0.72, 0, 1) 0.12s;
}

.spot-card.expanded .card-badge-group {
  top: calc(8px + var(--space-2));
  right: calc(8px + var(--space-2));
  transition:
    top 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    right 0.32s cubic-bezier(0.32, 0.72, 0, 1) 0s;
}

.spot-card.expanded .card-badge-group :deep(.category-chip) {
  background: rgba(0, 0, 0, 0.55) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  color: #ffffff !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.spot-card.expanded .card-badge-group :deep(.category-chip .app-icon),
.spot-card.expanded .card-badge-group :deep(.category-chip svg) {
  color: #ffffff !important;
}

.card-badge-group :deep(.category-chip) {
  transition:
    background 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    box-shadow 0.3s ease;
}

.body {
  position: relative;
  z-index: 2;
  padding: var(--space-2) var(--space-1) 0 var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  width: 100%;
}

.spot-card:not(.expanded) .body {
  overflow: hidden;
  justify-content: flex-start;
}

/* Einheitlicher Card-Titel: gleitet beim Expandieren nahtlos vom Body in den Cover-Header */
.card-title-block {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: var(--space-2);
  padding-right: 90px;
  transform: translate3d(0, 0, 0);
  transition:
    transform 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    margin-bottom 0.32s cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}

.card-title-block > * {
  pointer-events: auto;
}

.spot-card:not(.expanded) .card-title-block {
  margin-bottom: 2px;
}

.spot-card.expanded .card-title-block {
  transform: translateY(calc(-100% - var(--space-3) * 2));
  margin-bottom: -44px;
  padding-left: calc(var(--space-3) - var(--space-1));
}

.spot-card.expanded .card-title-block:has(.card-title-meta) {
  margin-bottom: -56px;
}

.card-title {
  margin: 0;
  font-size: 1.05rem;
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

.spot-card.expanded .card-title {
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

/* Spot-Notiz: Fließender Übergang zwischen 1-zeiligem Teaser und kompakter 2-3-zeiliger Höhe (#235) */
.spot-note-container {
  display: block;
  position: relative;
  margin-top: 2px;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 1.4em;
  transition:
    max-height 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin 0.25s ease;
}

.spot-card:not(.expanded) .spot-note-container {
  margin-top: 0;
}

.spot-note-container:not(.is-expanded) {
  max-height: 1.5em;
}

.spot-note-container.is-expanded {
  max-height: 4.5em;
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
  -webkit-line-clamp: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--color-text-muted);
}

.note.is-clamped.is-expanded {
  -webkit-line-clamp: 3;
  color: var(--color-text);
}

.note.is-clamped :deep(.richtext) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note.is-clamped.is-expanded :deep(.richtext) {
  -webkit-line-clamp: 3;
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

.contact-text :deep(br:last-child) {
  display: none;
}

.card-actions-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
  z-index: 2;
  width: 100%;
}

.spot-card:not(.expanded) .card-actions-wrapper {
  position: static;
  margin-top: auto;
}

.spot-card.expanded .card-actions-wrapper {
  margin-top: 0;
}

.card-footer-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  position: relative;
  z-index: 2;
  width: 100%;
  box-sizing: border-box;
}

.spot-card:not(.expanded) .card-footer-row {
  display: contents;
}

.card-attachments-wrap {
  min-width: 0;
  flex: 1;
}

.spot-card:not(.expanded) .card-attachments-wrap {
  display: none;
}

.card-attachments-wrap :deep(.file-attachments) {
  margin-top: var(--space-1);
}

.card-attachments-wrap :deep(.heading) {
  margin-bottom: 2px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.card-attachments-wrap :deep(.attachments-polaroid-wrap) {
  padding: 2px 0 2px 2px;
}

.card-social-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: auto;
  flex-shrink: 0;
}

/* Im zugeklappten Zustand sitzt der Like-Button absolut unten rechts im Card-Body,
   damit mehrzeilige Aktionen ihn nicht nach unten aus dem sichtbaren Bereich schieben (#383) */
.spot-card:not(.expanded) .card-social-actions {
  position: absolute;
  bottom: 8px;
  right: var(--space-1);
  margin-left: 0;
  z-index: 3;
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

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.spot-card.expanded .card-actions {
  margin-top: 0;
  width: 100%;
}

.spot-card:not(.expanded) .card-actions {
  gap: 6px;
  margin-top: 2px;
  padding-right: 48px;
}

/* #161: ohne eigenes margin-top rückte MapsAppPicker.vue's "In Karten-App öffnen"-Button direkt an
   .card-actions (den "Tour zuordnen"-Chip) heran - zu wenig Abstand zwischen den beiden Zeilen. */
.maps-picker {
  margin-top: var(--space-3);
}

/* Zwei Anfasser statt des gesamten Card-Roots als Drag-Quelle: .excursion-drag-handle (natives
   HTML5-DnD, siehe onDragStart im Script) und .calendar-drag-handle (Pointer-Events, siehe
   usePointerDrag-Wiring). touch-action:none beim Kalender-Anfasser verhindert, dass der Browser
   das Ziehen als Seiten-Scroll interpretiert (beim nativen DnD-Anfasser übernimmt das der Browser
   selbst). Das ::before-Punkte-Raster macht beide auf einen Blick als Zieh-Griff statt als
   normalen Button erkennbar. */
.calendar-drag-handle,
.excursion-drag-handle {
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
  -webkit-user-select: none;
  user-select: none;
}

/* Verschmolzener Status-Toggle (Geplant-Status + Gemacht-Checkbox) */
.done-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
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
  border-color: var(--color-primary);
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
  background: var(--color-primary-tint);
  border-color: var(--color-success);
}

.card-actions .done-toggle.status {
  position: static;
  bottom: auto;
  right: auto;
}

.calendar-drag-handle {
  touch-action: none;
}

.calendar-drag-handle::before,
.excursion-drag-handle::before {
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

.calendar-drag-handle:active,
.excursion-drag-handle:active {
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

/* Kompakte Listen-Zeile statt Miniatur-Card auf schmalen .spots-col-Breiten – zeigt nur die
   wichtigsten Infos (Bild, Titel, Kategorie) plus den auf ein Icon geschrumpften "Auf Karte
   anzeigen"-Button (#109, bleibt bewusst auch hier erreichbar), sekundäre Aktionen (Notiz,
   Anfasser) erst nach dem Aufklappen (:not(.expanded)). Grob nach demselben Zeilen-Muster
   wie ExcursionCard.vue (festes Vorschaubild links, Rest daneben). Container-Query statt @media:
   reagiert auf die tatsächliche Breite von .spots-col (container-type dort in ExcursionsView.vue),
   nicht auf die Fenster-/Viewport-Breite – greift dadurch auch, wenn man auf Desktop den Anfasser
   zwischen Spots-Liste und Karte weit zur Karte hin zieht, nicht nur auf echtem Mobil.

   NEU: Statt Side-by-Side (64px-Thumbnail links) + Morph zum vollen Banner wird auf beiden
   Zuständen (collapsed/expanded) konsistent das Polaroid-Layout (Bild oben, Text darunter)
   beibehalten — nur kompakter (schmalerer Rahmen, kürzeres Bild, kleinere Schrift). */
@container spots-col (max-width: 480px) {
  .spot-card {
    padding: 6px 6px 10px 6px;
  }

  .spot-card:not(.expanded) {
    height: auto;
  }

  /* Bild bleibt im normalen Fluss (kein position: absolute), nur kompakter */
  .image {
    height: 100px;
    transition: height 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .spot-card.expanded .image {
    height: 160px;
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
    padding-right: 90px;
  }

  .spot-card:not(.expanded) .card-title {
    font-size: 0.92rem;
  }

  /* Badge-Gruppe: Auf collapsed im Body-Bereich neben dem Titel, auf expanded im Cover */
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

  /* «Auf Karte anzeigen»-Button: Morph zwischen Icon-Circle und voller Pille */
  .spot-card:not(.expanded) .links {
    margin: 0;
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

  .spot-card:not(.expanded) .show-on-map-btn {
    width: 22px;
    height: 22px;
    min-width: 22px;
    padding: 0;
    gap: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .spot-card:not(.expanded) .show-on-map-btn .btn-label {
    max-width: 0;
    opacity: 0;
    margin: 0;
  }

  .spot-card:not(.expanded) .card-social-actions {
    bottom: 6px;
    right: var(--space-2);
  }

  .spot-note-container:not(.is-expanded) {
    max-height: 1.4em;
  }

  .spot-note-container.is-expanded {
    max-height: 2.8em;
  }

  .note.is-clamped {
    -webkit-line-clamp: 1;
    font-size: 0.78rem;
    line-height: 1.3;
  }

  .note.is-clamped.is-expanded {
    -webkit-line-clamp: 2;
  }

  .note.is-clamped :deep(.richtext) {
    -webkit-line-clamp: 1;
  }

  .note.is-clamped.is-expanded :deep(.richtext) {
    -webkit-line-clamp: 2;
  }

  .mobile-only-accordion {
    display: grid;
    grid-template-rows: 0fr;
    /* Beim Zuklappen: faltet sich sofort zusammen (Stufe 1) */
    transition: grid-template-rows 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0s;
  }

  .mobile-only-accordion.is-expanded {
    grid-template-rows: 1fr;
    /* Beim Aufklappen: entfaltet sich nach Bild-Morph (Stufe 2) */
    transition: grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s;
  }

  .mobile-only-accordion-inner {
    overflow: hidden;
  }

  .mobile-only-accordion-inner > * {
    transition:
      opacity 0.2s ease 0s,
      transform 0.2s ease 0s;
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }

  .mobile-only-accordion.is-expanded .mobile-only-accordion-inner > * {
    transition:
      opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    opacity: 1;
    transform: translateY(0) scale(1);
    transition-delay: calc(var(--stagger-idx, 0) * 35ms + 140ms);
  }
}

.mobile-only-accordion,
.mobile-only-accordion-inner {
  display: contents; /* Auf Desktop komplett durchlässig */
}

.spot-accordion {
  display: grid;
  grid-template-rows: 0fr;
  /* Beim Zuklappen sofort zusammenfalten (Stufe 1) */
  transition: grid-template-rows 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0s;
}

.spot-accordion.is-expanded {
  grid-template-rows: 1fr;
  /* Beim Aufklappen nach dem Bild-Morph entfalten (Stufe 2) */
  transition: grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s;
}

.spot-accordion-inner {
  overflow: hidden;
}

/* Einfaden und gestaffeltes Auffächern für die Inhalte */
.spot-accordion-inner > *,
.excursion-accordion-inner > * {
  transition:
    opacity 0.2s ease 0s,
    transform 0.2s ease 0s;
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}

.spot-accordion.is-expanded .spot-accordion-inner > *,
.excursion-accordion.is-expanded .excursion-accordion-inner > * {
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx, 0) * 35ms + 140ms);
}

@media (prefers-reduced-motion: reduce) {
  .image,
  .body,
  .spot-accordion,
  .mobile-only-accordion,
  .status,
  .status-text,
  .show-on-map-btn,
  .show-on-map-btn .btn-label,
  .spot-accordion-inner > *,
  .mobile-only-accordion-inner > *,
  .spot-note-container {
    transition: none !important;
  }
}

/* Fallback-Slide-Fade für absolute Buttons */
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

.unplanned-popover-content,
.dates-popover-content {
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

.dates-checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
  max-height: 220px;
  overflow-y: auto;
}

.date-check-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2-5);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
  font-size: 0.84rem;
  color: var(--color-text);
  width: 100%;
}

.date-check-item:hover {
  background: var(--color-surface-hover, var(--color-surface-raised));
  border-color: var(--color-border-hover, var(--color-primary));
}

.date-check-item.checked {
  background: rgba(46, 125, 50, 0.08);
  border-color: rgba(46, 125, 50, 0.4);
  color: #2e7d32;
}

:root[data-theme='dark'] .date-check-item.checked {
  background: rgba(76, 175, 80, 0.15);
  border-color: rgba(76, 175, 80, 0.4);
  color: #81c784;
}

.date-check-date {
  flex: 1;
  font-weight: 500;
}

.date-check-status {
  font-size: 0.75rem;
  opacity: 0.8;
}
</style>
