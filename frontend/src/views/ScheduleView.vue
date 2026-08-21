<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import type { CalendarEntry, ScheduleItem, Spot, TodoItem, TravelItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import CalendarWeek from '../components/CalendarWeek.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import Modal from '../components/Modal.vue';
import DetailModal from '../components/DetailModal.vue';
import MapsAppPicker from '../components/MapsAppPicker.vue';
import Combobox from '../components/Combobox.vue';
import FormField from '../components/FormField.vue';
import DeleteButton from '../components/DeleteButton.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import FileAttachments from '../components/FileAttachments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import AppIcon from '../components/AppIcon.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import { buildAllEntries } from '../utils/calendarEntries';
import { calendarEventFromEntry, googleCalendarHref, outlookCalendarHref, triggerIcsDownload } from '../utils/calendarExport';
import { fetchWeatherForecast, weatherCodeMeta, type DailyWeather } from '../utils/weather';
import { collectWeatherLocations, dayWeatherEntries, type DayWeatherEntry } from '../utils/dayWeather';
import { endOfWeek, startOfWeek, toLocalDateString, formatDate as formatDateShared } from '../utils/dateFormat';

// Auf Desktop weiterhin eigenständig gemountete Schublade (App.vue, linker Platz). Auf Mobil
// dagegen dieselbe Komponente als eigenständige Seite (Route /calendar, siehe router/index.ts)
// statt in einer kaum bedienbaren Schublade – standalone (per Route-Prop gesetzt) reserviert dafür
// wie jede andere Seite unten Platz für eine unten fixierte mobile NavBar (siehe .page-Pendant in
// style.css; im Schubladen-Kontext übernimmt das stattdessen Drawer.vue's eigenes Scroll-Panel).
const props = defineProps<{ standalone?: boolean }>();
const router = useRouter();
const tripStore = useTripStore();
const trip = computed(() => tripStore.currentTrip);
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const scheduleStore = useScheduleStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const weatherProvider = useWeatherProviderStore();
// Unterkunft ist seit der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ganz
// normal ein Spot der Kategorie "Unterkunft" - kein eigener Fetch mehr nötig, spotsStore.load()
// bringt sie bereits mit.
const accommodations = computed(() => spotsStore.spots.filter((s) => s.category === 'Unterkunft'));
const todos = ref<TodoItem[]>([]);
const travelItems = ref<TravelItem[]>([]);
const selectedDate = ref<string | null>(null);
const loading = ref(true);

// Reise-Orte (Flughafen/Bahnhof/Zuhause/…) sind seit der Verschmelzung in Spots (siehe
// Migrationskommentar in db/index.ts) ganz normale Spots - der Standort-Vorschlag hier nutzt daher
// den geteilten spotsStore statt eines eigenen /travel/places-Fetches.
const placeNames = computed(() => spotsStore.spots.map((s) => s.title));

const newStartDate = ref('');
const newTime = ref('');
const newEndTime = ref('');
const newTitle = ref('');
const newNote = ref('');
const newEndDate = ref('');
const newLocation = ref('');
const newMapsLink = ref('');
// Verknüpfung mit einem Spot ('spot:<id>') oder einer Tour ('idea:<id>') statt Freitext-Standort –
// leer = kein verknüpftes Objekt. Ein String-Key (statt zweier separater IDs) macht die Auswahl im
// <select> unten trivial (ein einzelner v-model-Wert statt zweier sich gegenseitig ausschließender
// Felder), siehe parseLinkKey/linkKeyFor.
const newLinkKey = ref('');
const showAddForm = ref(false);

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts): das Create-Formular besteht
// (anders als in den meisten anderen Domänen) aus lauter einzelnen Refs statt eines Objekt-Refs -
// ein schreibbarer computed() bündelt sie zu einem einzigen Ref-kompatiblen Objekt, das die
// composable direkt lesen/überschreiben kann.
const newFormBundle = computed<Record<string, unknown>>({
  get: () => ({
    newStartDate: newStartDate.value,
    newTime: newTime.value,
    newEndTime: newEndTime.value,
    newTitle: newTitle.value,
    newNote: newNote.value,
    newEndDate: newEndDate.value,
    newLocation: newLocation.value,
    newMapsLink: newMapsLink.value,
    newLinkKey: newLinkKey.value,
  }),
  set: (v) => {
    newStartDate.value = (v.newStartDate as string) ?? '';
    newTime.value = (v.newTime as string) ?? '';
    newEndTime.value = (v.newEndTime as string) ?? '';
    newTitle.value = (v.newTitle as string) ?? '';
    newNote.value = (v.newNote as string) ?? '';
    newEndDate.value = (v.newEndDate as string) ?? '';
    newLocation.value = (v.newLocation as string) ?? '';
    newMapsLink.value = (v.newMapsLink as string) ?? '';
    newLinkKey.value = (v.newLinkKey as string) ?? '';
  },
});
const newDraft = useDraftAutosave('schedule:new', newFormBundle, showAddForm);

const editingItem = ref<ScheduleItem | null>(null);
const viewingItem = ref<ScheduleItem | null>(null);
const editForm = ref({
  time: '',
  endTime: '',
  title: '',
  note: '',
  endDate: '',
  location: '',
  mapsLink: '',
  linkKey: '',
});
const editDraft = useDraftAutosave(
  () => `schedule:edit:${editingItem.value?.id}`,
  editForm,
  computed(() => editingItem.value !== null),
);

function parseLinkKey(key: string): { spot_id: number | null; idea_id: number | null } {
  if (key.startsWith('spot:')) return { spot_id: Number(key.slice('spot:'.length)), idea_id: null };
  if (key.startsWith('idea:')) return { spot_id: null, idea_id: Number(key.slice('idea:'.length)) };
  return { spot_id: null, idea_id: null };
}

function linkKeyFor(item: Pick<ScheduleItem, 'spot_id' | 'idea_id'>): string {
  if (item.spot_id != null) return `spot:${item.spot_id}`;
  if (item.idea_id != null) return `idea:${item.idea_id}`;
  return '';
}

function titleForLinkKey(key: string): string | null {
  const { spot_id, idea_id } = parseLinkKey(key);
  if (spot_id != null) return spotsStore.spots.find((s) => s.id === spot_id)?.title ?? null;
  if (idea_id != null) return excursionsStore.excursions.find((e) => e.id === idea_id)?.title ?? null;
  return null;
}

// Übernimmt den Titel des verknüpften Spots/der Tour als Vorschlag, sobald eine Verknüpfung
// gewählt wird – nur falls noch kein eigener Titel eingetippt wurde, damit ein bereits getippter
// Titel nicht überschrieben wird.
watch(newLinkKey, (key) => {
  const t = key && titleForLinkKey(key);
  if (t && !newTitle.value.trim()) newTitle.value = t;
});
watch(
  () => editForm.value.linkKey,
  (key) => {
    const t = key && titleForLinkKey(key);
    if (t && !editForm.value.title.trim()) editForm.value.title = t;
  },
);

