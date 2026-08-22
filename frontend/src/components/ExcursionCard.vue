<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { excursionStationKeys, resolveStations } from '../utils/excursionStations';
import { fetchWeatherForecast, weatherCodeMeta, type DailyWeather } from '../utils/weather';
import { usePointerDrag } from '../composables/usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import SocialRow from './SocialRow.vue';
import Comments, { type CommentItem } from './Comments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import SpotImageCollage from './SpotImageCollage.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import AppIcon from './AppIcon.vue';
import WeatherIcon from './WeatherIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { TRAVEL_ROLE_META } from '../utils/travelRole';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { formatTravelDuration, travelDurationMinutes } from '../utils/travelDuration';

const props = defineProps<{
  excursion: Excursion;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  // Roher Spot-Pool (nicht schon aufgelöst) – wird 1:1 an ExcursionDetailDialog.vue durchgereicht
  // (siehe dort, braucht dieselben Listen für seinen eigenen Stations-Resolver-Aufruf), hier lokal
  // per resolveStations() zu resolvedStations aufgelöst (Icon/Titel/Bild je nach Spot-Kategorie,
  // siehe utils/excursionStations.ts).
  stations: Spot[];
  travelItems: TravelItem[];
  highlighted?: boolean;
  // Analog zu SpotCard.vue's expanded-Prop (dort ausführlich begründet): lebt beim Elternteil
  // (ExcursionsView.vue), damit ein künftiger Fokus-Sprung von außen (z. B. Karten-Klick auf die
  // Tour-Route) dieselbe Karte aufklappen könnte, ohne dass diese Komponente von dort direkt
  // ansprechbar sein müsste. Ersetzt den früheren ExcursionDetailDialog.vue-Modal-Dialog (#92) - an
  // Ort und Stelle aufklappen statt Overlay, exakt wie bei SpotCard.
  expanded: boolean;
}>();
const emit = defineEmits<{
  (e: 'remove', id: number): void;
  (e: 'edit', excursion: Excursion): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'drop-spot', spotId: number): void;
  (e: 'show-on-map'): void;
  (e: 'open', excursion: Excursion): void;
  (e: 'close'): void;
}>();

// Klick auf die Karte klappt sie auf-/zu, statt (wie zuvor) einen Modal-Dialog zu öffnen (#92) -
// exakt dasselbe Muster wie SpotCard.vue's onCardClick, nur ohne dessen zusätzlichen
// Karten-Fokus-Nebeneffekt (der ist dort seit #109 ebenfalls entfernt - "Auf Karte anzeigen"
// bleibt bewusst eine eigene, explizite Aktion statt am Aufklappen dranzuhängen).
function onCardClick() {
  if (props.expanded) emit('close');
  else emit('open', props.excursion);
}

const resolvedStations = computed(() =>
  resolveStations(excursionStationKeys(props.excursion.spot_ids), props.stations, props.travelItems),
);

const hasMappedStations = computed(() => resolvedStations.value.some((s) => s.lat != null && s.lng != null));

