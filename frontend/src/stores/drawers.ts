import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import router from '../router';

const CALENDAR_OPEN_KEY = 'reisotor-drawer-calendar-open';
const CALENDAR_WIDTH_KEY = 'reisotor-drawer-calendar-width';

export const DEFAULT_DRAWER_WIDTH = 360;
export const MIN_DRAWER_WIDTH = 280;
export const MAX_DRAWER_WIDTH = 860;
export const MAX_DRAWER_WIDTH_COMPACT = 320;

export function getMaxDrawerWidth(): number {
  if (typeof window !== 'undefined' && window.innerWidth < 1280) {
    return MAX_DRAWER_WIDTH_COMPACT;
  }
  return MAX_DRAWER_WIDTH;
}

function isDesktop() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 1024px)').matches
    : false;
}

function loadOpen(key: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  const stored = localStorage.getItem(key);
  if (stored !== null) return stored === 'true';
  // Noch keine explizite Präferenz gespeichert: auf Desktop standardmäßig ausgeklappt (genug
  // Platz), mobil zu (Platz ist dort knapp, Schublade würde sonst direkt den Inhalt verdecken).
  return isDesktop();
}

function loadWidth(key: string): number {
  if (typeof localStorage === 'undefined') return DEFAULT_DRAWER_WIDTH;
  const stored = Number(localStorage.getItem(key));
  const maxAllowed = getMaxDrawerWidth();
  return Number.isFinite(stored) && stored >= MIN_DRAWER_WIDTH && stored <= MAX_DRAWER_WIDTH
    ? Math.min(stored, maxAllowed)
    : Math.min(DEFAULT_DRAWER_WIDTH, maxAllowed);
}

// Kalender ist keine Nav-Seite mehr, sondern eine global gemountete, in der Breite verstellbare
// Schublade (App.vue) – die Karte (inkl. Touren, seit deren Verschmelzung in die Spots-Sicht) ist
// dagegen fest in die Karte-Hauptsicht (ExcursionsView.vue, Route /excursions) eingebettet, kein
// Schubladen-Toggle mehr nötig. Auf-/Zu-Zustand und Breite der Kalender-Schublade werden hier
// zentral gehalten (persistiert in localStorage), damit z. B. das Dashboard oder
// "Auf Karte anzeigen"-Buttons aus beliebigen Sichten sie öffnen können, ohne die Route zu wechseln.
export interface MapFocusGalleryItem {
  id?: number;
  url: string;
  original_name?: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  metadata?: unknown;
}

export interface MapFocusGallery {
  attachments: MapFocusGalleryItem[];
  initialIndex: number;
}