// Wählt man einen bekannten Ort aus der Vorschlagsliste (Combobox, exakter Namenstreffer), wird
// automatisch dessen Maps-Link übernommen – die bestehende parseLatLngFromMapsLink()-Logik beim
// Speichern (toBody/addItem/submitEdit weiter unten) ermittelt daraus dann wie gewohnt die
// Koordinaten, ganz ohne eigene Zusatzlogik.
function placeMapsLinkFor(name: string): string | null {
  return spotsStore.spots.find((s) => s.title === name)?.maps_link ?? null;
}
watch(newLocation, (name) => {
  const mapsLink = placeMapsLinkFor(name);
  if (mapsLink) newMapsLink.value = mapsLink;
});
watch(
  () => editForm.value.location,
  (name) => {
    const mapsLink = placeMapsLinkFor(name);
    if (mapsLink) editForm.value.mapsLink = mapsLink;
  },
);

// "Zum eigenen Kalender hinzufügen"-Menü: welcher Eintrag (per key) hat sein Menü gerade offen –
// gilt für ALLE Eintrags-Arten (echte wie automatisch erzeugte), nicht nur editierbare Termine.
// Per Teleport außerhalb der (scrollbaren, auf Desktop in der Kalender-Schublade begrenzten) Liste
// gerendert und per position:fixed anhand der Button-Position platziert statt relativ zum Button zu
// hängen – dasselbe Muster wie MapsAppPicker.vue, das genau dieses Abschneiden durch einen
// scrollbaren/größenbegrenzten Vorfahren löst. top wird zusätzlich nach dem ersten Render anhand der
// tatsächlichen Menühöhe an den unteren Viewport-Rand geklemmt (MapsAppPicker.vue klemmt nur
// horizontal, hier war das vertikale Abschneiden der eigentliche Bug).
const calendarPickerKey = ref<string | null>(null);
const calendarPickerStyle = ref({ top: '0px', left: '0px' });

