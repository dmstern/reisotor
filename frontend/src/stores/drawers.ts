import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const CALENDAR_OPEN_KEY = 'reisotor-drawer-calendar-open';
const MAP_OPEN_KEY = 'reisotor-drawer-map-open';
const CALENDAR_WIDTH_KEY = 'reisotor-drawer-calendar-width';
const MAP_WIDTH_KEY = 'reisotor-drawer-map-width';

export const DEFAULT_DRAWER_WIDTH = 360;
export const MIN_DRAWER_WIDTH = 280;
export const MAX_DRAWER_WIDTH = 640;

function isDesktop() {
  return window.matchMedia('(min-width: 800px)').matches;
}

function loadOpen(key: string): boolean {
  const stored = localStorage.getItem(key);
  if (stored !== null) return stored === 'true';
  // Noch keine explizite Präferenz gespeichert: auf Desktop standardmäßig ausgeklappt (genug
  // Platz), mobil zu (Platz ist dort knapp, Schublade würde sonst direkt den Inhalt verdecken).
  return isDesktop();
}

function loadWidth(key: string): number {
  const stored = Number(localStorage.getItem(key));
  return Number.isFinite(stored) && stored >= MIN_DRAWER_WIDTH && stored <= MAX_DRAWER_WIDTH
    ? stored
    : DEFAULT_DRAWER_WIDTH;
}

// Kalender und Karte sind keine Nav-Seiten mehr, sondern global gemountete, in der Breite
// verstellbare Schubladen (App.vue). Auf-/Zu-Zustand und Breite werden hier zentral gehalten
// (persistiert in localStorage), damit z. B. das Dashboard oder "Auf Karte anzeigen"-Buttons aus
// beliebigen Sichten die Schublade öffnen können, ohne eine Route zu wechseln.
export const useDrawersStore = defineStore('drawers', () => {
  const calendarOpen = ref(loadOpen(CALENDAR_OPEN_KEY));
  const mapOpen = ref(loadOpen(MAP_OPEN_KEY));
  const mapFocusKey = ref<string | null>(null);
  // Ausflug, dessen Stationen gerade isoliert auf der Karte gezeigt werden (alle anderen Spots
  // ausgeblendet, siehe MapView.vue) – exklusiv zu mapFocusKey, daher setzt jede der beiden
  // Focus-Arten die jeweils andere zurück.
  const mapFocusExcursionId = ref<number | null>(null);
  // Kalendertag, dessen Ausflüge (auch mehrere, z. B. mehrere spontan eingeplante Einzel-Spots)
  // zusammen als eine Route auf der Karte gezeigt werden – ebenfalls exklusiv zu den beiden
  // anderen Fokus-Arten (siehe focusMapOnDate).
  const mapFocusDate = ref<string | null>(null);
  const calendarWidth = ref(loadWidth(CALENDAR_WIDTH_KEY));
  const mapWidth = ref(loadWidth(MAP_WIDTH_KEY));
  // Welche Schublade (falls überhaupt) gerade als Vollbild-Overlay maximiert ist (Drawer.vue).
  // Zentral statt lokal im Drawer, da eine maximierte Schublade die jeweils andere automatisch
  // zuklappen muss – bewusst nicht in localStorage persistiert (flüchtiger UI-Zustand).
  const maximizedSide = ref<'left' | 'right' | null>(null);
  // Zähler statt Boolean: MapView.vue hält Unterkunft/Reise/Spots in eigenem lokalem State (keine
  // gemeinsame Pinia-Quelle) und lädt deshalb nicht automatisch neu, wenn irgendwo sonst in der App
  // ein Ort mit Maps-Link angelegt/bearbeitet wird. touchLocations() signalisiert genau das – ein
  // Zähler statt Boolean, damit auch zwei schnell aufeinanderfolgende Änderungen zuverlässig je
  // einen watch()-Trigger auslösen (bei einem Boolean könnte derselbe Wert zweimal gesetzt werden).
  const locationsVersion = ref(0);

  function touchLocations() {
    locationsVersion.value++;
  }

  watch(calendarOpen, (v) => localStorage.setItem(CALENDAR_OPEN_KEY, String(v)));
  watch(mapOpen, (v) => localStorage.setItem(MAP_OPEN_KEY, String(v)));
  watch(calendarWidth, (v) => localStorage.setItem(CALENDAR_WIDTH_KEY, String(v)));
  watch(mapWidth, (v) => localStorage.setItem(MAP_WIDTH_KEY, String(v)));

  function toggleCalendar() {
    calendarOpen.value = !calendarOpen.value;
  }

  function toggleMap() {
    mapOpen.value = !mapOpen.value;
  }

  function openMapAt(key: string) {
    mapFocusKey.value = key;
    mapFocusExcursionId.value = null;
    mapFocusDate.value = null;
    mapOpen.value = true;
  }

  function openMapForExcursion(excursionId: number) {
    mapFocusExcursionId.value = excursionId;
    mapFocusKey.value = null;
    mapFocusDate.value = null;
    mapOpen.value = true;
  }

  // Zeigt alle Ausflüge eines Tages zusammen auf der Karte (gestrichelte Route über alle
  // Stationen) – z. B. wenn an einem Tag mehrere Spots spontan eingeplant wurden, ohne dass sie
  // zu einem gemeinsamen Ausflug zusammengefasst sind. Aufruf aus ScheduleView.vue.
  function focusMapOnDate(date: string) {
    mapFocusDate.value = date;
    mapFocusKey.value = null;
    mapFocusExcursionId.value = null;
    mapOpen.value = true;
  }

  // Maximieren einer Schublade klappt die jeweils andere zu (nur eine Schublade kann gleichzeitig
  // vollflächig sein) – die Kalender-Schublade liegt links, die Karten-Schublade rechts.
  function maximize(side: 'left' | 'right') {
    maximizedSide.value = side;
    if (side === 'left') {
      mapOpen.value = false;
    } else {
      calendarOpen.value = false;
    }
  }

  function restoreMaximized() {
    maximizedSide.value = null;
  }

  return {
    calendarOpen,
    mapOpen,
    mapFocusKey,
    mapFocusExcursionId,
    mapFocusDate,
    calendarWidth,
    mapWidth,
    maximizedSide,
    locationsVersion,
    toggleCalendar,
    toggleMap,
    openMapAt,
    openMapForExcursion,
    focusMapOnDate,
    maximize,
    restoreMaximized,
    touchLocations,
  };
});