export const useDrawersStore = defineStore('drawers', () => {
  const calendarOpen = ref(loadOpen(CALENDAR_OPEN_KEY));
  const mapFocusKey = ref<string | null>(null);
  // Ausflug, dessen Stationen gerade isoliert auf der Karte gezeigt werden (alle anderen Spots
  // ausgeblendet, siehe TripMap.vue) – exklusiv zu mapFocusKey, daher setzt jede der beiden
  // Focus-Arten die jeweils andere zurück.
  const mapFocusExcursionId = ref<number | null>(null);
  // Kalendertag, dessen Ausflüge (auch mehrere, z. B. mehrere spontan eingeplante Einzel-Spots)
  // zusammen als eine Route auf der Karte gezeigt werden – ebenfalls exklusiv zu den beiden
  // anderen Fokus-Arten (siehe focusMapOnDate).
  const mapFocusDate = ref<string | null>(null);
  // Standort-Aufzeichnung, deren aufgezeichnete Route + Zeit-Slider gerade auf der Karte gezeigt
  // wird (ExcursionsView.vue's Aufzeichnungen-Liste) – exklusiv zu den drei Fokus-Arten oben,
  // gleiches Muster wie mapFocusExcursionId.
  const mapFocusTrackId = ref<number | null>(null);
  // Beliebiger Standort (z. B. EXIF-Geolocation eines Fotos), der auf der Karte fokussiert wird.
  const mapFocusLocation = ref<{
    lat: number;
    lng: number;
    title?: string;
    imageUrl?: string;
    dateBadge?: string;
    gallery?: MapFocusGallery;
  } | null>(null);
  // Zeigt alle Fotos mit Geolocation im gesamten Urlaub auf einmal auf der Karte an.
  const mapFocusAllPhotos = ref(false);
  const calendarWidth = ref(loadWidth(CALENDAR_WIDTH_KEY));
  // Ob die Kalender-Schublade gerade als Vollbild-Overlay maximiert ist (Drawer.vue). Zentral statt
  // lokal im Drawer gehalten (bewusst nicht in localStorage persistiert, flüchtiger UI-Zustand) –
  // seit der Verschmelzung der Touren-Schublade in die Spots-Sicht gibt es nur noch diese eine
  // Schublade, 'right' bleibt als Wert dadurch ungenutzt, der Typ blieb aber generisch (Drawer.vue
  // ist weiterhin eine für beide Seiten wiederverwendbare Komponente).
  const maximizedSide = ref<'left' | 'right' | null>(null);
  // Zähler statt Boolean: Unterkunft/Reise/Spots liegen nicht in einer gemeinsamen Pinia-Quelle
  // und laden deshalb nicht automatisch neu, wenn irgendwo sonst in der App ein Ort mit Maps-Link
  // angelegt/bearbeitet wird. touchLocations() signalisiert genau das – ein Zähler statt Boolean,
  // damit auch zwei schnell aufeinanderfolgende Änderungen zuverlässig je einen watch()-Trigger
  const locationsVersion = ref(0);
  // Spot-ID, die gerade per "Tour zuordnen"-Anfasser gezogen wird (#drag). Ermöglicht Tour-Karten,
  // gezielt als Drop-Ziel zu leuchten, wenn der Spot dort noch nicht enthalten ist.
  const draggingTourSpotId = ref<number | null>(null);

  function touchLocations() {
    locationsVersion.value++;
  }

  // Kalender ist auf Desktop eine globale Schublade, auf Mobil dagegen eine eigenständige Seite
  // (/calendar – siehe router/index.ts, dieselbe Komponente wie in der Schublade). Jede Stelle in
  // der App, die die "Kalender-Schublade öffnen" will (Dashboard-Kachel, ExcursionCard/SpotCard-
  // Anfasser, TripMap-Detailsprünge, …), ruft deshalb diese Funktion statt direkt calendarOpen zu
  // setzen – so bleibt die Desktop/Mobil-Weiche an einer einzigen Stelle statt an jedem einzelnen
  // Aufrufort dupliziert.
  function openCalendar() {
    if (isDesktop()) calendarOpen.value = true;
    else router.push('/calendar');
  }

  // Klick-Alternative zum Drag-Einplanen (ExcursionCard.vue/SpotCard.vue's 📅-Anfasser): statt den
  // Ausflug/Spot auf einen Kalendertag zu ziehen, tippt man den Anfasser einmal an (öffnet die
  // Kalender-Schublade + merkt sich, was eingeplant werden soll) und tippt danach einen Tag an
  // (ScheduleView.vue's selectDay() löst das auf und ruft clearPendingSchedule() auf).
  // mode 'confirm-done' (#106): der Anfasser wurde nicht zum spontanen Einplanen genutzt, sondern
  // um beim Markieren als "gemacht" den Besuchs-/Erledigungstag zu bestätigen (ScheduleView.vue's
  // selectDay() setzt danach zusätzlich den "gemacht"-Status) - eigener Banner-Hinweistext und
  // Rücksprung zur Karte gelten für beide Modi gleich (siehe returnToCard in ScheduleView.vue).
  const pendingSchedule = ref<{
    kind: 'excursion' | 'spot';
    id: number;
    mode: 'plan' | 'confirm-done';
  } | null>(null);

  function startPendingSchedule(
    kind: 'excursion' | 'spot',
    id: number,
    mode: 'plan' | 'confirm-done' = 'plan'
  ) {
    pendingSchedule.value = { kind, id, mode };
    openCalendar();
  }

  function clearPendingSchedule() {
    pendingSchedule.value = null;
  }

  watch(calendarOpen, (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CALENDAR_OPEN_KEY, String(v));
  });
  watch(calendarWidth, (v) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CALENDAR_WIDTH_KEY, String(v));
  });

  // Mobil ist eine offene Schublade vollflächig und scrollt selbst (siehe Drawer.vue) – ohne diese
  // Sperre könnte die dahinterliegende Seite gleichzeitig mitscrollen (zwei übereinanderliegende
  // Scroll-Bereiche, verwirrend/ruckelig). Auf Desktop ist eine Schublade nur ein schmales
  // Seitenpanel neben dem weiterhin normal nutzbaren Hauptinhalt, daher dort keine Sperre.
  const anyOpen = computed(() => calendarOpen.value);
  watch(
    anyOpen,
    (open) => {
      if (typeof document !== 'undefined' && !isDesktop())
        document.body.style.overflow = open ? 'hidden' : '';
    },
    { immediate: true }
  );

  // Springt zur Karte-Hauptsicht, falls man gerade woanders ist (z. B. "Auf Karte anzeigen" aus
  // TravelSection.vue/ExcursionsView.vue) – ein Push auf die bereits aktive Route würde
  // vue-router sonst unnötig (harmlos, aber unsauber) erneut auflösen lassen.
  function ensureMapRoute() {
    if (router.currentRoute.value.name !== 'excursions') router.push('/excursions');
  }

  const focusVersion = ref(0);

  function triggerFocusChange() {
    focusVersion.value++;
  }

  function openMapAt(key: string) {
    mapFocusKey.value = key;
    mapFocusExcursionId.value = null;
    mapFocusDate.value = null;
    mapFocusTrackId.value = null;
    mapFocusLocation.value = null;
    mapFocusAllPhotos.value = false;
    triggerFocusChange();
    ensureMapRoute();
  }

  function openMapForExcursion(excursionId: number) {
    mapFocusExcursionId.value = excursionId;
    mapFocusKey.value = null;
    mapFocusDate.value = null;
    mapFocusTrackId.value = null;
    mapFocusLocation.value = null;
    mapFocusAllPhotos.value = false;
    triggerFocusChange();
    ensureMapRoute();
  }

  // Zeigt alle Ausflüge eines Tages zusammen auf der Karte (gestrichelte Route über alle
  // Stationen) – z. B. wenn an einem Tag mehrere Spots spontan eingeplant wurden, ohne dass sie
  // zu einem gemeinsamen Ausflug zusammengefasst sind. Aufruf aus ScheduleView.vue.
  function focusMapOnDate(date: string) {
    mapFocusDate.value = date;
    mapFocusKey.value = null;
    mapFocusExcursionId.value = null;
    mapFocusTrackId.value = null;
    mapFocusLocation.value = null;
    mapFocusAllPhotos.value = false;
    triggerFocusChange();
    ensureMapRoute();
  }

  // Zeigt eine aufgezeichnete Route (ExcursionsView.vue's Aufzeichnungen-Liste) auf der Karte,
  // inkl. Zeit-Slider/Playback (TripMap.vue) – gleiches Muster wie openMapForExcursion.
  function openMapForTrack(trackId: number) {
    mapFocusTrackId.value = trackId;
    mapFocusKey.value = null;
    mapFocusExcursionId.value = null;
    mapFocusDate.value = null;
    mapFocusLocation.value = null;
    mapFocusAllPhotos.value = false;
    triggerFocusChange();
    ensureMapRoute();
  }

  // Zeigt einen konkreten geografischen Ort (z. B. EXIF-Aufnahmeort eines Fotos) auf der Karte.
  // Optional kann die zugehörige Anhang-Galerie mitgegeben werden, damit ein Klick auf den Foto-Pin
  // auf der Karte die Galerie am selben Bild wieder öffnet.
  function openMapAtLocation(
    lat: number,
    lng: number,
    title?: string,
    imageUrl?: string,
    gallery?: MapFocusGallery,
    dateBadge?: string
  ) {
    mapFocusLocation.value = { lat, lng, title, imageUrl, gallery, dateBadge };
    mapFocusKey.value = 'photo-location';
    mapFocusExcursionId.value = null;
    mapFocusDate.value = null;
    mapFocusTrackId.value = null;
    mapFocusAllPhotos.value = false;
    triggerFocusChange();
    ensureMapRoute();
  }

  // Zeigt alle Fotos mit Geolocation im gesamten Urlaub auf einmal auf der Karte an.
  function openMapForAllPhotos() {
    mapFocusAllPhotos.value = true;
    mapFocusKey.value = null;
    mapFocusExcursionId.value = null;
    mapFocusDate.value = null;
    mapFocusTrackId.value = null;
    mapFocusLocation.value = null;
    triggerFocusChange();
    ensureMapRoute();
  }

  // Seit der Verschmelzung der Touren-Schublade in die Spots-Sicht gibt es nur noch die
  // Kalender-Schublade – "die jeweils andere zuklappen" gibt es dadurch nicht mehr zu tun, die
  // Funktion bleibt aber (samt generischem side-Parameter) bestehen, da Drawer.vue weiterhin eine
  // für beide Seiten wiederverwendbare Komponente ist.
  function maximize(side: 'left' | 'right') {
    maximizedSide.value = side;
  }

  function restoreMaximized() {
    maximizedSide.value = null;
  }

  return {
    calendarOpen,
    mapFocusKey,
    mapFocusExcursionId,
    mapFocusDate,
    mapFocusTrackId,
    mapFocusLocation,
    mapFocusAllPhotos,
    focusVersion,
    calendarWidth,
    maximizedSide,
    locationsVersion,
    draggingTourSpotId,
    pendingSchedule,
    openCalendar,
    openMapAt,
    openMapForExcursion,
    openMapForTrack,
    openMapAtLocation,
    openMapForAllPhotos,
    focusMapOnDate,
    maximize,
    restoreMaximized,
    touchLocations,
    startPendingSchedule,
    clearPendingSchedule,
  };
});