async function toggleCalendarPicker(key: string, event: MouseEvent) {
  if (calendarPickerKey.value === key) {
    calendarPickerKey.value = null;
    return;
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  calendarPickerKey.value = key;
  calendarPickerStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.right - 188, window.innerWidth - 196))}px`,
  };
  await nextTick();
  // Kein Template-ref: der Trigger-Button (und damit auch sein .picker-menu) steckt im v-for über
  // die Termine – ein ref mit demselben Namen dort ergäbe ein Array statt eines einzelnen Elements.
  // Da immer höchstens ein Menü gleichzeitig offen ist (calendarPickerKey), reicht ein simpler
  // querySelector.
  const menuRect = document.querySelector('.picker-menu')?.getBoundingClientRect();
  if (menuRect && menuRect.bottom > window.innerHeight - 8) {
    calendarPickerStyle.value = { ...calendarPickerStyle.value, top: `${Math.max(8, window.innerHeight - menuRect.height - 8)}px` };
  }
}
function downloadIcsForEntry(entry: CalendarEntry) {
  triggerIcsDownload(calendarEventFromEntry(entry));
  calendarPickerKey.value = null;
}

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [todosRes, travelRes] = await Promise.all([
    api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
    spotsStore.load(),
    scheduleStore.load(),
  ]);
  todos.value = todosRes;
  travelItems.value = travelRes;
}

// Nicht ein einzelner globaler Wetterort mehr, sondern je nach Tag ein anderer: an Urlaubstagen der
// Urlaubsort (möglichst die an dem Tag aktive Unterkunft), an Nicht-Urlaubstagen zusätzlich Zuhause
// (falls unter Reise > Orte als "Zuhause" hinterlegt) – siehe utils/dayWeather.ts. Nutzt denselben
// modulweiten Cache wie DashboardView.vue (utils/weather.ts) – ein Besuch dort in derselben Session
// erspart hier den erneuten Netzwerk-Request pro Ort.
const home = computed(() => {
  const p = spotsStore.spots.find((s) => s.is_home && s.lat != null && s.lng != null);
  return p ? { lat: p.lat as number, lng: p.lng as number } : null;
});

const weatherByLocation = ref<Map<string, DailyWeather[]>>(new Map());

// Bewusst ohne eigenen Lade-/Fehlerzustand: Wetter ist hier nur ein optionales Extra je Tag, bei
// Fehlschlag eines einzelnen Ortes (Promise.allSettled) bleiben nur dessen Badges weg statt den
// ganzen Kalender mit einer Fehlermeldung zu blockieren.
async function loadWeather() {
  const locations = collectWeatherLocations(trip.value, home.value, accommodations.value);
  const results = await Promise.allSettled(
    locations.map(async (loc) => ({
      key: loc.key,
      days: await fetchWeatherForecast(loc.lat, loc.lng, weatherProvider.model),
    })),
  );
  const map = new Map<string, DailyWeather[]>();
  for (const result of results) {
    if (result.status === 'fulfilled') map.set(result.value.key, result.value.days);
  }
  weatherByLocation.value = map;
}

function weatherEntriesFor(date: string): DayWeatherEntry[] {
  return dayWeatherEntries(date, trip.value, accommodations.value, weatherByLocation.value);
}

// Markiert den Kalender als "gesehen" (Nav-Punkt verschwindet) – zusätzlich zum onMounted unten
// auch bei jedem Öffnen der Desktop-Schublade nötig, da diese View (siehe Kommentar unten) nur
// einmalig gemountet wird und onMounted daher beim bloßen Auf-/Zuklappen nicht erneut feuert.
watch(
  () => drawers.calendarOpen,
  (open) => {
    if (open) liveSync.markSeen('schedule');
  },
);

onMounted(async () => {
  liveSync.markSeen('schedule');
  try {
    await loadAll();
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Kalender soll
    // trotzdem rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für
    // immer blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  }
  loadWeather();
  selectedDate.value = toLocalDateString(new Date());
  // Beim ersten Laden direkt zur Woche mit dem heutigen Tag blättern statt bei der (ggf. Monate
  // zurückliegenden) ersten Woche zu starten; liegt heute außerhalb des Kalenderbereichs (z. B.
  // Urlaub komplett in der Vergangenheit/Zukunft ohne nahe ToDo-Fälligkeiten), zum Urlaubsstart.
  if (!goToDate(toLocalDateString(new Date())) && trip.value) {
    goToDate(trip.value.start_date);
  }
  loading.value = false;
});

// ScheduleView ist nicht mehr Teil des per Urlaub-Id gekeyten <router-view> (jetzt global
// gemountete Schublade), muss also selbst auf einen Urlaubswechsel reagieren.
watch(() => tripStore.currentTripId, loadAll);

// Die Kalender-Schublade wird einmalig gemountet und bleibt danach dauerhaft im DOM (siehe
// App.vue/Drawer.vue) – ohne dieses Signal würde ein nachträglich gesetzter Standort (z. B. über
// den manuellen Karten-Picker, TripForm.vue/ExcursionsView.vue) nie erneut Wetter laden, da
// onMounted (unten) nur einmal beim allerersten Mount läuft. drawers.touchLocations() wird von
// Unterkunft-/Reise-/Ausflüge-/Urlaub-Sicht nach jedem erfolgreichen Anlegen/Bearbeiten eines Orts
// aufgerufen (gleiches Muster wie TripMap.vue:772-778).
watch(
  () => drawers.locationsVersion,
  async () => {
    await loadAll();
    loadWeather();
  },
);

// Neu laden, sobald der Wetteranbieter in den Einstellungen gewechselt wird (siehe DashboardView.vue
// für dieselbe Kopplung).
watch(() => weatherProvider.model, loadWeather);

function toIso(d: Date) {
  return toLocalDateString(d);
}

function accommodationsForDate(date: string) {
  return accommodations.value.filter(
    (a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date,
  );
}

const allEntries = computed(() =>
  buildAllEntries(
    scheduleStore.items,
    trip.value,
    todos.value,
    travelItems.value,
    excursionsStore.excursions,
    spotsStore.spots,
  ),
);

function entriesForDate(date: string) {
  return allEntries.value
    .filter((e) => e.date <= date && date <= e.endDate)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
}

// Zeigt nicht nur den Urlaubszeitraum, sondern auch alle Tage, an denen Objekte im Kalender
// hinterlegt sind (z. B. ToDos oder Reise-Einträge mit Fälligkeits-/Termin-Datum vor Urlaubsbeginn).
const calendarRange = computed(() => {
  if (!trip.value) return null;
  const dates = [
    new Date(trip.value.start_date),
    new Date(trip.value.end_date),
    ...allEntries.value.flatMap((e) => [new Date(e.date), new Date(e.endDate)]),
  ];
  return {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
});

const weeks = computed(() => {
  if (!calendarRange.value) return [];
  const { start, end } = calendarRange.value;

  // Wochenanfang respektiert die Profil-Einstellung (Standard: Montag, siehe utils/dateFormat.ts).
  const firstWeekStart = startOfWeek(start);

  const result: { date: string; entries: CalendarEntry[]; accommodations: Spot[]; weatherEntries: DayWeatherEntry[] }[][] = [];
  let cursor = new Date(firstWeekStart);
  let week: { date: string; entries: CalendarEntry[]; accommodations: Spot[]; weatherEntries: DayWeatherEntry[] }[] = [];

  while (cursor <= end || week.length % 7 !== 0) {
    const iso = toIso(cursor);
    week.push({
      date: iso,
      entries: entriesForDate(iso),
      accommodations: accommodationsForDate(iso),
      weatherEntries: weatherEntriesFor(iso),
    });
    if (week.length === 7) {
      result.push(week);
      week = [];
    }
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
    if (cursor > end && week.length === 0) break;
  }
  return result;
});

// Bei langen Zeitspannen (z. B. ein ToDo mit Fälligkeitsdatum Monate vor dem Urlaub) würde die
// Schublade sonst eine sehr lange Liste an Wochen rendern – stattdessen wird nur ein Fenster
// angezeigt, durch das man blättert. Die Fenster-/Schrittgröße ist wählbar: wochenweise oder
// zweiwochenweise (beides ein gleitendes Fenster über die oben berechneten Wochen), "monatsweise"
// zeigt dagegen einen ECHTEN Kalendermonat (siehe monthWeeks weiter unten) – ein Kalendermonat lässt
// sich nicht auf ein festes Wochen-Vielfaches abbilden (4–6 Wochen, je nach Wochentag des 1. und
// Monatslänge), braucht deshalb eine eigene, von pageOffset/weeksPerPage unabhängige Berechnung.
type PageGranularity = 'week' | 'twoWeeks' | 'month';
const WEEKS_PER_PAGE_BY_GRANULARITY: Record<'week' | 'twoWeeks', number> = { week: 1, twoWeeks: 2 };
const granularity = ref<PageGranularity>('month');
const weeksPerPage = computed(() => (granularity.value === 'month' ? 4 : WEEKS_PER_PAGE_BY_GRANULARITY[granularity.value]));
const pageOffset = ref(0);

interface DayCell {
  date: string;
  entries: CalendarEntry[];
  accommodations: Spot[];
  weatherEntries: DayWeatherEntry[];
  otherMonth?: boolean;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Anker für die Monatsansicht (1. Tag des gerade angezeigten Monats) – eigenständig vom
// wochenbasierten pageOffset oben, da "ein Monat" kein festes Wochen-Vielfaches ist.
const monthAnchor = ref(startOfMonth(new Date()));

// Baut ein vollständiges Kalendermonat-Raster: Wochenanfang der Woche mit dem 1. bis Wochenende der
// Woche mit dem letzten Tag des Monats (führende/nachfolgende Tage aus Nachbarmonaten füllen das
// Raster auf volle Wochen auf, wie bei jedem üblichen Monatskalender – als otherMonth markiert,
// siehe CalendarWeek.vue). Wochenanfang respektiert die Profil-Einstellung (Standard: Montag).
const monthWeeks = computed<DayCell[][]>(() => {
  const year = monthAnchor.value.getFullYear();
  const month = monthAnchor.value.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const gridStart = startOfWeek(firstOfMonth);
  const gridEnd = endOfWeek(lastOfMonth);

  const result: DayCell[][] = [];
  let week: DayCell[] = [];
  const cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const iso = toIso(cursor);
    week.push({
      date: iso,
      entries: entriesForDate(iso),
      accommodations: accommodationsForDate(iso),
      weatherEntries: weatherEntriesFor(iso),
      otherMonth: cursor.getMonth() !== month,
    });
    if (week.length === 7) {
      result.push(week);
      week = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
});

const monthLabel = computed(() => monthAnchor.value.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }));

const visibleWeeks = computed<DayCell[][]>(() =>
  granularity.value === 'month'
    ? monthWeeks.value
    : weeks.value.slice(pageOffset.value, pageOffset.value + weeksPerPage.value),
);
const canGoPrev = computed(() => granularity.value === 'month' || pageOffset.value > 0);
const canGoNext = computed(
  () => granularity.value === 'month' || pageOffset.value + weeksPerPage.value < weeks.value.length,
);

const visibleRangeLabel = computed(() => {
  if (granularity.value === 'month') return monthLabel.value;
  if (!visibleWeeks.value.length) return '';
  const first = visibleWeeks.value[0][0]?.date;
  const lastWeek = visibleWeeks.value[visibleWeeks.value.length - 1];
  const last = lastWeek[lastWeek.length - 1]?.date;
  if (!first || !last) return '';
  const fmt = (d: string) => formatDateShared(d, { includeYear: false });
  return `${fmt(first)} – ${fmt(last)}`;
});

function clampOffset(idx: number) {
  return Math.min(Math.max(0, weeks.value.length - weeksPerPage.value), Math.max(0, idx));
}

function prevMonth() {
  monthAnchor.value = new Date(monthAnchor.value.getFullYear(), monthAnchor.value.getMonth() - 1, 1);
}
function nextMonth() {
  monthAnchor.value = new Date(monthAnchor.value.getFullYear(), monthAnchor.value.getMonth() + 1, 1);
}

function prevPage() {
  if (granularity.value === 'month') prevMonth();
  else pageOffset.value = clampOffset(pageOffset.value - weeksPerPage.value);
}
function nextPage() {
  if (granularity.value === 'month') nextMonth();
  else pageOffset.value = clampOffset(pageOffset.value + weeksPerPage.value);
}

// Beim Wechsel der Blätter-Granularität bleibt die erste sichtbare Woche als Anker erhalten,
// nur die Fenstergröße ändert sich – muss aber ggf. neu geklemmt werden, falls das größere
// Fenster sonst über das Ende des Kalenderbereichs hinausragen würde. Betrifft nur Woche/2 Wochen
// (weeksPerPage ist für "Monat" konstant 4, siehe oben) – der eigentliche Granularitäts-Wechsel
// von/zu "Monat" wird über den granularity-Watcher weiter unten synchronisiert.
watch(weeksPerPage, () => {
  pageOffset.value = clampOffset(pageOffset.value);
});

// Übernimmt beim Wechsel der Granularität den bisher sichtbaren Zeitraum als neuen Anker, statt
// unvermittelt zu einem unabhängigen Datum zu springen: Monat->Woche/2 Wochen übernimmt den ersten
// Tag des angezeigten Monats, Woche/2 Wochen->Monat den Monat der ersten sichtbaren Woche.
watch(granularity, (next, prev) => {
  if (next === 'month' && prev !== 'month') {
    const anchorDate = selectedDate.value ?? weeks.value[pageOffset.value]?.[0]?.date;
    if (anchorDate) monthAnchor.value = startOfMonth(new Date(anchorDate));
  } else if (prev === 'month' && next !== 'month') {
    // Gleicher Fallback wie beim allerersten Laden (onMounted unten): liegt der Anker außerhalb des
    // aktuellen Wochen-Kalenderbereichs (z. B. "heute" vor Urlaubsbeginn), zum Urlaubsstart springen
    // statt stillschweigend auf der vorherigen Woche-Position stehen zu bleiben.
    const anchorDate = selectedDate.value ?? toIso(monthAnchor.value);
    if (!goToDate(anchorDate) && trip.value) goToDate(trip.value.start_date);
  }
});

// Springt so, dass die Woche mit dem übergebenen Datum als erste Woche der Seite sichtbar wird
// (Woche/2 Wochen) bzw. der entsprechende Monat angezeigt wird (Monat). Gibt zurück, ob das Datum
// im aktuellen Kalenderbereich gefunden wurde (die Monatsansicht ist unbeschränkt, "findet" also
// immer).
function goToDate(dateIso: string): boolean {
  if (granularity.value === 'month') {
    monthAnchor.value = startOfMonth(new Date(dateIso));
    return true;
  }
  const idx = weeks.value.findIndex((week) => week.some((day) => day.date === dateIso));
  if (idx === -1) return false;
  pageOffset.value = clampOffset(idx);
  return true;
}

function jumpToToday() {
  const today = toLocalDateString(new Date());
  goToDate(today);
  selectDay(today);
}

function goToTripDates() {
  if (trip.value) goToDate(trip.value.start_date);
}

const dayEntries = computed(() => (selectedDate.value ? entriesForDate(selectedDate.value) : []));

function showDayOnMap() {
  if (!selectedDate.value) return;
  drawers.focusMapOnDate(selectedDate.value);
  // Analog zur Touren-Schublade (drawers.openMapForExcursion): Schublade schließen, damit die
  // gerade fokussierte Karte sofort sichtbar ist statt (v. a. mobil als Vollbild-Overlay) verdeckt
  // zu bleiben.
  drawers.calendarOpen = false;
}

const dayAccommodations = computed(() =>
  selectedDate.value ? accommodationsForDate(selectedDate.value) : [],
);

const selectedDateWeatherEntries = computed(() => (selectedDate.value ? weatherEntriesFor(selectedDate.value) : []));

// Klick-Alternative zum Drag-Einplanen (ExcursionCard.vue/SpotCard.vue's 📅-Anfasser als Button):
// wartet ein Einplanen-Vorhaben (drawers.pendingSchedule, per Klick auf den Anfasser gesetzt), löst
// der nächste Tages-Klick es auf, statt nur den Tag auszuwählen. mode 'confirm-done' (#106) setzt
// danach zusätzlich den "gemacht"-Status, siehe finishPendingSchedule.
function selectDay(date: string) {
  selectedDate.value = date;
  const pending = drawers.pendingSchedule;
  if (!pending) return;
  void finishPendingSchedule(pending, date);
}

async function finishPendingSchedule(
  pending: { kind: 'excursion' | 'spot'; id: number; mode: 'plan' | 'confirm-done' },
  date: string,
) {
  if (pending.kind === 'excursion') {
    await excursionsStore.setDate(pending.id, date);
    if (pending.mode === 'confirm-done') await excursionsStore.setDone(pending.id, true);
  } else {
    // Spot direkt einplanen: legt einen mit dem Spot verknüpften Termin an (statt wie früher
    // einen unsichtbaren Ein-Spot-Ausflug), siehe stores/schedule.ts.
    const spot = spotsStore.spots.find((s) => s.id === pending.id);
    if (spot && tripStore.currentTripId != null) {
      if (pending.mode === 'confirm-done') {
        await scheduleStore.setSpotDate(pending.id, tripStore.currentTripId, spot.title, date);
        await spotsStore.setDone(pending.id, true);
      } else {
        await scheduleStore.create({ trip_id: tripStore.currentTripId, date, title: spot.title, spot_id: spot.id });
      }
    }
  }
  drawers.clearPendingSchedule();
  returnToCard(pending.kind, pending.id);
}

// Abbrechen-Button im Banner unten (#106: sowohl beim spontanen Einplanen als auch beim
// Kalender-Bestätigungs-Flow für "gemacht" muss sich der Vorgang ohne Änderung abbrechen lassen).
function cancelPendingSchedule() {
  const pending = drawers.pendingSchedule;
  if (!pending) return;
  drawers.clearPendingSchedule();
  returnToCard(pending.kind, pending.id);
}

// #106: nach dem Einplanen/Bestätigen (oder Abbrechen) zurück zur Karten-Ansicht mit dem jeweiligen
// Spot/der jeweiligen Tour, statt (v. a. mobil, wo der Kalender eine eigenständige Seite ist, siehe
// standalone-Prop) im Kalender hängen zu bleiben. Nutzt denselben Querverweis-Hash-Mechanismus wie
// sonstige Cross-View-Sprünge (siehe utils/hashHighlight.ts) - ExcursionsView.vue klappt/scrollt die
// Karte darüber automatisch auf. Auf Desktop (Kalender nur eine Seitenschublade neben dem weiterhin
// sichtbaren Hauptinhalt) ist kein Rücksprung nötig.
function returnToCard(kind: 'excursion' | 'spot', id: number) {
  if (!props.standalone) return;
  router.push(`/excursions#${kind}-${id}`);
}

