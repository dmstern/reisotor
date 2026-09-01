<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
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
import DeleteButton from './DeleteButton.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import SocialRow from './SocialRow.vue';
import Comments, { type CommentItem } from './Comments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import TourAssignDropdown from './TourAssignDropdown.vue';
import FileAttachments from './FileAttachments.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Card from './primitives/Card.vue';
import WeatherIcon from './WeatherIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared, toLocalDateString } from '../utils/dateFormat';

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
  (e: 'remove', id: number): void;
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
const weatherProvider = useWeatherProviderStore();
const weatherDate = computed(() => {
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
// draggable/dragstart oben (Zuordnen zu einem Ausflug) – kein Ersatz dafür.
const excursionsStore = useExcursionsStore();
const scheduleStore = useScheduleStore();
const spotsStore = useSpotsStore();
const tripStore = useTripStore();
const drawers = useDrawersStore();
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

// #106/#147: Status-Kette in Planung -> geplant -> gemacht statt (wie zuvor) eines von geplant/
// ungeplant unabhängigen Flags - ein Spot darf nicht ohne Datum "gemacht" sein. Zurück auf
// "geplant" braucht dafür kein neues Datum (setDone(false) direkt). Beim Übergang zu "gemacht"
// entscheidet, ob bereits ein geplantes Datum existiert (#147: ursprünglich öffnete sich der
// Kalender IMMER, auch wenn schon ein Datum da war - das war unnötig, da das bereits geplante
// Datum ohnehin als Gemacht-/Besucht-Datum übernommen wird): mit Datum direkt markieren, nur ohne
// Datum (noch "in Planung") den Kalender zur Bestätigung des Besuchstags öffnen
// (drawers.pendingSchedule mode 'confirm-done', ausgewertet in ScheduleView.vue's
// finishPendingSchedule()).
function onToggleDone() {
  if (props.spot.done) {
    spotsStore.setDone(props.spot.id, false);
  } else if (props.scheduledDate) {
    spotsStore.setDone(props.spot.id, true);
  } else {
    drawers.startPendingSchedule('spot', props.spot.id, 'confirm-done');
  }
}
</script>

<template>
  <Card class="spot-card" :class="{ expanded, 'new-highlight': highlighted }" @click="onCardClick">
    <div class="image" :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}">
      <AppIcon
        v-if="!spot.image_url"
        class="placeholder"
        :size="35"
        :icon="spotCategoryMeta(spot.category).tabler"
        group="categories"
      />
      <Transition name="slide-fade">
        <EditButton v-if="expanded" floating @click="emit('edit', spot)" />
      </Transition>
      <Transition name="slide-fade">
        <DeleteButton v-if="expanded" floating @click="emit('remove', spot.id)" />
      </Transition>
      <!-- #106: EIN gemeinsames Datums-/Status-Badge statt zweier unabhängiger Chips (das alte
           separate "Gemacht"-Badge unten rechts entfällt) - Text/Icon hängen vom Status ab
           (geplant/besucht), "spot.done && !scheduledDate" ist der Fallback für bereits vor #106
           als "gemacht" markierte Bestandsdaten ohne verknüpftes Datum (kein Backfill möglich, da
           der tatsächliche Tag nicht rekonstruierbar ist). -->
      <span
        v-if="scheduledDate || spot.done || dayWeather"
        class="status"
        :class="{ planned: scheduledDate && !spot.done, 'status-done': spot.done }"
      >
        <AppIcon
          class="status-icon"
          :size="14"
          :icon="
            spot.done
              ? ACTION_ICONS.done
              : scheduledDate
                ? FORM_FIELD_ICONS.date
                : ACTION_ICONS.today
          "
          group="actions"
        />
        <span class="status-text">
          <template v-if="spot.done && scheduledDate">Besucht am {{ plannedDateLabel }}</template>
          <template v-else-if="spot.done">Gemacht</template>
          <template v-else-if="scheduledDate">Geplant für {{ plannedDateLabel }}</template>
          <template v-else>Aktuelles Wetter</template>
          <template v-if="dayWeather">
            · <WeatherIcon :code="dayWeather.weatherCode" :size="14" />
            {{ Math.round(dayWeather.tempMax) }}°</template
          >
        </span>
      </span>
    </div>
    <div class="body">
      <div class="head">
        <h3>{{ spot.title }}</h3>
        <CategoryChip :category="spot.category" />
        <PendingSyncBadge v-if="spot._pending" />
      </div>
      <!-- Eigene, explizite Aktion statt am Aufklappen dranzuhängen (#109, siehe onShowOnMap im
           Script) – in Mini- UND aufgeklappter Karte sichtbar (Textlabel schrumpft im Kompakt-Modus
           auf reines Icon, siehe @container-Regel unten), gleiche Konvention wie
           ExcursionCard.vue/SpotDetailDialog.vue's "Auf Karte anzeigen"-Button. -->
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
        <div class="spot-accordion-inner">
          <p v-if="creatorLabel" class="detail-row">
            <span class="detail-label">Von</span>{{ creatorLabel }}
          </p>
          <template v-if="isAccommodation">
            <p v-if="spot.start_date || spot.end_date" class="detail-row">
              <span class="detail-label">Zeitraum</span>
              <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
              {{ formatAccommodationDate(spot.start_date) || '?' }} –
              {{ formatAccommodationDate(spot.end_date) || '?' }}
            </p>
            <p v-if="spot.address" class="detail-row">
              <span class="detail-label">Adresse</span>{{ spot.address }}
            </p>
            <p v-if="spot.checkin || spot.checkout" class="detail-row">
              <span class="detail-label">Check-in/-out</span>
              {{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}
            </p>
            <p
              v-if="spot.contact && parseContact(spot.contact).kind === 'phone'"
              class="detail-row"
            >
              <span class="detail-label">Kontakt</span>
              <AppIcon :icon="FORM_FIELD_ICONS.contact" :size="14" group="formFields" />
              <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
            </p>
            <p
              v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'"
              class="detail-row"
            >
              <span class="detail-label">Kontakt</span>
              <AppIcon :icon="FORM_FIELD_ICONS.email" :size="14" group="formFields" />
              <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
            </p>
            <p v-else-if="spot.contact" class="detail-row">
              <span class="detail-label">Kontakt</span>
              <span class="contact-text richtext" v-html="renderRichText(spot.contact)"></span>
            </p>
            <p v-if="spot.amount != null" class="detail-row">
              <span class="detail-label">Kosten</span>
              <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="14" group="formFields" />
              {{ spot.amount.toFixed(2) }} €
              <span v-if="hasMultipleMembers !== false && spot.paid_by_user_id">
                · bezahlt von {{ payerLabel }}</span
              >
            </p>
          </template>
          <RichTextDisplay
            v-if="spot.note"
            class="note"
            :content="spot.note"
            :format="spot.note_format"
          />
        </div>
      </div>

      <div
        class="mobile-only-accordion"
        :class="{ 'is-expanded': expanded }"
        :inert="!expanded"
      >
        <div class="mobile-only-accordion-inner">
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
            <button
              v-if="!isAccommodation"
              type="button"
              class="done-toggle"
              :class="{ active: !!spot.done }"
              :aria-pressed="!!spot.done"
              :aria-label="spot.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
              :title="spot.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
              @click.stop="onToggleDone"
            >
              <template v-if="spot.done">
                <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
              </template>
              <template v-else>
                <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" /> Als gemacht
                markieren
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

      <div class="spot-accordion" :class="{ 'is-expanded': expanded }" :inert="!expanded">
        <div class="spot-accordion-inner">
          <SocialRow
            class="social-row"
            :like-count="likeCount"
            :liked="liked"
            :comment-count="comments.length"
            @toggle-like="emit('toggle-like')"
            @toggle-comments="showComments = !showComments"
          />
          <Comments
            v-if="showComments"
            :comments="comments"
            @click.stop
            @submit="(content) => emit('submit-comment', content)"
            @remove="(id) => emit('remove-comment', id)"
          />
          <FileAttachments domain="spots" :entity-id="spot.id" :editable="false" />
        </div>
      </div>

      <Teleport to="body">
        <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> {{ spot.title }}
        </div>
      </Teleport>

      <Transition name="fade">
        <Button
          v-if="!expanded"
          type="button"
          variant="ghost"
          size="sm"
          class="mini-like-btn"
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
          <span v-if="likeCount > 0" class="mini-like-count">{{ likeCount }}</span>
        </Button>
      </Transition>
    </div>
  </Card>
</template>

<style scoped>
.spot-card {
  position: relative;
  padding: 0;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  border-width: var(--ui-border-width, 1px);
  border-style: solid;
  border-color: var(--color-border);
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
}

.spot-card.expanded {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.image {
  height: 120px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: height 0.15s ease;
  border-radius: var(--radius-md-squircle) var(--radius-md-squircle) 0 0;
  corner-shape: squircle;
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

.placeholder {
  font-size: 2.2rem;
}

/* Status-/Datums-Chip (#106: EIN gemeinsames Badge statt zweier unabhängiger Chips, ersetzt das
   frühere separate "Gemacht"-Badge) – dasselbe Muster wie ExcursionCard.vue's .status/.status.planned
   (inkl. Dark-Mode-Override unten), damit beide Karten-Typen optisch konsistent bleiben. Unten statt
   oben rechts positioniert: oben rechts sitzt hier bereits der schwebende Löschen-Button
   (EditButton/DeleteButton floating landen beide im selben .image-Container), anders als bei
   ExcursionCard.vue, wo der Löschen-Button außerhalb von .image auf Höhe der ganzen (breiteren) Card
   schwebt. Nur sichtbar, wenn geplant oder gemacht (siehe v-if im Template) statt immer einen
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

.body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

/* min-width:0 + Kürzung statt Umbruch: ohne das wechselte ein langer Titel zwischen ein-/
   zweizeilig abhängig von der paar Pixel schmaleren/breiteren .spots-col-Breite (Bottom-Sheet
   eingeklappt/ausgefahren, siehe ExcursionsView.vue) - wirkte beim Hoch-/Runterziehen wie ein
   hässlicher Layout-Sprung, obwohl sich der eigentlich verfügbare Platz kaum geändert hatte. Titel
   schrumpft jetzt statt umzubrechen, CategoryChip/PendingSyncBadge daneben behalten ihre feste
   Breite (Default flex-shrink:1 auf so kleinen Chips macht dort praktisch keinen Unterschied). */
.head h3 {
  margin: 0;
  font-size: 1rem;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note {
  overflow-wrap: anywhere;
}

.contact-text :deep(br:last-child) {
  display: none;
}

.social-row {
  margin-top: var(--space-3);
}

.mini-like-btn {
  position: absolute;
  bottom: var(--space-2);
  right: var(--space-2);
  z-index: 1;
  color: var(--color-text-muted);
}

.mini-like-btn.liked {
  color: var(--color-like);
}

.spot-card:not(.expanded) .card-actions {
  padding-right: 40px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
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

/* Toggle statt Anfasser (kein Drag, nur Klick) - gleicher Chip-Grundstil wie die Anfasser oben für
   optische Konsistenz, .active hebt den bereits gesetzten Status hervor (dieselbe Erfolgs-Farbe wie
   .status.planned). */
.done-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  corner-shape: round;
  padding: 3px 10px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.done-toggle.active {
  color: var(--color-success);
  font-weight: 600;
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
   zwischen Spots-Liste und Karte weit zur Karte hin zieht, nicht nur auf echtem Mobil. */
@container spots-col (max-width: 480px) {
  .spot-card:not(.expanded) {
    flex-direction: row;
    align-items: stretch;
  }

  .spot-card:not(.expanded) .image {
    width: 64px;
    height: auto;
    flex-shrink: 0;
    /* Bild sitzt hier links statt oben (Zeilen- statt Spalten-Layout) - deshalb linke statt obere
       Ecken gerundet (siehe .image oben). */
    border-radius: var(--radius-md-squircle) 0 0 var(--radius-md-squircle);
    corner-shape: squircle;
  }

  .spot-card:not(.expanded) .body {
    padding: var(--space-2);
    gap: 2px;
    /* Ohne das bleibt .body (jetzt ein Flex-Item in der Zeile statt in der Spalte, siehe
       .spot-card:not(.expanded) oben) auf seiner automatischen Mindestbreite stehen - die entspricht
       ohne explizites min-width:0 dem eigenen min-content (rekursiv über .head bis zum Titel
       berechnet), bei einem langen, per white-space:nowrap absichtlich nicht umbrechenden Titel also
       dessen volle Textbreite. .head h3 kürzt zwar selbst schon per Ellipsis (siehe dortiges CSS),
       das greift aber erst, wenn .body überhaupt auf die verfügbare Breite schrumpfen darf - sonst
       ragte die ganze Karte (und mit ihr die komplette Spots-Liste) auf schmalen Mobilbreiten seitlich
       über den Bildschirmrand hinaus (horizontale Scrollleiste statt gekürztem Titel). */
    min-width: 0;
  }

  .spot-card:not(.expanded) .note,
  .spot-card:not(.expanded) .card-actions,
  .spot-card:not(.expanded) .maps-picker {
    display: none;
  }

  /* Anders als .note/.card-actions/.maps-picker oben bleibt .links (der "Auf Karte
     anzeigen"-Button) hier bewusst sichtbar (#109 - der Button muss auch auf der Mini-Karte
     erreichbar sein), schrumpft aber auf einen reinen Icon-Kreis (Textlabel ausgeblendet) statt
     der vollen Pille - gleiches Verkleinerungs-Muster wie .status unten. */
  .spot-card:not(.expanded) .links {
    margin: var(--space-2) 0;
  }

  .spot-card:not(.expanded) .show-on-map-btn .btn-label {
    display: none;
  }

  .spot-card:not(.expanded) .show-on-map-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .spot-card:not(.expanded) .social-row {
    margin-top: 0;
  }

  /* Ohne diesen Fix ragten die Status-Pillen (Text+Icon, ~90-110px breit) über das auf 64px
     geschrumpfte Vorschaubild hinaus in den Titel/Kategorie-Bereich daneben - hier stattdessen zu
     reinen Icon-Kreisen (ohne Text/Datum/Wetter-Detail) verkleinert, die garantiert innerhalb der
     64px passen. Das Detail bleibt beim Aufklappen der Karte sichtbar (.spot-card.expanded nutzt
     weiterhin die volle Pillen-Darstellung von .status oben), analog zum bereits bestehenden Muster,
     dass .note/.links/.card-actions/.maps-picker im Kompakt-Modus ausgeblendet werden. */
  .spot-card:not(.expanded) .status {
    width: 22px;
    height: 22px;
    padding: 0;
    justify-content: center;
    border-radius: 50%;
  }

  .spot-card:not(.expanded) .status-text {
    display: none;
  }

  /* Etwas kleiner als der Desktop-Wert (200px) aus der Aufklapp-Ansicht, damit das Bild auf
     schmalen Bildschirmen nicht zu dominant wirkt. */
  .spot-card.expanded .image {
    height: 160px;
  }

  .mobile-only-accordion {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .mobile-only-accordion.is-expanded {
    grid-template-rows: 1fr;
  }

  .mobile-only-accordion-inner {
    overflow: hidden;
  }

  .mobile-only-accordion-inner > * {
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
    opacity: 0;
    transform: translateY(-10px);
  }

  .mobile-only-accordion.is-expanded .mobile-only-accordion-inner > * {
    opacity: 1;
    transform: translateY(0);
  }
}

.mobile-only-accordion {
  display: contents; /* Auf Desktop komplett durchlässig */
}

.spot-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.spot-accordion.is-expanded {
  grid-template-rows: 1fr;
}

.spot-accordion-inner {
  overflow: hidden;
}

/* Einfaden und Slide-in für die Inhalte */
.spot-accordion-inner > *,
.excursion-accordion-inner > * {
  transition:
    opacity 0.4s ease,
    transform 0.4s ease;
  opacity: 0;
  transform: translateY(-10px);
}

.spot-accordion.is-expanded .spot-accordion-inner > *,
.excursion-accordion.is-expanded .excursion-accordion-inner > * {
  opacity: 1;
  transform: translateY(0);
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
</style>