// Fallback-Bilder, falls der Ausflug selbst kein Bild hat: Bilder der zugeordneten Spot-Stationen
// in der definierten Reihenfolge (bereits die Reihenfolge von resolvedStations, siehe oben).
// Unterkunft-/Reise-Stationen haben kein eigenes Bild (imageUrl null) und fallen dadurch
// automatisch raus. Bei ≥2 Bildern eine kleine Collage (SpotImageCollage.vue) statt nur des ersten
// Bilds – macht auf einen Blick erkennbar, dass hier mehrere Orte drinstecken, statt wie ein
// einzelner Spot auszusehen.
const fallbackImages = computed(() =>
  resolvedStations.value.map((s) => s.imageUrl).filter((url): url is string => !!url),
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

// Wetter für den geplanten Tag am Ort der ersten kartierten Station, direkt am Status-Chip (siehe
// Template) - gleiches Muster wie SpotCard.vue: eigener Fetch statt Prop von der Elternview, da
// utils/weather.ts's fetchWeatherForecast() modulweit pro Koordinate+Modell cached.
const weatherProvider = useWeatherProviderStore();
const weatherStation = computed(() => resolvedStations.value.find((s) => s.lat != null && s.lng != null));
const dayWeather = ref<DailyWeather | null>(null);
watch(
  () => [props.excursion.date, weatherStation.value?.lat, weatherStation.value?.lng, weatherProvider.model] as const,
  async ([date, lat, lng, model]) => {
    dayWeather.value = null;
    if (!date || lat == null || lng == null) return;
    try {
      const days = await fetchWeatherForecast(lat, lng, model);
      dayWeather.value = days.find((d) => d.date === date) ?? null;
    } catch {
      // best effort, siehe Kommentar oben
    }
  },
  { immediate: true },
);

// Nur noch das Datum als String - Icon/Wetter rendert das Template direkt (siehe dort), statt es
// wie zuvor in einen einzigen, nicht auftrennbaren String einzubacken.
const statusDateLabel = computed(() => (props.excursion.date ? formatDate(props.excursion.date) : ''));

// #176: Anreise/Abreise/Weiterreise (ehemalige Reise-Etappe) - dieselbe Card wie eine normale Tour,
// mit zusätzlicher Rollen-/Route-/Dauer-Anzeige (übernommen aus der früheren TravelView.vue).
// resolvedStations[0]/[1] sind bei gesetzter role immer Von/Nach (siehe routes/ideas.ts's
// Zwei-Stationen-Validierung).
const routeLabel = computed(() => {
  if (!props.excursion.role || resolvedStations.value.length < 2) return null;
  return `${resolvedStations.value[0].title} → ${resolvedStations.value[1].title}`;
});
const travelDuration = computed(() => {
  const minutes = travelDurationMinutes(props.excursion.departure_time, props.excursion.arrival_time);
  return minutes == null ? null : formatTravelDuration(minutes);
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

// #106/#147: Status-Kette in Planung -> geplant -> gemacht statt (wie zuvor) eines von geplant/
// ungeplant unabhängigen Flags - eine Tour darf nicht ohne Datum "gemacht" sein. Zurück auf
// "geplant" braucht dafür kein neues Datum (setDone(false) direkt). Beim Übergang zu "gemacht"
// entscheidet, ob bereits ein geplantes Datum existiert (#147: ursprünglich öffnete sich der
// Kalender IMMER, auch wenn schon ein Datum da war - das war unnötig, da das bereits geplante
// Datum ohnehin als Gemacht-Datum übernommen wird): mit Datum direkt markieren, nur ohne Datum
// (noch "in Planung") den Kalender zur Bestätigung des Tages öffnen (drawers.pendingSchedule mode
// 'confirm-done', ausgewertet in ScheduleView.vue's finishPendingSchedule()).
function onToggleDone() {
  if (props.excursion.done) {
    excursionsStore.setDone(props.excursion.id, false);
  } else if (props.excursion.date) {
    excursionsStore.setDone(props.excursion.id, true);
  } else {
    drawers.startPendingSchedule('excursion', props.excursion.id, 'confirm-done');
  }
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
  <div
    class="card excursion-card"
    :class="{ 'drop-target': spotDragOverCount > 0, 'new-highlight': highlighted, expanded }"
    @click="onCardClick"
    @dragover.prevent
    @dragenter.prevent="onSpotDragEnter"
    @dragleave="onSpotDragLeave"
    @drop.prevent="onSpotDrop"
  >
    <!-- Nur in der aufgeklappten Karte sichtbar (#143) - analog zu SpotCard.vue's Bearbeiten-/
         Löschen-Buttons: in der kompakten Karte überlagerte das Status-Badge (unten, immer sichtbar)
         bei langem Text (z. B. "Geplant für 20. Aug. · ☁️ 21°") sonst den links daneben schwebenden
         Bearbeiten-Button, v. a. bei der schmalen 140px-Miniatur im Desktop-Zeilen-Layout. -->
    <DeleteButton v-if="expanded" floating class="card-delete" @click="emit('remove', excursion.id)" />
    <div class="image" :style="displayImage ? { backgroundImage: `url(${displayImage})` } : {}">
      <SpotImageCollage v-if="showCollage" :images="fallbackImages" />
      <AppIcon
        v-else-if="!displayImage"
        class="placeholder"
        :size="35"
        :icon="excursion.role ? travelTypeIconDef(excursion.transport_type) : SECTION_ICON_DEFS.excursions"
        group="categories"
      />
      <EditButton v-if="expanded" floating @click="emit('edit', excursion)" />
      <!-- #106: EIN gemeinsames Datums-/Status-Badge statt zweier unabhängiger Chips (das alte
           separate "Gemacht"-Badge entfällt) - Text/Icon hängen vom Status ab (in Planung/geplant/
           gemacht). "excursion.done && !excursion.date" ist der Fallback für bereits vor #106 als
           "gemacht" markierte Bestandsdaten ohne verknüpften Termin (kein Backfill möglich, da der
           tatsächliche Tag nicht rekonstruierbar ist). -->
      <span class="status" :class="{ planned: excursion.date && !excursion.done, 'status-done': excursion.done }">
        <template v-if="excursion.done && excursion.date">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gemacht am {{ statusDateLabel
          }}<template v-if="dayWeather">
            · <WeatherIcon :code="dayWeather.weatherCode" :size="14" /> {{ Math.round(dayWeather.tempMax) }}°</template
          >
        </template>
        <template v-else-if="excursion.done"><AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gemacht</template>
        <template v-else-if="excursion.date">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="actions" /> Geplant für {{ statusDateLabel
          }}<template v-if="dayWeather">
            · <WeatherIcon :code="dayWeather.weatherCode" :size="14" /> {{ Math.round(dayWeather.tempMax) }}°</template
          >
        </template>
        <template v-else>In Planung</template>
      </span>
    </div>
    <div class="body">
      <div class="title-row">
        <h3>{{ excursion.title }}</h3>
        <PendingSyncBadge v-if="excursion._pending" />
      </div>
      <!-- Nur in der aufgeklappten Karte (#92, ersetzt den früheren ExcursionDetailDialog.vue) -
           analog zu SpotCard.vue's "Von <creator>"-Zeile/Notiz, die dort ebenfalls erst beim
           Aufklappen sichtbar wird. -->
      <span v-if="excursion.role" class="role-badge">
        <AppIcon :icon="TRAVEL_ROLE_META[excursion.role].tabler" :size="14" group="categories" /> {{ TRAVEL_ROLE_META[excursion.role].label }}
      </span>
      <p v-if="routeLabel" class="route">{{ routeLabel }}</p>
      <p v-if="excursion.role && (excursion.departure_time || excursion.arrival_time)" class="departure-arrival">
        <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" />
        <span v-if="excursion.departure_time">{{ excursion.departure_time }}<span v-if="excursion.arrival_time">–{{ excursion.arrival_time }}</span> Uhr</span>
        <span v-if="travelDuration" class="duration">({{ travelDuration }})</span>
      </p>
      <p v-if="expanded && creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
      <RichTextDisplay v-if="expanded && excursion.note" class="note" :content="excursion.note" :format="excursion.note_format" />
      <div class="links" v-if="hasMappedStations">
        <button type="button" class="card-action-btn" @click.stop="emit('show-on-map')">
          <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Auf Karte anzeigen
        </button>
      </div>
      <div class="card-actions">
        <button
          type="button"
          class="calendar-drag-handle"
          aria-label="Auf Kalender ziehen zum Einplanen"
          title="Auf Kalender ziehen zum Einplanen"
          @pointerdown="onPointerDown"
          @click.stop
        >
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Einplanen
        </button>
        <!-- #147: kein Textlabel mehr im "gemacht"-Zustand - das Datums-/Status-Badge auf dem
             Vorschaubild ("Gemacht am ...") zeigt den Status bereits an, ein zweites "Gemacht"-Label
             hier war eine unnötige Dopplung. aria-label/title ersetzen den weggefallenen sichtbaren
             Text für Screenreader/Tooltip. -->
        <button
          type="button"
          class="done-toggle"
          :class="{ active: !!excursion.done }"
          :aria-pressed="!!excursion.done"
          :aria-label="excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
          :title="excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
          @click.stop="onToggleDone"
        >
          <template v-if="excursion.done">
            <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          </template>
          <template v-else>
            <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" /> Als gemacht markieren
          </template>
        </button>
      </div>
      <Teleport to="body">
        <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> {{ excursion.title }}
        </div>
      </Teleport>
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
    </div>
  </div>
</template>

<style scoped>
/* Volle Breite statt kleiner Grid-Card (wie Tagebucheinträge) – macht Ausflüge auf einen Blick von
   den (weiterhin als Grid angezeigten) Spots unterscheidbar. Bild als schmale, feste Miniatur
   links statt großem Banner oben, damit es bei voller Breite nicht unnötig gestreckt wirkt. */
.excursion-card {
  position: relative;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 120px;
  border: 2px dashed transparent;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

/* Löschen-Button schwebt in der oberen rechten Ecke der ganzen Card (nicht des Vorschaubilds) –
   .excursion-card ist dafür position:relative. */
.card-delete {
  z-index: 1;
}

/* Spot per Drag&Drop aus der Spots-Sicht darauf ablegen (SpotCard.vue ist die Drag-Quelle). */
.excursion-card.drop-target {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

/* Ersetzt den früheren ExcursionDetailDialog.vue-Modal-Dialog (#92): die Karte wächst an Ort und
   Stelle leicht (zusätzliche Zeilen für Ersteller:in/Notiz, siehe Template), statt einen Dialog
   über die Karte zu legen - exakt dasselbe Prinzip wie SpotCard.vue's .spot-card.expanded. Fester
   statt gestrichelter Rahmen (anders als .drop-target oben), damit die beiden Zustände optisch
   unterscheidbar bleiben. */
.excursion-card.expanded {
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

/* Eigene Rundung statt overflow:hidden auf .excursion-card: eine eckige .image würde sonst nicht zu
   den abgerundeten Kartenecken passen. .image sitzt außerdem selbst randlos (kein Abstand zur
   Kartenkante) und deckt damit ohne Vorschaubild bereits jede .new-highlight-Markierung (style.css)
   ab, die auf demselben Element sitzt - das ::after-Overlay dort liegt deshalb bewusst ÜBER allen
   normalen Kind-Elementen statt (wie früher) als eigener box-shadow direkt auf der Karte, sonst würde
   .image den Rahmen entlang der Bild-Kanten unsichtbar machen (#169). Linke Ecken gerundet, da .image
   hier links sitzt (Zeilen-Layout); die @media-Umschaltung unten auf Spalten-Layout rundet
   stattdessen die oberen Ecken. */
.image {
  width: 140px;
  flex-shrink: 0;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-radius: var(--radius-md-squircle) 0 0 var(--radius-md-squircle);
  corner-shape: squircle;
  overflow: hidden;
}

@media (max-width: 480px) {
  .excursion-card {
    flex-direction: column;
  }

  .image {
    width: auto;
    height: 140px;
    border-radius: var(--radius-md-squircle) var(--radius-md-squircle) 0 0;
  }
}

.placeholder {
  font-size: 2.5rem;
}

.body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  /* Ohne das bleibt .body (Flex-Item in der Zeile neben dem fest breiten .image, siehe
     .excursion-card oben) auf seiner automatischen, vom Titel bestimmten Mindestbreite stehen - die
     h3-Ellipsis unten greift erst, wenn .body überhaupt auf die verfügbare Breite schrumpfen darf
     (gleicher Fix wie SpotCard.vue's identisches .body). */
  min-width: 0;
}

/* min-width:0 + Kürzung statt Umbruch, gleiches Muster wie SpotCard.vue's .head h3 (siehe dortiger
   Kommentar) - langer Titel wechselte sonst zwischen ein-/zweizeilig je nach eingeklappter/
   ausgefahrener Bottom-Sheet-Breite. */
.body h3 {
  font-size: 1rem;
  margin-bottom: 0;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Unten statt oben rechts positioniert (#210): oben links schwebt der Bearbeiten-Button
   (EditButton.vue's .floating), bei langem Status-Text (z. B. "Gemacht am 20. Aug. · ☁️ 21°") ragte
   der von rechts wachsende Chip in der schmalen 140px-Miniatur bis dorthin und überlagerte ihn.
   Gleiches Muster wie SpotCard.vue's .status, dort aus demselben Grund bereits unten positioniert. */
.status {
  position: absolute;
  bottom: var(--space-3);
  right: var(--space-2);
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

/* Der immer-helle Hintergrund (für Kontrast über beliebigen Vorschaubildern) kollidiert im Dark
   Mode mit der hell eingefärbten --color-text-muted/--color-success-Schrift (für dunkle
   Hintergründe gedacht) – zu wenig Kontrast. Gleiches Muster wie bei den schwebenden
   Bearbeiten-/Löschen-Buttons: im Dark Mode ein dunkler halbtransparenter Chip statt fest hell. */
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

/* Toggle statt Anfasser (kein Drag, nur Klick) - gleicher Chip-Grundstil wie
   .calendar-drag-handle für optische Konsistenz, .active hebt den bereits gesetzten Status hervor
   (dieselbe Erfolgs-Farbe wie .status.planned). */
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

.calendar-drag-handle::before {
  content: '';
  flex-shrink: 0;
  width: 6px;
  height: 12px;
  background-image: radial-gradient(circle, currentColor 1px, transparent 1.3px),
    radial-gradient(circle, currentColor 1px, transparent 1.3px);
  background-size: 3px 4px, 3px 4px;
  background-position: 0 0, 3px 0;
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

.social-row {
  margin-top: var(--space-2);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: 4px;
}

.note {
  overflow-wrap: anywhere;
}

.role-badge {
  align-self: flex-start;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  border-radius: var(--radius-sm);
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
</style>