const pendingScheduleLabel = computed(() => {
  const pending = drawers.pendingSchedule;
  if (!pending) return null;
  if (pending.kind === 'excursion') return excursionsStore.excursions.find((e) => e.id === pending.id)?.title ?? null;
  return spotsStore.spots.find((s) => s.id === pending.id)?.title ?? null;
});

// Ausflüge werden direkt aus der Ausflüge-Sicht per Drag&Drop hierher gezogen (ExcursionCard.vue) –
// legt/aktualisiert im Hintergrund den mit der Tour verknüpften Termin (routes/ideas.ts), ohne
// dass sich hier am Aufruf selbst etwas ändert.
function onDropExcursion(date: string, excursionId: number) {
  excursionsStore.setDate(excursionId, date);
}

// Öffnet den "Termin anlegen"-Dialog (jetzt global im Kalender-Werkzeugleiste statt an den
// ausgewählten Tag gebunden, siehe Vorlage) – ist ein Tag bereits ausgewählt, wird er als
// Startdatum vorausgefüllt, sonst bleibt das Feld leer und muss manuell gesetzt werden.
function openAddForm() {
  newStartDate.value = selectedDate.value ?? '';
  showAddForm.value = true;
}

function closeAddForm() {
  showAddForm.value = false;
  newStartDate.value = '';
  newTime.value = '';
  newEndTime.value = '';
  newTitle.value = '';
  newNote.value = '';
  newEndDate.value = '';
  newLocation.value = '';
  newMapsLink.value = '';
  newLinkKey.value = '';
  newDraft.clear();
}

// Ein direkt über den Schedule-Store angelegter/geänderter/gelöschter, mit einer Tour verknüpfter
// Termin verändert deren abgeleitetes Datum (schedule_items.idea_id, siehe routes/ideas.ts) –
// excursionsStore hält davon aber eine eigene, unabhängig geladene Kopie (Excursion.date), die
// sich ohne diesen Refresh nicht von selbst aktualisieren würde (im Unterschied zu
// excursionsStore.setDate/PUT /ideas/:id, das die eigene Kopie direkt mitaktualisiert).
async function syncExcursionsIfLinked(...ideaIds: (number | null | undefined)[]) {
  if (ideaIds.some((id) => id != null)) await excursionsStore.load();
}

async function addItem() {
  if (!newStartDate.value || !newTitle.value.trim() || tripStore.currentTripId == null) return;
  const parsed = parseLatLngFromMapsLink(newMapsLink.value);
  const { spot_id, idea_id } = parseLinkKey(newLinkKey.value);
  const linked = spot_id != null || idea_id != null;
  await scheduleStore.create({
    trip_id: tripStore.currentTripId,
    date: newStartDate.value,
    end_date: newEndDate.value || undefined,
    time: newTime.value || undefined,
    end_time: newEndTime.value || undefined,
    title: newTitle.value.trim(),
    note: newNote.value || undefined,
    // Verknüpfter Spot/Tour liefert den Standort selbst (routes/schedule.ts) – Freitext-Felder
    // bleiben dafür unbenutzt (siehe auch v-if in der Vorlage, die sie in dem Fall ausblendet).
    location: linked ? undefined : newLocation.value || undefined,
    maps_link: linked ? undefined : newMapsLink.value || undefined,
    lat: linked ? undefined : parsed?.lat,
    lng: linked ? undefined : parsed?.lng,
    spot_id,
    idea_id,
  });
  await syncExcursionsIfLinked(idea_id);
  closeAddForm();
}

function startEdit(item: ScheduleItem) {
  editingItem.value = item;
  editForm.value = {
    time: item.time ?? '',
    endTime: item.end_time ?? '',
    title: item.title,
    note: item.note ?? '',
    endDate: item.end_date ?? '',
    location: item.location ?? '',
    mapsLink: item.maps_link ?? '',
    linkKey: linkKeyFor(item),
  };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.title.trim() || tripStore.currentTripId == null) return;
  const parsed = parseLatLngFromMapsLink(editForm.value.mapsLink);
  const { spot_id, idea_id } = parseLinkKey(editForm.value.linkKey);
  const linked = spot_id != null || idea_id != null;
  const previousIdeaId = editingItem.value.idea_id;
  await scheduleStore.update(editingItem.value.id, {
    trip_id: tripStore.currentTripId,
    date: editingItem.value.date,
    end_date: editForm.value.endDate || undefined,
    time: editForm.value.time || undefined,
    end_time: editForm.value.endTime || undefined,
    title: editForm.value.title.trim(),
    note: editForm.value.note || undefined,
    location: linked ? undefined : editForm.value.location || undefined,
    maps_link: linked ? undefined : editForm.value.mapsLink || undefined,
    lat: linked ? undefined : parsed?.lat ?? editingItem.value.lat ?? undefined,
    lng: linked ? undefined : parsed?.lng ?? editingItem.value.lng ?? undefined,
    spot_id,
    idea_id,
  });
  // Beide IDs (alt UND neu): eine Tour-Verknüpfung kann sich ändern (andere Tour ausgewählt) oder
  // ganz entfernt werden – in beiden Fällen muss die vorher verknüpfte Tour ihr Datum verlieren.
  await syncExcursionsIfLinked(previousIdeaId, idea_id);
  editDraft.clear();
  editingItem.value = null;
}

function closeEditForm() {
  editDraft.clear();
  editingItem.value = null;
}

function jumpToTrip() {
  tripStore.requestEditTrip();
}

function openEntry(entry: CalendarEntry) {
  if (entry.kind === 'trip') jumpToTrip();
  // Hash-Sprung (#todo-<id>/#travel-<id>) statt bloß der Ziel-Route: TodoView.vue/TravelSection.vue
  // nehmen die id über hashHighlightId() zusätzlich in ihre bereits bestehende highlightedIds-Menge
  // auf, der Router scrollt automatisch zum Element mit dieser id (siehe router/index.ts's
  // scrollBehavior).
  else if (entry.kind === 'todo') router.push(`/listen?tab=todo#todo-${entry.todoId}`);
  else if (entry.kind === 'travel') router.push(`/excursions?group=travel#travel-${entry.travelId}`);
  else if (entry.kind === 'schedule') viewingItem.value = entry.scheduleItem;
}

/** Für die Todo-Checkbox im Kalender (Tages-Detailliste + CalendarWeek.vue's Kompaktzelle): der
 *  aktuelle Erledigt-Status kommt aus der bereits geladenen todos-Referenz, nicht aus
 *  CalendarEntry.done direkt (das speist nur die kompakte Zellen-Darstellung, siehe unten). */
function entryDone(entry: CalendarEntry): boolean {
  return !!todos.value.find((t) => t.id === entry.todoId)?.done;
}

async function toggleTodoDone(todoId: number) {
  const todo = todos.value.find((t) => t.id === todoId);
  if (!todo) return;
  const updated = await api.put<TodoItem>(`/todos/${todoId}`, {
    trip_id: tripStore.currentTripId,
    title: todo.title,
    assigned_to_user_id: todo.assigned_to_user_id,
    due_date: todo.due_date ?? undefined,
    priority: todo.priority,
    note: todo.note ?? undefined,
    done: !todo.done,
  });
  const idx = todos.value.findIndex((t) => t.id === todoId);
  if (idx !== -1) todos.value[idx] = updated;
}

// Der Anzeige-Dialog (DetailModal) braucht dieselbe Icon-/Kategorie-Auflösung wie die Kalender-
// Kärtchen selbst (Spot-/Tour-Verknüpfung, siehe calendarEntries.ts) – statt sie ein zweites Mal
// separat zu berechnen, wird einfach der schon fertig berechnete CalendarEntry wiederverwendet.
const viewingEntry = computed(() =>
  viewingItem.value ? allEntries.value.find((e) => e.scheduleItem?.id === viewingItem.value!.id) ?? null : null,
);

function linkedTitleFor(entry: CalendarEntry | null): string | null {
  if (!entry) return null;
  if (entry.spotId != null) return spotsStore.spots.find((s) => s.id === entry.spotId)?.title ?? null;
  if (entry.ideaId != null) return excursionsStore.excursions.find((e) => e.id === entry.ideaId)?.title ?? null;
  return null;
}

function editViewingItem() {
  if (!viewingItem.value) return;
  startEdit(viewingItem.value);
  viewingItem.value = null;
}

async function deleteViewingItem() {
  if (!viewingItem.value) return;
  const ideaId = viewingItem.value.idea_id;
  await scheduleStore.remove(viewingItem.value.id);
  await syncExcursionsIfLinked(ideaId);
  viewingItem.value = null;
}

function formatDay(date: string) {
  return new Date(date).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function formatDate(date: string) {
  return formatDateShared(date);
}
</script>

<template>
  <div class="calendar-drawer-content" :class="{ standalone }" v-if="!loading">
    <h2>Kalender</h2>

    <div class="pending-schedule-banner" v-if="drawers.pendingSchedule">
      <span v-if="drawers.pendingSchedule.mode === 'confirm-done'">
        <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Wähle den Tag, an dem „{{ pendingScheduleLabel }}“
        {{ drawers.pendingSchedule.kind === 'excursion' ? 'gemacht' : 'besucht' }} wurde
      </span>
      <span v-else><AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Tippe einen Tag an, um „{{ pendingScheduleLabel }}“ einzuplanen</span>
      <button type="button" class="secondary" @click="cancelPendingSchedule">Abbrechen</button>
    </div>

    <div class="calendar-toolbar">
      <div class="granularity-row">
        <SegmentedToggle
          v-model="granularity"
          :options="[
            { value: 'week', label: 'Woche' },
            { value: 'twoWeeks', label: '2 Wochen' },
            { value: 'month', label: 'Monat' },
          ]"
        />
      </div>
      <div class="pager">
        <button type="button" class="secondary page-btn" :disabled="!canGoPrev" @click="prevPage" aria-label="Vorherige Wochen">
          ‹
        </button>
        <span class="range-label">{{ visibleRangeLabel }}</span>
        <button type="button" class="secondary page-btn" :disabled="!canGoNext" @click="nextPage" aria-label="Nächste Wochen">
          ›
        </button>
      </div>
      <div class="jump-row">
        <button type="button" class="card-action-btn" @click="jumpToToday">
          <AppIcon :icon="ACTION_ICONS.today" :size="14" group="actions" /> Heute
        </button>
        <button type="button" class="card-action-btn" v-if="trip" @click="goToTripDates">
          <AppIcon :icon="ACTION_ICONS.vacation" :size="14" group="actions" /> Urlaub
        </button>
        <button type="button" @click="openAddForm"><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Neu</button>
      </div>
    </div>

    <div class="card weeks">
      <CalendarWeek
        v-for="week in visibleWeeks"
        :key="week[0]?.date"
        :days="week"
        :selected-date="selectedDate"
        @select="selectDay"
        @drop-excursion="onDropExcursion"
      />
    </div>

    <div class="card day-detail" v-if="selectedDate">
      <div class="day-detail-head">
        <h3>{{ formatDay(selectedDate) }}</h3>
        <div class="day-detail-actions">
          <button type="button" class="card-action-btn" @click="showDayOnMap">
            <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte anzeigen
          </button>
        </div>
      </div>

      <p v-for="entry in selectedDateWeatherEntries" :key="entry.key" class="day-weather-note">
        <AppIcon :icon="entry.tabler" :size="15" group="categories" /> {{ entry.label }}:
        <WeatherIcon :code="entry.weather.weatherCode" :size="15" />
        {{ Math.round(entry.weather.tempMax) }}° / {{ Math.round(entry.weather.tempMin) }}°
        <span v-if="entry.weather.precipitationProbability != null">
          · <AppIcon :icon="ACTION_ICONS.rain" :size="13" group="actions" />{{ entry.weather.precipitationProbability }}%
        </span>
      </p>

      <p v-for="acc in dayAccommodations" :key="acc.id" class="acc-note">
        <AppIcon :icon="spotCategoryMeta('Unterkunft').tabler" :size="14" group="categories" /> Unterkunft: {{ acc.title }}
      </p>

      <TransitionGroup tag="ul" name="list" class="items">
        <template v-for="entry in dayEntries" :key="entry.key">
          <!-- 60s-Rückgängig-Fenster (useUndoableDelete.ts über stores/schedule.ts): der gelöschte
               Termin bleibt bis dahin an seiner Stelle in der Liste, zeigt aber nur noch diesen
               Platzhalter statt der normalen Karte. -->
          <li
            v-if="entry.kind === 'schedule' && scheduleStore.isPending(entry.scheduleItem!.id)"
            class="item"
          >
            <UndoDeleteRow :label="entry.title" @undo="scheduleStore.restore(entry.scheduleItem!.id)" />
          </li>
          <li
            v-else
            class="item clickable"
            :style="{ borderLeftColor: SCHEDULE_CATEGORY_META[entry.category].color }"
            @click="openEntry(entry)"
          >
            <div>
              <input
                v-if="entry.kind === 'todo'"
                type="checkbox"
                class="category-icon"
                title="Erledigt"
                autocomplete="off"
                :checked="entryDone(entry)"
                @click.stop="toggleTodoDone(entry.todoId!)"
              />
              <AppIcon
                v-else
                class="category-icon"
                :size="16"
                :icon="entry.iconDef ?? SCHEDULE_CATEGORY_META[entry.category].tabler"
                group="categories"
                :title="SCHEDULE_CATEGORY_META[entry.category].label"
              />
              <strong v-if="entry.time">{{ entry.time }}</strong>
              <span class="title">{{ entry.title }}</span>
              <p v-if="entry.location" class="location">
                <AppIcon :icon="FORM_FIELD_ICONS.location" :size="13" group="formFields" /> {{ entry.location }}
              </p>
              <p v-if="entry.note" class="note">{{ entry.note }}</p>
            </div>
            <div class="item-actions">
              <div class="calendar-export">
                <button
                  type="button"
                  class="secondary calendar-btn"
                  title="Zum eigenen Kalender hinzufügen"
                  aria-label="Zum eigenen Kalender hinzufügen"
                  @click.stop="toggleCalendarPicker(entry.key, $event)"
                >
                  <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" />
                </button>
                <Teleport to="body">
                  <template v-if="calendarPickerKey === entry.key">
                    <div class="picker-backdrop" @click.stop="calendarPickerKey = null"></div>
                    <div class="picker-menu" :style="calendarPickerStyle" @click.stop>
                      <button type="button" @click="downloadIcsForEntry(entry)">
                        <AppIcon :icon="ACTION_ICONS.apple" :size="14" group="actions" /> Apple/iPhone
                      </button>
                      <a
                        :href="googleCalendarHref(calendarEventFromEntry(entry))"
                        target="_blank"
                        rel="noopener"
                        @click="calendarPickerKey = null"
                      >
                        <AppIcon :icon="ACTION_ICONS.googleCalendar" :size="14" group="actions" /> Google Kalender
                      </a>
                      <a
                        :href="outlookCalendarHref(calendarEventFromEntry(entry))"
                        target="_blank"
                        rel="noopener"
                        @click="calendarPickerKey = null"
                      >
                        <AppIcon :icon="FORM_FIELD_ICONS.email" :size="14" group="formFields" /> Outlook
                      </a>
                      <button type="button" @click="downloadIcsForEntry(entry)">
                        <AppIcon :icon="ACTION_ICONS.android" :size="14" group="actions" /> Android
                      </button>
                    </div>
                  </template>
                </Teleport>
              </div>
              <!-- Architekturregel: Fremdobjekte (Urlaub-Stammdaten, ToDos, Reise-Einträge) sind hier
                   nur lesend/verknüpfend darstellbar – Bearbeitung passiert in der Ursprungssicht.
                   Mit einem Spot/einer Tour verknüpfte Termine sind dagegen ganz normale, editierbare
                   Termine (kind bleibt 'schedule') – Klick auf die Karte öffnet für sie wie für jeden
                   anderen Termin den Anzeige-Dialog (inkl. Löschen-Button dort), kein eigener
                   Schnell-Entfernen-Button hier nötig. -->
            </div>
          </li>
        </template>
        <li v-if="!dayEntries.length" key="empty" class="empty">Noch keine Termine an diesem Tag.</li>
      </TransitionGroup>
    </div>

    <Modal
      :model-value="showAddForm"
      title="Termin anlegen"
      @update:model-value="(v) => !v && closeAddForm()"
    >
      <form class="edit-form" @submit.prevent="addItem">
        <FormField icon="title" label="Titel">
          <input v-model="newTitle" type="text" placeholder="Titel" required />
        </FormField>
        <FormField icon="date" label="Startdatum">
          <input v-model="newStartDate" type="date" required />
        </FormField>
        <FormField icon="date" label="Enddatum">
          <input v-model="newEndDate" type="date" :min="newStartDate || undefined" />
        </FormField>
        <FormField icon="time" label="Startzeit">
          <input v-model="newTime" type="time" />
        </FormField>
        <FormField icon="time" label="Enduhrzeit">
          <input v-model="newEndTime" type="time" />
        </FormField>
        <FormField icon="link" label="Verknüpft">
          <select v-model="newLinkKey">
            <option value="">🔗 Kein Spot/keine Tour verknüpft</option>
            <optgroup label="Spots" v-if="spotsStore.spots.length">
              <option v-for="s in spotsStore.spots" :key="`spot:${s.id}`" :value="`spot:${s.id}`">{{ s.title }}</option>
            </optgroup>
            <optgroup label="Touren" v-if="excursionsStore.excursions.length">
              <option v-for="e in excursionsStore.excursions" :key="`idea:${e.id}`" :value="`idea:${e.id}`">{{ e.title }}</option>
            </optgroup>
          </select>
        </FormField>
        <template v-if="!newLinkKey">
          <FormField icon="location" label="Ort">
            <Combobox v-model="newLocation" :options="placeNames" placeholder="Ort (optional)" />
          </FormField>
          <FormField icon="maps" label="Maps-Link">
            <input v-model="newMapsLink" type="url" placeholder="Maps-Link (Google/Apple) (optional)" />
          </FormField>
        </template>
        <FormField icon="note" label="Notiz">
          <input v-model="newNote" type="text" placeholder="Notiz (optional)" />
        </FormField>
        <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
        <button type="submit">Hinzufügen</button>
      </form>
    </Modal>

    <Modal
      :model-value="editingItem !== null"
      title="Termin bearbeiten"
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Titel">
          <input v-model="editForm.title" type="text" placeholder="Titel" required />
        </FormField>
        <FormField icon="date" label="Enddatum">
          <input v-model="editForm.endDate" type="date" :min="editingItem?.date" />
        </FormField>
        <FormField icon="time" label="Startzeit">
          <input v-model="editForm.time" type="time" />
        </FormField>
        <FormField icon="time" label="Enduhrzeit">
          <input v-model="editForm.endTime" type="time" />
        </FormField>
        <FormField icon="link" label="Verknüpft">
          <select v-model="editForm.linkKey">
            <option value="">🔗 Kein Spot/keine Tour verknüpft</option>
            <optgroup label="Spots" v-if="spotsStore.spots.length">
              <option v-for="s in spotsStore.spots" :key="`spot:${s.id}`" :value="`spot:${s.id}`">{{ s.title }}</option>
            </optgroup>
            <optgroup label="Touren" v-if="excursionsStore.excursions.length">
              <option v-for="e in excursionsStore.excursions" :key="`idea:${e.id}`" :value="`idea:${e.id}`">{{ e.title }}</option>
            </optgroup>
          </select>
        </FormField>
        <template v-if="!editForm.linkKey">
          <FormField icon="location" label="Ort">
            <Combobox v-model="editForm.location" :options="placeNames" placeholder="Ort (optional)" />
          </FormField>
          <FormField icon="maps" label="Maps-Link">
            <input v-model="editForm.mapsLink" type="url" placeholder="Maps-Link (Google/Apple) (optional)" />
          </FormField>
        </template>
        <FormField icon="note" label="Notiz">
          <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        </FormField>
        <FileAttachments v-if="editingItem" domain="schedule" :entity-id="editingItem.id" />
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>

    <DetailModal
      :model-value="viewingItem !== null"
      @update:model-value="(v) => !v && (viewingItem = null)"
      :title="viewingItem?.title ?? ''"
      :placeholder-icon="viewingEntry ? (viewingEntry.iconDef ?? SCHEDULE_CATEGORY_META[viewingEntry.category].tabler) : undefined"
      @edit="editViewingItem"
    >
      <p v-if="linkedTitleFor(viewingEntry)" class="detail-row">
        <span class="detail-label">Verknüpft</span>
        <AppIcon :icon="viewingEntry?.iconDef ?? SECTION_ICON_DEFS.excursions" :size="15" group="categories" />
        {{ linkedTitleFor(viewingEntry) }}
      </p>
      <p v-if="viewingItem?.time" class="detail-row">
        <span class="detail-label">Zeit</span>
        <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" /> {{ viewingItem.time }}<template v-if="viewingItem.end_time"> – {{ viewingItem.end_time }}</template>
      </p>
      <p v-if="viewingItem?.end_date && viewingItem.end_date !== viewingItem.date" class="detail-row">
        <span class="detail-label">Zeitraum</span>
        <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" /> {{ formatDate(viewingItem.date) }} – {{ formatDate(viewingItem.end_date) }}
      </p>
      <p v-if="!linkedTitleFor(viewingEntry) && viewingItem?.location" class="detail-row">
        <span class="detail-label">Ort</span>
        <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" /> {{ viewingItem.location }}
      </p>
      <div v-if="viewingItem?.note" class="detail-row note">{{ viewingItem.note }}</div>
      <FileAttachments v-if="viewingItem" domain="schedule" :entity-id="viewingItem.id" :editable="false" />
      <div class="detail-actions">
        <MapsAppPicker
          v-if="viewingItem?.lat != null && viewingItem?.lng != null"
          :lat="viewingItem.lat"
          :lng="viewingItem.lng"
          :title="viewingItem.title"
          :maps-link="viewingItem.maps_link"
        />
        <DeleteButton small @click="deleteViewingItem" />
      </div>
    </DetailModal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.calendar-drawer-content {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Als eigenständige Seite (Route /calendar) übernimmt kein Drawer-Panel mehr das Scrollen/die
   Höhenbegrenzung – braucht deshalb wie jede andere Seite unten Platz für eine unten fixierte
   mobile NavBar (siehe .page-Pendant in style.css, inkl. des zusätzlichen --space-4 dort für einen
   sichtbaren Mindestabstand, den --navbar-bottom-offset allein nicht liefert). */
.calendar-drawer-content.standalone {
  padding-bottom: calc(var(--navbar-bottom-offset, 88px) + var(--space-4));
}

.calendar-drawer-content h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

.weeks {
  padding: var(--space-2);
}

.pending-schedule-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-highlight);
  border: 1px solid var(--color-highlight-border);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.pending-schedule-banner button {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 0.82rem;
}

.calendar-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.granularity-row {
  display: flex;
  justify-content: center;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.page-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
  border-radius: 50%;
  corner-shape: round;
  flex-shrink: 0;
}

.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.range-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 100px;
  text-align: center;
}

.jump-row {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.day-detail-head {
  display: flex;
  justify-content: space-between;
  /* flex-start statt center: der Tagesname kann in der (ggf. schmal gezogenen) Kalender-Schublade
     auf mehrere Zeilen umbrechen ("Sonntag, 16. August") - bei center-Ausrichtung rückte der Button
     dadurch optisch bis auf wenige Pixel an die letzte umgebrochene Zeile heran, obwohl der
     horizontale gap eigentlich stimmt (Issue #69: "zu wenig Abstand zwischen Button und Text").
     flex-start hält den Button auf Höhe der ersten Zeile, mit klarem Abstand zu allen Zeilen
     darunter. */
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.day-detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.day-detail h3 {
  color: var(--color-primary-dark);
  margin-top: 0;
}

.acc-note {
  color: var(--color-accent-secondary);
  font-weight: 600;
  margin: 0 0 var(--space-2);
}

.day-weather-note {
  color: var(--color-text-muted);
  font-weight: 600;
  margin: 0 0 var(--space-2);
}

.items {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-left: 3px solid transparent;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.item.clickable {
  cursor: pointer;
}

.item.clickable:hover {
  background: var(--color-hover);
}

.category-icon {
  margin-right: 4px;
}

.title {
  margin-left: var(--space-2);
}

.location {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.note {
  margin: 4px 0 0;
  font-size: 0.9rem;
}

.empty {
  padding: var(--space-2);
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.add-form input[type='text'] {
  flex: 1;
  min-width: 140px;
}

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
}

.calendar-btn {
  padding: 4px 8px;
  font-size: 0.9rem;
  line-height: 1;
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.picker-menu {
  position: fixed;
  min-width: 180px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu a,
.picker-menu button {
  padding: 6px 8px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  width: 100%;
}

.picker-menu a:hover,
.picker-menu button:hover {
  background: var(--color-hover);
}

.edit-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form input[type='text'],
.edit-form .form-field {
  flex: 1;
  min-width: 140px;
}

/* Ohne eigenes FormField-Label würde der Absenden-Button, sobald er in derselben umgebrochenen
   Flex-Zeile wie ein FormField landet, vom Flex-Default align-items:stretch auf dessen (größere)
   Höhe gezogen (Konsistenz-Prinzip, siehe DESIGN.md). flex-basis:100% erzwingt stattdessen immer
   eine eigene, volle Zeile - Absenden-Button bekommt so app-weit dieselbe, natürliche Höhe. */
.edit-form button[type='submit'] {
  flex: 1 1 100%;
}

</style>
