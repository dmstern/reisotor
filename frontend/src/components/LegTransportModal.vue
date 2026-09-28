<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DirectionsResponse, ExcursionLeg, RouteResult, Spot, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Button from './primitives/Button.vue';
import Select from './primitives/Select.vue';
import Input from './primitives/Input.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import AppIcon from './AppIcon.vue';
import FileAttachments from './FileAttachments.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import LegMiniMap from './LegMiniMap.vue';
import Alert, { type AlertVariant } from './primitives/Alert.vue';
import { IconRoute2, IconLineDashed, IconLink, IconLinkOff, IconBolt } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import type { FormFieldIconKey } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIcon, travelTypeIconDef } from '../utils/travelTypeIcon';
import { spotCategoryMeta } from '../utils/spotCategory';
import { parseRouteGeometry } from '../utils/mapRoute';
import { api } from '../api/client';

const TRANSPORT_MODE_OPTIONS = [
  {
    value: 'zu Fuß',
    label: 'Zu Fuß',
    icon: travelTypeIconDef('zu Fuß'),
  },
  {
    value: 'Auto',
    label: 'Auto',
    icon: travelTypeIconDef('Auto'),
  },
  {
    value: 'Fahrrad',
    label: 'Fahrrad',
    icon: travelTypeIconDef('Fahrrad'),
  },
  {
    value: 'ÖPNV',
    label: 'ÖPNV',
    icon: travelTypeIconDef('ÖPNV'),
  },
];

const DEFAULT_TRANSIT_OPTIONS = [
  'Zug',
  'Bus',
  'Straßenbahn',
  'U-Bahn',
  'Fähre',
  'Flug',
  'Sonstiges',
];

type TransportCategory = 'zu Fuß' | 'Auto' | 'Fahrrad' | 'ÖPNV';

function getCategoryFromType(type?: string | null): TransportCategory {
  if (!type) return 'zu Fuß';
  const lower = type.trim().toLowerCase();
  if (lower === 'zu fuß' || lower === 'zu fuss' || lower === 'fuss' || lower === 'fuß') {
    return 'zu Fuß';
  }
  if (lower === 'auto' || lower === 'car') {
    return 'Auto';
  }
  if (lower === 'fahrrad' || lower === 'rad' || lower === 'bike') {
    return 'Fahrrad';
  }
  return 'ÖPNV';
}

function getDepartureLabel(type?: string | null): string {
  if (!type) return 'Abfahrt';
  const lower = type.trim().toLowerCase();
  if (
    lower === 'zu fuß' ||
    lower === 'zu fuss' ||
    lower === 'fuss' ||
    lower === 'fuß' ||
    lower === 'wandern' ||
    lower === 'walk'
  ) {
    return 'Losgehen';
  }
  if (lower === 'flug' || lower === 'flugzeug' || lower === 'flight' || lower === 'plane') {
    return 'Abflug';
  }
  if (
    lower === 'fähre' ||
    lower === 'faehre' ||
    lower === 'schiff' ||
    lower === 'boot' ||
    lower === 'ferry' ||
    lower === 'boat'
  ) {
    return 'Ablegen';
  }
  return 'Abfahrt';
}

interface ExtendedFieldsConfig {
  showsSeat: boolean;
  labels: {
    checkin: string;
    seat: string;
    luggage: string;
    ticketLink: string;
    amount: string;
    note: string;
  };
  placeholders: {
    checkin: string;
    seat: string;
    luggage: string;
    ticketLink: string;
    amount: string;
    note: string;
  };
  icons: {
    checkin: FormFieldIconKey;
    seat: FormFieldIconKey;
    luggage: FormFieldIconKey;
    ticketLink: FormFieldIconKey;
    amount: FormFieldIconKey;
    note: FormFieldIconKey;
  };
}

function getExtendedFieldsConfig(transportType?: string | null): ExtendedFieldsConfig {
  const type = (transportType || '').trim().toLowerCase();

  // 1. Zu Fuß / Wandern
  if (
    type === 'zu fuß' ||
    type === 'zu fuss' ||
    type === 'fuss' ||
    type === 'fuß' ||
    type === 'wandern' ||
    type === 'walk' ||
    type === 'spaziergang'
  ) {
    return {
      showsSeat: false,
      labels: {
        checkin: 'Treffpunkt / Startpunkt',
        seat: 'Sitzplatz / Rastplatz',
        luggage: 'Ausrüstung & Rucksack',
        ticketLink: 'Touren-Link / Wanderkarte',
        amount: 'Eintritt & Kosten (€)',
        note: 'Notiz zur Strecke',
      },
      placeholders: {
        checkin: 'z. B. Vor dem Haupteingang, Brunnen am Marktplatz',
        seat: 'z. B. Bank am Aussichtspunkt',
        luggage: 'z. B. Wanderschuhe, Regenjacke, 20L-Tagesrucksack',
        ticketLink: 'z. B. Komoot-Tour, AllTrails, Park-Webseite',
        amount: 'z. B. Nationalpark-Gebühr, Führung',
        note: 'z. B. Schöne Fotospots, steiler Anstieg, Einkehrmöglichkeit',
      },
      icons: {
        checkin: 'location',
        seat: 'note',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 2. Fahrrad
  if (
    type === 'fahrrad' ||
    type === 'rad' ||
    type === 'bike' ||
    type === 'e-bike' ||
    type === 'mountainbike'
  ) {
    return {
      showsSeat: false,
      labels: {
        checkin: 'Treffpunkt / Fahrradverleih',
        seat: 'Fahrrad / Rad-Nummer',
        luggage: 'Fahrrad-Typ & Ausrüstung',
        ticketLink: 'Routen-Link / Leihrad-App',
        amount: 'Leihgebühr & Kosten (€)',
        note: 'Notiz zur Radstrecke',
      },
      placeholders: {
        checkin: 'z. B. Radstation Gleis 1, Nextbike-Station Hafen',
        seat: 'z. B. Rad #42',
        luggage: 'z. B. E-Bike mit Packtaschen, Helm, Schloss',
        ticketLink: 'z. B. Komoot-Route, Nextbike-Buchung, Mietvertrag',
        amount: 'z. B. 15.00 für Leihrad oder Akku-Aufladung',
        note: 'z. B. Steile Steigung, Schotterweg, Schloss-Code',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 3. Auto / Taxi / Mietwagen / Carsharing
  if (
    type === 'auto' ||
    type === 'car' ||
    type === 'taxi' ||
    type === 'uber' ||
    type === 'mietwagen' ||
    type === 'carsharing'
  ) {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Treffpunkt / Abholort',
        seat: 'Fahrzeug / Fahrer:in',
        luggage: 'Kofferraum & Gepäck',
        ticketLink: 'Mietwagen-Link / Buchung',
        amount: 'Kosten (Maut, Sprit, Miete) (€)',
        note: 'Notiz zur Fahrt',
      },
      placeholders: {
        checkin: 'z. B. Mietwagen-Station Terminal 1, Hotelauffahrt',
        seat: 'z. B. Sixt Buchung XYZ, VW Golf, Fahrer:in Alice',
        luggage: 'z. B. 2 große Koffer im Kofferraum, Kindersitz',
        ticketLink: 'z. B. Buchungsbestätigung Mietwagen, Uber-Link',
        amount: 'z. B. 45.00 für Maut, Parkhaus oder Benzin',
        note: 'z. B. Parkhaus P2 reserviert, Umweltplakette beachten',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 4. Flug
  if (type === 'flug' || type === 'flugzeug' || type === 'flight' || type === 'plane') {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Terminal, Gate & Check-in',
        seat: 'Sitzplatz & Flugnummer',
        luggage: 'Aufgabe- & Handgepäck',
        ticketLink: 'Online-Check-in / Flug-Link',
        amount: 'Flugkosten (€)',
        note: 'Notiz zum Flug',
      },
      placeholders: {
        checkin: 'z. B. Terminal 2, Gate B14, 2 Std. vorher da sein',
        seat: 'z. B. LH 1234, Sitz 14A (Fenster)',
        luggage: 'z. B. 1x Koffer 23kg, Handgepäck-Trolley',
        ticketLink: 'z. B. Airline-Buchung, Bordkarte, Flugverfolgung',
        amount: 'z. B. 149.00',
        note: 'z. B. Buchungscode (PNR): ABCD12, Reisepass mitnehmen',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 5. Fähre / Schiff
  if (
    type === 'fähre' ||
    type === 'faehre' ||
    type === 'schiff' ||
    type === 'boot' ||
    type === 'ferry' ||
    type === 'boat'
  ) {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Pier, Anleger & Boarding',
        seat: 'Kabine / Deck / Sitzplatz',
        luggage: 'Fahrzeugmitnahme & Gepäck',
        ticketLink: 'Fähr-Ticket / Buchungslink',
        amount: 'Fahrtkosten / Überfahrt (€)',
        note: 'Notiz zur Überfahrt',
      },
      placeholders: {
        checkin: 'z. B. Pier 3, Terminal Ost, 30 Min. vor Ablegen',
        seat: 'z. B. Sonnendeck, Kabine 402, Pullmansitz 12',
        luggage: 'z. B. Auto auf Autodeck, 2 Reisetaschen',
        ticketLink: 'z. B. Buchungsbestätigung Fährlinie, E-Ticket',
        amount: 'z. B. 45.00',
        note: 'z. B. Buchungsnummer, Voucher am Schalter umtauschen',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 6. Bus
  if (type === 'bus' || type === 'fernbus' || type === 'reisebus') {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Haltestelle & Bussteig',
        seat: 'Sitzplatz',
        luggage: 'Freigepäck & Handgepäck',
        ticketLink: 'Bus-Ticket / Buchungslink',
        amount: 'Ticketkosten (€)',
        note: 'Notiz zur Busfahrt',
      },
      placeholders: {
        checkin: 'z. B. ZOB Steig 4, 15 Min. vor Abfahrt',
        seat: 'z. B. Reihe 5, Platz 18 (Fenster)',
        luggage: 'z. B. 1x Koffer im Laderaum, Handgepäck',
        ticketLink: 'z. B. FlixBus-Ticket, ÖPNV-Ticket',
        amount: 'z. B. 19.99',
        note: 'z. B. QR-Code in App bereithalten',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // 7. Zug / Bahn / Straßenbahn / U-Bahn / Standard-ÖPNV
  if (
    type === 'zug' ||
    type === 'bahn' ||
    type === 'straßenbahn' ||
    type === 'strassenbahn' ||
    type === 'tram' ||
    type === 'u-bahn' ||
    type === 'ubahn' ||
    type === 'metro' ||
    type === 'öpnv'
  ) {
    return {
      showsSeat: true,
      labels: {
        checkin: 'Gleis & Einstieg',
        seat: 'Wagen & Sitzplatz',
        luggage: 'Gepäck & Fahrradmitnahme',
        ticketLink: 'Ticket-Link / Online-Ticket',
        amount: 'Ticketkosten (€)',
        note: 'Notiz zur Teilstrecke',
      },
      placeholders: {
        checkin: 'z. B. Gleis 7 A-C, 10 Min. vorher am Bahnsteig',
        seat: 'z. B. Wagen 23, Platz 64 (Ruhebereich, Fenster)',
        luggage: 'z. B. Koffer im Gepäckregal, Fahrradstellplatz #3',
        ticketLink: 'z. B. Bahn.de-Buchung, ÖPNV-Ticket-App',
        amount: 'z. B. 49.90',
        note: 'z. B. Umstieg in Mannheim (nur 6 Min.!), Wagenreihung prüfen',
      },
      icons: {
        checkin: 'location',
        seat: 'category',
        luggage: 'note',
        ticketLink: 'link',
        amount: 'amount',
        note: 'note',
      },
    };
  }

  // Fallback (z. B. Sonstiges)
  return {
    showsSeat: true,
    labels: {
      checkin: 'Vorher da sein / Treffpunkt',
      seat: 'Sitzplatz',
      luggage: 'Gepäck',
      ticketLink: 'Buchungslink / Ticket-URL',
      amount: 'Ticketkosten (€)',
      note: 'Notiz zur Teilstrecke',
    },
    placeholders: {
      checkin: 'z. B. Treffpunkt oder Haltestelle',
      seat: 'z. B. Platznummer oder Bereich',
      luggage: 'z. B. Taschen, Koffer',
      ticketLink: 'https://...',
      amount: 'z. B. 25.00',
      note: 'Wichtige Hinweise zur Teilstrecke',
    },
    icons: {
      checkin: 'location',
      seat: 'category',
      luggage: 'note',
      ticketLink: 'link',
      amount: 'amount',
      note: 'note',
    },
  };
}

const props = defineProps<{
  modelValue: boolean;
  fromSpot?: Spot | null;
  toSpot?: Spot | null;
  leg?: ExcursionLeg | null;
  users: User[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', leg: ExcursionLeg): void;
  (e: 'delete'): void;
}>();

const isLegUploadingAttachments = ref(false);
const isCalculatingRoute = ref(false);
const routeCalculationError = ref<string | null>(null);
const calculatedDistanceMeters = ref<number | null>(null);
const calculatedDurationSeconds = ref<number | null>(null);
const routeGeometry = ref<string | null>(null);
const routingProfile = ref<string | null>(null);

const ROUTE_MODE_OPTIONS: {
  value: 'exact' | 'direct';
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'exact',
    label: 'Exakte Route',
    icon: { id: 'route-exact', emoji: '🗺️', outline: IconRoute2 },
  },
  {
    value: 'direct',
    label: 'Luftlinie',
    icon: { id: 'route-direct', emoji: '〰️', outline: IconLineDashed },
  },
];

const ROUTE_PREFERENCE_OPTIONS: {
  value: 'fastest' | 'shortest';
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'fastest',
    label: 'Schnellste Route',
    icon: ACTION_ICONS.duration,
  },
  {
    value: 'shortest',
    label: 'Kürzeste Strecke',
    icon: ACTION_ICONS.distance,
  },
];

const routePreference = ref<'fastest' | 'shortest'>('fastest');
const calculatedRoutes = ref<RouteResult[]>([]);
const selectedRouteIndex = ref<number>(0);

const fastestRouteIndex = computed(() => {
  if (!calculatedRoutes.value.length) return -1;
  let minDur = Infinity;
  let idx = 0;
  calculatedRoutes.value.forEach((r, i) => {
    if (r.duration_seconds < minDur) {
      minDur = r.duration_seconds;
      idx = i;
    }
  });
  return idx;
});

const shortestRouteIndex = computed(() => {
  if (!calculatedRoutes.value.length) return -1;
  let minDist = Infinity;
  let idx = 0;
  calculatedRoutes.value.forEach((r, i) => {
    if (r.distance_meters < minDist) {
      minDist = r.distance_meters;
      idx = i;
    }
  });
  return idx;
});

const suggestedRouteIndex = computed(() => {
  return routePreference.value === 'shortest' ? shortestRouteIndex.value : fastestRouteIndex.value;
});

const routeDisplayMode = ref<'exact' | 'direct'>('exact');
const cachedExactRoute = ref<{
  geometry: string | null;
  distance: number | null;
  duration: number | null;
  profile: string | null;
} | null>(null);

const hasExactRoute = computed(() => {
  return (
    (routeGeometry.value != null || cachedExactRoute.value?.geometry != null) &&
    (calculatedDistanceMeters.value != null || cachedExactRoute.value?.distance != null)
  );
});

const lastModifiedTimeField = ref<'departure' | 'arrival'>('departure');
const isTimeLinked = ref(true);
const isCalculatingDepartureSparkle = ref(false);
const isCalculatingArrivalSparkle = ref(false);

/**
 * Parst einen "HH:MM"-String in Minuten seit Mitternacht.
 * Gibt null zurück, wenn der String ungültig oder unvollständig ist.
 */
function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Formatiert Minuten seit Mitternacht in einen "HH:MM"-String.
 */
function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Berechnet Ankunftszeit: Abfahrt + Dauer
 */
function calcArrivalTime(departureStr: string, durationSeconds: number): string | null {
  const depMinutes = parseTimeToMinutes(departureStr);
  if (depMinutes == null) return null;
  const durMinutes = Math.round(durationSeconds / 60);
  return formatMinutesToTime(depMinutes + durMinutes);
}

/**
 * Berechnet Abfahrtszeit: Ankunft - Dauer
 */
function calcDepartureTime(arrivalStr: string, durationSeconds: number): string | null {
  const arrMinutes = parseTimeToMinutes(arrivalStr);
  if (arrMinutes == null) return null;
  const durMinutes = Math.round(durationSeconds / 60);
  return formatMinutesToTime(arrMinutes - durMinutes);
}

/**
 * Berechnet die Zeitspanne (in Minuten) zwischen Abfahrt und Ankunft.
 */
function calcElapsedMinutes(departureStr: string, arrivalStr: string): number | null {
  const dep = parseTimeToMinutes(departureStr);
  const arr = parseTimeToMinutes(arrivalStr);
  if (dep == null || arr == null) return null;
  return (((arr - dep) % 1440) + 1440) % 1440;
}

const activeDurationSeconds = computed<number | null>(() => {
  if (
    routeDisplayMode.value === 'exact' &&
    calculatedDurationSeconds.value != null &&
    calculatedDurationSeconds.value > 0
  ) {
    return calculatedDurationSeconds.value;
  }
  return null;
});

const canCalcArrival = computed(() => {
  return (
    activeDurationSeconds.value != null &&
    !!form.value.departure_time &&
    parseTimeToMinutes(form.value.departure_time) != null
  );
});

const canCalcDeparture = computed(() => {
  return (
    activeDurationSeconds.value != null &&
    !!form.value.arrival_time &&
    parseTimeToMinutes(form.value.arrival_time) != null
  );
});

const departureLabel = computed(() => getDepartureLabel(form.value.transport_type));
const extendedConfig = computed(() => getExtendedFieldsConfig(form.value.transport_type));
const showsSeatField = computed(
  () => extendedConfig.value.showsSeat || Boolean(form.value.seat?.trim())
);

const arrivalSparkleTitle = computed(() => {
  if (!canCalcArrival.value || !activeDurationSeconds.value) return 'Ankunftszeit berechnen';
  const durStr = formatDuration(activeDurationSeconds.value);
  const target = calcArrivalTime(form.value.departure_time, activeDurationSeconds.value);
  return target
    ? `Ankunftszeit aus ${departureLabel.value} berechnen (${form.value.departure_time} + ${durStr} = ${target})`
    : 'Ankunftszeit aus Reisedauer berechnen';
});

const departureSparkleTitle = computed(() => {
  if (!canCalcDeparture.value || !activeDurationSeconds.value) {
    return `${departureLabel.value} berechnen`;
  }
  const durStr = formatDuration(activeDurationSeconds.value);
  const target = calcDepartureTime(form.value.arrival_time, activeDurationSeconds.value);
  return target
    ? `${departureLabel.value} aus Wunschankunftszeit berechnen (${form.value.arrival_time} − ${durStr} = ${target})`
    : `${departureLabel.value} aus Reisedauer berechnen`;
});

function syncTimesWithDuration(durationSeconds?: number | null) {
  const dur = durationSeconds ?? activeDurationSeconds.value;
  if (!dur || dur <= 0) return;

  if (lastModifiedTimeField.value === 'arrival' && form.value.arrival_time) {
    const target = calcDepartureTime(form.value.arrival_time, dur);
    if (target) {
      form.value.departure_time = target;
    }
  } else if (form.value.departure_time) {
    const target = calcArrivalTime(form.value.departure_time, dur);
    if (target) {
      form.value.arrival_time = target;
    }
  } else if (form.value.arrival_time) {
    const target = calcDepartureTime(form.value.arrival_time, dur);
    if (target) {
      form.value.departure_time = target;
    }
  }
}

function onDepartureInput() {
  lastModifiedTimeField.value = 'departure';
  if (isTimeLinked.value && activeDurationSeconds.value) {
    const target = calcArrivalTime(form.value.departure_time, activeDurationSeconds.value);
    if (target) {
      form.value.arrival_time = target;
    }
  }
}

function onArrivalInput() {
  lastModifiedTimeField.value = 'arrival';
  if (isTimeLinked.value && activeDurationSeconds.value) {
    const target = calcDepartureTime(form.value.arrival_time, activeDurationSeconds.value);
    if (target) {
      form.value.departure_time = target;
    }
  }
}

function calcArrivalFromDeparture() {
  if (!form.value.departure_time || !activeDurationSeconds.value) return;
  const target = calcArrivalTime(form.value.departure_time, activeDurationSeconds.value);
  if (target) {
    form.value.arrival_time = target;
    lastModifiedTimeField.value = 'departure';
    isTimeLinked.value = true;
    isCalculatingArrivalSparkle.value = true;
    setTimeout(() => {
      isCalculatingArrivalSparkle.value = false;
    }, 600);
  }
}

function calcDepartureFromArrival() {
  if (!form.value.arrival_time || !activeDurationSeconds.value) return;
  const target = calcDepartureTime(form.value.arrival_time, activeDurationSeconds.value);
  if (target) {
    form.value.departure_time = target;
    lastModifiedTimeField.value = 'arrival';
    isTimeLinked.value = true;
    isCalculatingDepartureSparkle.value = true;
    setTimeout(() => {
      isCalculatingDepartureSparkle.value = false;
    }, 600);
  }
}

function toggleTimeLink() {
  if (!isTimeLinked.value) {
    if (activeDurationSeconds.value) {
      syncTimesWithDuration(activeDurationSeconds.value);
    }
    isTimeLinked.value = true;
  } else {
    isTimeLinked.value = false;
  }
}

function applySuggestedTime(field: 'departure' | 'arrival', target?: string | null) {
  if (!target) return;
  if (field === 'departure') {
    form.value.departure_time = target;
    lastModifiedTimeField.value = 'arrival';
  } else {
    form.value.arrival_time = target;
    lastModifiedTimeField.value = 'departure';
  }
  isTimeLinked.value = true;
}

interface TimeDurationStatus {
  type: 'matched' | 'mismatch' | 'suggest' | 'info';
  text: string;
  field?: 'departure' | 'arrival';
  target?: string | null;
  elapsedMinutes?: number;
  diffMinutes?: number;
  canToggleLink: boolean;
}

const timeDurationStatus = computed<TimeDurationStatus | null>(() => {
  const dep = form.value.departure_time;
  const arr = form.value.arrival_time;
  const durSec = activeDurationSeconds.value;

  if (!dep && !arr) return null;

  if (dep && arr) {
    const elapsedMins = calcElapsedMinutes(dep, arr);
    if (elapsedMins == null) return null;

    if (durSec != null) {
      const durMins = Math.round(durSec / 60);
      const diffMins = elapsedMins - durMins;

      if (Math.abs(diffMins) <= 1) {
        return {
          type: 'matched',
          text: `Dauer & Zeitspanne: ${formatDuration(durSec)}`,
          elapsedMinutes: elapsedMins,
          canToggleLink: true,
        };
      } else {
        return {
          type: 'mismatch',
          text: `Zeitfenster: ${formatDuration(elapsedMins * 60)} • Reisedauer: ${formatDuration(durSec)}`,
          elapsedMinutes: elapsedMins,
          diffMinutes: diffMins,
          canToggleLink: true,
        };
      }
    } else {
      return {
        type: 'info',
        text: `Reisedauer: ${formatDuration(elapsedMins * 60)}`,
        elapsedMinutes: elapsedMins,
        canToggleLink: false,
      };
    }
  }

  if (durSec != null) {
    if (dep && !arr) {
      const target = calcArrivalTime(dep, durSec);
      return {
        type: 'suggest',
        field: 'arrival',
        text: `Ankunft bei ${formatDuration(durSec)} Reisedauer: ${target}`,
        target,
        canToggleLink: false,
      };
    }
    if (arr && !dep) {
      const target = calcDepartureTime(arr, durSec);
      return {
        type: 'suggest',
        field: 'departure',
        text: `${departureLabel.value} für Ankunft um ${arr} (${formatDuration(durSec)}): ${target}`,
        target,
        canToggleLink: false,
      };
    }
  }

  return null;
});

const timeLinkedIconDef: IconDef = {
  id: 'link',
  emoji: '🔗',
  outline: IconLink,
};

const timeUnlinkedIconDef: IconDef = {
  id: 'link-off',
  emoji: '🔓',
  outline: IconLinkOff,
};

const routeHeadingIconDef: IconDef = {
  id: 'route-2',
  emoji: '🗺️',
  outline: IconRoute2,
};

const fastestRouteIconDef: IconDef = {
  id: 'bolt',
  emoji: '⚡',
  outline: IconBolt,
};

const alertVariantForStatus = computed<AlertVariant>(() => {
  if (!timeDurationStatus.value) return 'neutral';
  switch (timeDurationStatus.value.type) {
    case 'mismatch':
      return 'warning';
    case 'suggest':
      return 'info';
    case 'matched':
      return 'success';
    case 'info':
    default:
      return 'neutral';
  }
});

const alertIconForStatus = computed<IconDef | undefined>(() => {
  if (!timeDurationStatus.value) return undefined;
  switch (timeDurationStatus.value.type) {
    case 'mismatch':
      return ACTION_ICONS.warning;
    case 'suggest':
      return ACTION_ICONS.sparkles;
    case 'matched':
      return ACTION_ICONS.done;
    case 'info':
      return ACTION_ICONS.duration;
    default:
      return undefined;
  }
});

function selectRoute(idx: number) {
  if (!calculatedRoutes.value[idx]) return;
  selectedRouteIndex.value = idx;
  const selected = calculatedRoutes.value[idx];
  calculatedDistanceMeters.value = selected.distance_meters;
  calculatedDurationSeconds.value = selected.duration_seconds;
  routeGeometry.value = JSON.stringify(selected.coordinates);
  routingProfile.value = selected.profile;
  cachedExactRoute.value = {
    geometry: JSON.stringify(selected.coordinates),
    distance: selected.distance_meters,
    duration: selected.duration_seconds,
    profile: selected.profile,
  };
  routeDisplayMode.value = 'exact';
  if (isTimeLinked.value || !form.value.arrival_time || !form.value.departure_time) {
    syncTimesWithDuration(selected.duration_seconds);
  }
}

function onPreferenceToggle(val: string) {
  const pref = val as 'fastest' | 'shortest';
  routePreference.value = pref;
  if (calculatedRoutes.value.length > 1) {
    const targetIdx = pref === 'shortest' ? shortestRouteIndex.value : fastestRouteIndex.value;
    if (targetIdx >= 0) {
      selectRoute(targetIdx);
    }
  }
}

function onRouteModeChange(val: string) {
  routeDisplayMode.value = val as 'exact' | 'direct';
  routeCalculationError.value = null;
  if (val === 'exact' && cachedExactRoute.value) {
    routeGeometry.value = cachedExactRoute.value.geometry;
    calculatedDistanceMeters.value = cachedExactRoute.value.distance;
    calculatedDurationSeconds.value = cachedExactRoute.value.duration;
    routingProfile.value = cachedExactRoute.value.profile;
  }
}

function resetToDirectLine() {
  routeGeometry.value = null;
  calculatedDistanceMeters.value = null;
  calculatedDurationSeconds.value = null;
  routingProfile.value = null;
  cachedExactRoute.value = null;
  calculatedRoutes.value = [];
  selectedRouteIndex.value = 0;
  routeDisplayMode.value = 'exact';
  routeCalculationError.value = null;
}

function formatDistance(meters?: number | null): string {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m`;
  const km = (meters / 1000).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km} km`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} Min.`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
}

function formatDiffDuration(diffSeconds: number): string {
  if (diffSeconds < 60) return '< 1 Min.';
  return formatDuration(diffSeconds);
}

const transportCategory = ref<TransportCategory>('zu Fuß');
const selectedTransitType = ref('Zug');

const transitOptions = computed(() => {
  const current = form.value.transport_type;
  if (
    current &&
    !['zu Fuß', 'Zu Fuß', 'Auto', 'Fahrrad'].includes(current) &&
    !DEFAULT_TRANSIT_OPTIONS.includes(current)
  ) {
    return [...DEFAULT_TRANSIT_OPTIONS, current];
  }
  return DEFAULT_TRANSIT_OPTIONS;
});

function onCategorySelect(cat: string) {
  transportCategory.value = cat as TransportCategory;
  if (cat === 'ÖPNV') {
    form.value.transport_type = selectedTransitType.value || 'Zug';
  } else {
    form.value.transport_type = cat;
  }
  routeCalculationError.value = null;
}

function onTransitSelect(val: string) {
  selectedTransitType.value = val;
  if (transportCategory.value === 'ÖPNV') {
    form.value.transport_type = val;
  }
}

const form = ref({
  transport_type: 'zu Fuß',
  departure_time: '',
  arrival_time: '',
  checkin_info: '',
  seat: '',
  luggage: '',
  ticket_link: '',
  note: '',
  amount: '',
  paid_by_user_id: '',
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    routeCalculationError.value = null;
    if (props.leg) {
      const initialType = props.leg.transport_type || 'zu Fuß';
      const cat = getCategoryFromType(initialType);
      transportCategory.value = cat;
      if (cat === 'ÖPNV') {
        selectedTransitType.value = initialType === 'ÖPNV' ? 'Zug' : initialType;
        form.value.transport_type = selectedTransitType.value;
      } else {
        selectedTransitType.value = 'Zug';
        form.value.transport_type = cat;
      }
      form.value.departure_time = props.leg.departure_time || '';
      form.value.arrival_time = props.leg.arrival_time || '';
      if (form.value.arrival_time && !form.value.departure_time) {
        lastModifiedTimeField.value = 'arrival';
      } else {
        lastModifiedTimeField.value = 'departure';
      }
      if (form.value.departure_time && form.value.arrival_time && props.leg.duration_seconds) {
        const elapsed = calcElapsedMinutes(form.value.departure_time, form.value.arrival_time);
        const durMins = Math.round(props.leg.duration_seconds / 60);
        isTimeLinked.value = elapsed != null && Math.abs(elapsed - durMins) <= 1;
      } else {
        isTimeLinked.value = true;
      }
      form.value.checkin_info = props.leg.checkin_info || '';
      form.value.seat = props.leg.seat || '';
      form.value.luggage = props.leg.luggage || '';
      form.value.ticket_link = props.leg.ticket_link || '';
      form.value.note = props.leg.note || '';
      form.value.amount = props.leg.amount != null ? String(props.leg.amount) : '';
      form.value.paid_by_user_id =
        props.leg.paid_by_user_id != null ? String(props.leg.paid_by_user_id) : '';
      calculatedDistanceMeters.value = props.leg.distance_meters ?? null;
      calculatedDurationSeconds.value = props.leg.duration_seconds ?? null;
      routeGeometry.value = props.leg.route_geometry ?? null;
      routingProfile.value = props.leg.routing_profile ?? null;
      if (props.leg.route_geometry) {
        cachedExactRoute.value = {
          geometry: props.leg.route_geometry,
          distance: props.leg.distance_meters ?? null,
          duration: props.leg.duration_seconds ?? null,
          profile: props.leg.routing_profile ?? null,
        };
        const parsedCoords = parseRouteGeometry(props.leg.route_geometry);
        if (parsedCoords) {
          calculatedRoutes.value = [
            {
              coordinates: parsedCoords,
              distance_meters: props.leg.distance_meters ?? 0,
              duration_seconds: props.leg.duration_seconds ?? 0,
              profile: props.leg.routing_profile ?? '',
            },
          ];
          selectedRouteIndex.value = 0;
        } else {
          calculatedRoutes.value = [];
          selectedRouteIndex.value = 0;
        }
        routeDisplayMode.value = 'exact';
      } else {
        cachedExactRoute.value = null;
        calculatedRoutes.value = [];
        selectedRouteIndex.value = 0;
        routeDisplayMode.value = 'exact';
      }
    } else {
      transportCategory.value = 'zu Fuß';
      selectedTransitType.value = 'Zug';
      form.value = {
        transport_type: 'zu Fuß',
        departure_time: '',
        arrival_time: '',
        checkin_info: '',
        seat: '',
        luggage: '',
        ticket_link: '',
        note: '',
        amount: '',
        paid_by_user_id: '',
      };
      lastModifiedTimeField.value = 'departure';
      isTimeLinked.value = true;
      calculatedDistanceMeters.value = null;
      calculatedDurationSeconds.value = null;
      routeGeometry.value = null;
      routingProfile.value = null;
      cachedExactRoute.value = null;
      calculatedRoutes.value = [];
      selectedRouteIndex.value = 0;
      routeDisplayMode.value = 'exact';
    }
  },
  { immediate: true }
);

const modalTitle = computed(() => {
  const fromName = props.fromSpot?.title || 'Start';
  const toName = props.toSpot?.title || 'Ziel';
  return `Teilstrecke: ${fromName} → ${toName}`;
});

const hasCoordinates = computed(() => {
  return (
    props.fromSpot?.lat != null &&
    props.fromSpot?.lng != null &&
    props.toSpot?.lat != null &&
    props.toSpot?.lng != null
  );
});

const isRoutable = computed(() => {
  if (!hasCoordinates.value) return false;
  const t = (form.value.transport_type || '').toLowerCase();
  return t === 'auto' || t === 'fahrrad' || t === 'zu fuß' || t === 'zu fuss';
});

async function calculateRoute() {
  if (!props.fromSpot || !props.toSpot || !hasCoordinates.value) return;
  isCalculatingRoute.value = true;
  routeCalculationError.value = null;

  try {
    const tripId = props.fromSpot.trip_id || props.toSpot.trip_id;
    const res = await api.post<DirectionsResponse>(`/trips/${tripId}/routes/directions`, {
      from_lat: props.fromSpot.lat,
      from_lng: props.fromSpot.lng,
      to_lat: props.toSpot.lat,
      to_lng: props.toSpot.lng,
      transport_type: form.value.transport_type,
      preference: routePreference.value,
    });

    if (!res.supported || !res.routes?.length) {
      routeCalculationError.value = res.reason || 'Keine Route gefunden';
      return;
    }

    calculatedRoutes.value = res.routes.slice(0, 3);
    const suggestedIdx = suggestedRouteIndex.value >= 0 ? suggestedRouteIndex.value : 0;
    selectRoute(suggestedIdx);
  } catch (err: unknown) {
    routeCalculationError.value =
      err instanceof Error ? err.message : 'Fehler beim Abrufen der Route';
  } finally {
    isCalculatingRoute.value = false;
  }
}

const hasExtendedData = computed(() => {
  return !!(
    form.value.checkin_info ||
    form.value.seat ||
    form.value.luggage ||
    form.value.ticket_link ||
    form.value.amount ||
    form.value.note
  );
});

const canDelete = computed(() => {
  return (
    props.leg != null ||
    !!(
      form.value.departure_time ||
      form.value.arrival_time ||
      form.value.checkin_info ||
      form.value.seat ||
      form.value.luggage ||
      form.value.ticket_link ||
      form.value.note ||
      form.value.amount
    )
  );
});

function onSave() {
  if (!props.fromSpot || !props.toSpot || isLegUploadingAttachments.value) return;
  const isExact = isRoutable.value && routeDisplayMode.value === 'exact' && !!routeGeometry.value;
  const legData: ExcursionLeg = {
    id: props.leg?.id,
    position: props.leg?.position ?? 0,
    from_spot_id: props.fromSpot.id,
    to_spot_id: props.toSpot.id,
    transport_type: form.value.transport_type || null,
    departure_time: form.value.departure_time || null,
    arrival_time: form.value.arrival_time || null,
    checkin_info: form.value.checkin_info.trim() || null,
    seat: form.value.seat.trim() || null,
    luggage: form.value.luggage.trim() || null,
    ticket_link: form.value.ticket_link.trim() || null,
    note: form.value.note.trim() || null,
    amount: form.value.amount ? Number(form.value.amount) : null,
    paid_by_user_id:
      form.value.amount && form.value.paid_by_user_id ? Number(form.value.paid_by_user_id) : null,
    budget_expense_id: props.leg?.budget_expense_id,
    route_geometry: isExact ? routeGeometry.value : null,
    distance_meters: isExact ? calculatedDistanceMeters.value : null,
    duration_seconds: isExact ? calculatedDurationSeconds.value : null,
    routing_profile: isExact ? routingProfile.value : null,
  };
  emit('save', legData);
  emit('update:modelValue', false);
}

function onDelete() {
  if (isLegUploadingAttachments.value) return;
  emit('delete');
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    size="md"
    full-height
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <form class="leg-form" @submit.prevent="onSave">
      <div class="route-summary" v-if="fromSpot && toSpot">
        <span class="spot-pill">
          <AppIcon
            :icon="spotCategoryMeta(fromSpot.category).tabler"
            :size="14"
            group="categories"
          />
          {{ fromSpot.title }}
        </span>
        <span class="arrow">→</span>
        <span class="spot-pill">
          <AppIcon :icon="spotCategoryMeta(toSpot.category).tabler" :size="14" group="categories" />
          {{ toSpot.title }}
        </span>
      </div>

      <SegmentedToggle
        class="transport-toggle"
        :model-value="transportCategory"
        :options="TRANSPORT_MODE_OPTIONS"
        aria-label="Fortbewegungsart"
        @update:model-value="onCategorySelect"
      />

      <!-- Öffi-Detail-Dropdown (nur wenn ÖPNV ausgewählt ist) -->
      <div
        class="transit-dropdown-wrapper"
        :class="{ 'is-expanded': transportCategory === 'ÖPNV' }"
        :inert="transportCategory !== 'ÖPNV' ? true : undefined"
      >
        <div class="transit-dropdown-inner">
          <FormField icon="category" label="Verkehrsmittel">
            <Select
              :model-value="selectedTransitType"
              class="transit-select"
              @update:model-value="onTransitSelect"
            >
              <option v-for="t in transitOptions" :key="t" :value="t">
                {{ travelTypeIcon(t) }} {{ t }}
              </option>
            </Select>
          </FormField>
          <p class="transit-hint">
            <AppIcon
              :icon="ACTION_ICONS.info"
              :size="14"
              group="actions"
              class="transit-hint-icon"
            />
            <span>
              Für ÖPNV ist aktuell noch keine exakte Routenberechnung möglich – bitte trage die
              Routendetails daher selbst ein.
            </span>
          </p>
        </div>
      </div>

      <!-- Exakte Routen-Berechnung & Luftlinie-Umschalter -->
      <div
        class="route-calc-wrapper"
        :class="{ 'is-expanded': isRoutable }"
        :inert="!isRoutable ? true : undefined"
      >
        <div class="route-calc-inner">
          <div class="route-calc-section" :class="{ 'has-route': hasExactRoute }">
            <!-- Zustand 1: Noch keine Route berechnet -> Aufforderung zur Berechnung -->
            <div v-if="!hasExactRoute" class="route-calc-header">
              <div class="route-calc-info">
                <span class="route-calc-title">
                  <AppIcon :icon="routeHeadingIconDef" :size="16" group="actions" /> Exakte Route
                </span>
                <div class="route-calc-detail">
                  <span class="route-calc-hint">
                    Echte Wegeroute, Distanz und Fahrzeit für {{ form.transport_type }} berechnen.
                  </span>
                </div>
              </div>
              <div class="route-calc-init-controls">
                <SegmentedToggle
                  class="route-preference-toggle"
                  :model-value="routePreference"
                  :options="ROUTE_PREFERENCE_OPTIONS"
                  aria-label="Routenpräferenz"
                  @update:model-value="onPreferenceToggle"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="btn-calc-route"
                  :loading="isCalculatingRoute"
                  @click="calculateRoute"
                >
                  Route berechnen
                </Button>
              </div>
            </div>

            <!-- Zustand 2: Route liegt vor -> Mini-Map, Alternativen & Umschalter -->
            <div v-else class="route-calc-active">
              <div class="route-calc-header-mode">
                <div class="route-calc-heading-row">
                  <div class="route-calc-title-group">
                    <span class="route-calc-title">
                      <AppIcon :icon="routeHeadingIconDef" :size="16" group="actions" />
                      Routenführung
                    </span>
                    <span
                      class="route-calc-badge"
                      :class="{ 'route-calc-badge--dashed': routeDisplayMode === 'direct' }"
                    >
                      {{ routeDisplayMode === 'exact' ? 'Exakte Route aktiv' : 'Luftlinie aktiv' }}
                    </span>
                  </div>
                </div>

                <SegmentedToggle
                  class="route-mode-toggle"
                  :model-value="routeDisplayMode"
                  :options="ROUTE_MODE_OPTIONS"
                  aria-label="Routenführung auf der Karte"
                  @update:model-value="onRouteModeChange"
                />
              </div>

              <!-- Mini-Map der Teilstrecke mit Start-, Ziel-Pins und gerouteten Alternativen -->
              <div class="route-mini-map-container">
                <LegMiniMap
                  :from-spot="fromSpot"
                  :to-spot="toSpot"
                  :routes="calculatedRoutes"
                  :selected-route-index="selectedRouteIndex"
                  :transport-type="form.transport_type"
                  :route-display-mode="routeDisplayMode"
                  @select-route="selectRoute"
                />
              </div>

              <div class="route-calc-body">
                <!-- Wenn Exakte Route aktiv ist -->
                <template v-if="routeDisplayMode === 'exact'">
                  <!-- Präferenz-Umschalter (Schnellste vs Kürzeste) -->
                  <div class="route-preference-row">
                    <span class="route-preference-label">Bevorzugen:</span>
                    <SegmentedToggle
                      class="route-preference-toggle"
                      :model-value="routePreference"
                      :options="ROUTE_PREFERENCE_OPTIONS"
                      aria-label="Routenpräferenz"
                      @update:model-value="onPreferenceToggle"
                    />
                  </div>

                  <!-- Mehrere Routenalternativen (bis zu 3) als interaktive Liste -->
                  <div
                    v-if="calculatedRoutes.length > 1"
                    class="route-alternatives-list"
                    role="radiogroup"
                    aria-label="Verfügbare Routenalternativen"
                  >
                    <button
                      v-for="(r, idx) in calculatedRoutes"
                      :key="idx"
                      type="button"
                      class="route-alt-card"
                      :class="{ 'is-selected': idx === selectedRouteIndex }"
                      role="radio"
                      :aria-checked="idx === selectedRouteIndex"
                      @click="selectRoute(idx)"
                    >
                      <div class="route-alt-radio" aria-hidden="true">
                        <span v-if="idx === selectedRouteIndex" class="route-alt-radio-dot"></span>
                      </div>
                      <div class="route-alt-content">
                        <div class="route-alt-title-row">
                          <span class="route-alt-name">Route {{ idx + 1 }}</span>
                          <div class="route-alt-badges">
                            <span
                              v-if="idx === fastestRouteIndex"
                              class="route-alt-badge badge-fastest"
                              title="Schnellste Reisedauer"
                            >
                              <AppIcon :icon="fastestRouteIconDef" :size="11" group="actions" />
                              Schnellste
                            </span>
                            <span
                              v-if="idx === shortestRouteIndex"
                              class="route-alt-badge badge-shortest"
                              title="Kürzeste Fahrtstrecke"
                            >
                              <AppIcon :icon="ACTION_ICONS.distance" :size="11" group="actions" />
                              Kürzeste
                            </span>
                            <span
                              v-if="idx === suggestedRouteIndex"
                              class="route-alt-badge badge-suggested"
                              title="Empfehlung anhand gewählter Präferenz"
                            >
                              <AppIcon
                                :icon="ACTION_ICONS.recommended"
                                :size="11"
                                group="actions"
                              />
                              Vorschlag
                            </span>
                          </div>
                        </div>
                        <div class="route-alt-stats">
                          <span class="route-alt-duration">{{
                            formatDuration(r.duration_seconds)
                          }}</span>
                          <span class="route-alt-sep">•</span>
                          <span class="route-alt-distance">{{
                            formatDistance(r.distance_meters)
                          }}</span>
                          <span
                            v-if="
                              idx !== fastestRouteIndex &&
                              fastestRouteIndex >= 0 &&
                              calculatedRoutes[fastestRouteIndex] &&
                              r.duration_seconds >
                                calculatedRoutes[fastestRouteIndex].duration_seconds
                            "
                            class="route-alt-diff"
                          >
                            (+{{
                              formatDiffDuration(
                                r.duration_seconds -
                                  calculatedRoutes[fastestRouteIndex].duration_seconds
                              )
                            }})
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>

                  <!-- Nur 1 Route vorhanden -> Kompakte Anzeige -->
                  <div v-else class="route-calc-detail">
                    <span class="route-calc-stats">
                      {{ formatDistance(calculatedDistanceMeters) }} •
                      {{ formatDuration(calculatedDurationSeconds) }}
                    </span>
                  </div>
                </template>

                <!-- Wenn Luftlinie aktiv ist -->
                <div v-else class="route-calc-detail">
                  <span class="route-calc-hint">
                    Gestrichelte Verbindung auf der Karte (ungefähre Luftlinie).
                  </span>
                </div>

                <div class="route-calc-actions">
                  <Button
                    v-if="routeDisplayMode === 'exact'"
                    type="button"
                    variant="secondary"
                    size="sm"
                    class="btn-calc-route"
                    :loading="isCalculatingRoute"
                    @click="calculateRoute"
                  >
                    <AppIcon :icon="ACTION_ICONS.refresh" :size="13" group="actions" />
                    Neu berechnen
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="btn-reset-route"
                    :title="
                      routeDisplayMode === 'exact'
                        ? 'Exakte Route verwerfen und auf Luftlinie zurücksetzen'
                        : 'Route verwerfen'
                    "
                    @click="resetToDirectLine"
                  >
                    <AppIcon :icon="ACTION_ICONS.restore" :size="13" group="actions" />
                    {{
                      routeDisplayMode === 'exact'
                        ? 'Auf Luftlinie zurücksetzen'
                        : 'Route verwerfen'
                    }}
                  </Button>
                </div>
              </div>
            </div>

            <p v-if="routeCalculationError" class="route-calc-error">
              <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
              <span>{{ routeCalculationError }}</span>
            </p>

            <div class="route-calc-footer">
              <a
                href="https://openrouteservice.org/"
                target="_blank"
                rel="noopener noreferrer"
                class="route-source-link"
              >
                Quelle: OpenRouteService
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="row time-row">
        <FormField icon="time" :label="departureLabel">
          <div
            class="time-input-wrap departure-time-wrapper"
            :class="{ 'has-sparkle': canCalcDeparture }"
          >
            <Input
              v-model="form.departure_time"
              type="time"
              @input="onDepartureInput"
              @change="onDepartureInput"
            />
            <button
              v-if="canCalcDeparture"
              type="button"
              class="time-sparkle-btn departure-sparkle-btn"
              :class="{ 'sparkle-spin': isCalculatingDepartureSparkle }"
              :title="departureSparkleTitle"
              :aria-label="departureSparkleTitle"
              data-testid="departure-sparkle-btn"
              @mousedown.prevent
              @click="calcDepartureFromArrival"
            >
              <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
            </button>
          </div>
        </FormField>
        <FormField icon="time" label="Ankunft">
          <div
            class="time-input-wrap arrival-time-wrapper"
            :class="{ 'has-sparkle': canCalcArrival }"
          >
            <Input
              v-model="form.arrival_time"
              type="time"
              @input="onArrivalInput"
              @change="onArrivalInput"
            />
            <button
              v-if="canCalcArrival"
              type="button"
              class="time-sparkle-btn arrival-sparkle-btn"
              :class="{ 'sparkle-spin': isCalculatingArrivalSparkle }"
              :title="arrivalSparkleTitle"
              :aria-label="arrivalSparkleTitle"
              data-testid="arrival-sparkle-btn"
              @mousedown.prevent
              @click="calcArrivalFromDeparture"
            >
              <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
            </button>
          </div>
        </FormField>
      </div>

      <!-- Zeiteffizienz- / Synchronisations-Leiste -->
      <Alert
        v-if="timeDurationStatus"
        class="time-sync-bar"
        :class="`time-sync-bar--${timeDurationStatus.type}`"
        :variant="alertVariantForStatus"
        :icon="alertIconForStatus"
        size="sm"
        data-testid="time-sync-bar"
      >
        <span class="time-sync-message">
          <template v-if="timeDurationStatus.type === 'matched'">
            Dauer & Zeitspanne:
            <strong>{{ formatDuration(activeDurationSeconds) }}</strong>
          </template>
          <template v-else-if="timeDurationStatus.type === 'mismatch'">
            Zeitfenster:
            <strong>{{ formatDuration((timeDurationStatus.elapsedMinutes ?? 0) * 60) }}</strong>
            (Reisedauer: {{ formatDuration(activeDurationSeconds) }},
            {{
              (timeDurationStatus.diffMinutes ?? 0) > 0
                ? `+${formatDuration((timeDurationStatus.diffMinutes ?? 0) * 60)}`
                : `-${formatDuration(Math.abs(timeDurationStatus.diffMinutes ?? 0) * 60)}`
            }})
          </template>
          <template v-else-if="timeDurationStatus.type === 'suggest'">
            {{ timeDurationStatus.text }}
          </template>
          <template v-else-if="timeDurationStatus.type === 'info'">
            Reisedauer:
            <strong>{{ formatDuration((timeDurationStatus.elapsedMinutes ?? 0) * 60) }}</strong>
          </template>
        </span>

        <template #actions>
          <Button
            v-if="timeDurationStatus.canToggleLink"
            type="button"
            size="sm"
            :variant="isTimeLinked ? 'card-action' : 'secondary'"
            :icon="isTimeLinked ? timeLinkedIconDef : timeUnlinkedIconDef"
            :class="{ 'is-linked': isTimeLinked }"
            :title="
              isTimeLinked
                ? 'Zeiten sind an Reisedauer gekoppelt (Klick zum Entkoppeln)'
                : 'Zeiten an Reisedauer koppeln'
            "
            data-testid="time-link-toggle"
            @click="toggleTimeLink"
          >
            {{ isTimeLinked ? 'Gekoppelt' : 'Entkoppelt' }}
          </Button>
          <Button
            v-else-if="timeDurationStatus.type === 'suggest'"
            type="button"
            size="sm"
            variant="primary"
            :icon="ACTION_ICONS.sparkles"
            data-testid="time-apply-btn"
            @click="applySuggestedTime(timeDurationStatus.field!, timeDurationStatus.target)"
          >
            Übernehmen
          </Button>
        </template>
      </Alert>

      <CollapsibleFieldset label="Erweiterte Angaben" :open-initial="hasExtendedData">
        <FormField :icon="extendedConfig.icons.checkin" :label="extendedConfig.labels.checkin">
          <Input
            v-model="form.checkin_info"
            type="text"
            :placeholder="extendedConfig.placeholders.checkin"
          />
        </FormField>

        <div v-if="showsSeatField" class="row">
          <FormField :icon="extendedConfig.icons.seat" :label="extendedConfig.labels.seat">
            <Input
              v-model="form.seat"
              type="text"
              :placeholder="extendedConfig.placeholders.seat"
            />
          </FormField>
          <FormField :icon="extendedConfig.icons.luggage" :label="extendedConfig.labels.luggage">
            <Input
              v-model="form.luggage"
              type="text"
              :placeholder="extendedConfig.placeholders.luggage"
            />
          </FormField>
        </div>
        <FormField
          v-else
          :icon="extendedConfig.icons.luggage"
          :label="extendedConfig.labels.luggage"
        >
          <Input
            v-model="form.luggage"
            type="text"
            :placeholder="extendedConfig.placeholders.luggage"
          />
        </FormField>

        <FormField
          :icon="extendedConfig.icons.ticketLink"
          :label="extendedConfig.labels.ticketLink"
        >
          <Input
            v-model="form.ticket_link"
            type="url"
            :placeholder="extendedConfig.placeholders.ticketLink"
          />
        </FormField>

        <div class="row">
          <FormField :icon="extendedConfig.icons.amount" :label="extendedConfig.labels.amount">
            <Input
              v-model="form.amount"
              type="number"
              step="0.01"
              min="0"
              :placeholder="extendedConfig.placeholders.amount"
            />
          </FormField>
          <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
            <Select v-model="form.paid_by_user_id">
              <option value="">– wählen –</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>
        </div>
        <p v-if="users.length > 1 && form.amount && !form.paid_by_user_id" class="hint">
          Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
        </p>

        <FormField :icon="extendedConfig.icons.note" :label="extendedConfig.labels.note">
          <Input v-model="form.note" type="text" :placeholder="extendedConfig.placeholders.note" />
        </FormField>
      </CollapsibleFieldset>

      <FileAttachments
        v-if="leg?.id"
        domain="excursion_legs"
        :entity-id="leg.id"
        v-model:uploading="isLegUploadingAttachments"
      />
      <p v-else class="attachments-hint">
        Anhänge (Tickets, Buchungsbestätigungen etc.) können hochgeladen werden, sobald die Tour
        gespeichert wurde.
      </p>

      <div class="actions-row">
        <Button
          v-if="canDelete"
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          :disabled="isLegUploadingAttachments"
          @click="onDelete"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button
          type="button"
          variant="ghost"
          class="btn-cancel"
          :disabled="isLegUploadingAttachments"
          @click="emit('update:modelValue', false)"
        >
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" :disabled="isLegUploadingAttachments">
          Übernehmen
        </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.leg-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.route-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-hover);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.9rem;
  font-weight: 500;
}

.spot-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: var(--color-text-muted);
  font-weight: 700;
  flex-shrink: 0;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.attachments-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.spacer {
  flex: 1;
}

.transport-toggle {
  width: 100%;
}

.transport-toggle :deep(.segmented-option) {
  padding: 6px 8px;
}

.transit-dropdown-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: calc(-1 * var(--space-3));
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.25s ease,
    visibility 0s linear 0.35s;
}

.transit-dropdown-wrapper.is-expanded {
  grid-template-rows: 1fr;
  margin-top: 0;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s ease,
    visibility 0s linear 0s;
}

.transit-dropdown-inner {
  min-height: 0;
  overflow: hidden;
  padding: 4px;
  margin: -4px;
}

.transit-dropdown-wrapper:not(.is-expanded) .transit-dropdown-inner {
  transform: translateY(-6px);
  opacity: 0;
  pointer-events: none;
}

.transit-dropdown-wrapper.is-expanded .transit-dropdown-inner {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.transit-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1-5);
  margin: var(--space-2) 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.transit-hint-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.route-calc-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: calc(-1 * var(--space-3));
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s ease,
    visibility 0s linear 0.38s;
}

.route-calc-wrapper.is-expanded {
  grid-template-rows: 1fr;
  margin-top: 0;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.32s ease,
    visibility 0s linear 0s;
}

.route-calc-inner {
  min-height: 0;
  overflow: hidden;
  /* Reserviert Platz für Outline-Fokus (z. B. Button-Fokus-Ring) */
  padding: 4px;
  margin: -4px;
}

.route-calc-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-subtle, var(--color-hover));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    transform 0.38s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-calc-wrapper:not(.is-expanded) .route-calc-section {
  transform: translateY(-8px) scale(0.99);
  opacity: 0;
  pointer-events: none;
}

.route-calc-wrapper.is-expanded .route-calc-section {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.route-calc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.route-calc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 40px;
  justify-content: center;
}

.route-calc-detail {
  display: flex;
  min-height: 1.25rem;
  align-items: center;
}

.route-calc-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  font-weight: 600;
  font-size: 0.875rem;
}

.route-calc-stats {
  font-weight: 700;
  color: var(--color-primary);
  font-size: 0.9375rem;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-calc-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.btn-calc-route {
  flex-shrink: 0;
  min-width: 125px;
  justify-content: center;
}

.route-calc-active {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-calc-header-mode {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-calc-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.route-calc-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.route-calc-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: 999px;
  background: var(--color-primary-tint);
  color: var(--color-primary);
  line-height: 1.2;
}

.route-calc-badge--dashed {
  background: var(--color-hover);
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
}

.route-mode-toggle {
  width: 100%;
}

.route-calc-init-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.route-mini-map-container {
  width: 100%;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}

.route-preference-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.route-preference-toggle {
  flex: 1;
  max-width: 320px;
}

.route-preference-toggle :deep(.segmented-option) {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.route-alternatives-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-alt-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
  width: 100%;
}

.route-alt-card:hover {
  border-color: var(--color-primary-light, #93c5fd);
  background: var(--color-hover);
}

.route-alt-card.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint, #eff6ff);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.route-alt-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.15s ease;
}

.route-alt-card.is-selected .route-alt-radio {
  border-color: var(--color-primary);
}

.route-alt-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.route-alt-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.route-alt-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.route-alt-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.route-alt-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.route-alt-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 999px;
  line-height: 1.3;
}

.badge-fastest {
  background: #e0f2fe;
  color: #0369a1;
}

.badge-shortest {
  background: #f0fdf4;
  color: #15803d;
}

.badge-suggested {
  background: #fef3c7;
  color: #b45309;
}

:root[data-theme='dark'] .badge-fastest {
  background: rgba(3, 105, 161, 0.25);
  color: #7dd3fc;
}

:root[data-theme='dark'] .badge-shortest {
  background: rgba(21, 128, 61, 0.25);
  color: #86efac;
}

:root[data-theme='dark'] .badge-suggested {
  background: rgba(180, 83, 9, 0.25);
  color: #fde68a;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .badge-fastest {
    background: rgba(3, 105, 161, 0.25);
    color: #7dd3fc;
  }
  :root:not([data-theme='light']) .badge-shortest {
    background: rgba(21, 128, 61, 0.25);
    color: #86efac;
  }
  :root:not([data-theme='light']) .badge-suggested {
    background: rgba(180, 83, 9, 0.25);
    color: #fde68a;
  }
}

.route-alt-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.route-alt-duration {
  font-weight: 600;
  color: var(--color-text);
}

.route-alt-card.is-selected .route-alt-duration {
  color: var(--color-primary);
}

.route-alt-diff {
  color: var(--color-text-muted);
  font-style: italic;
}

.route-calc-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-calc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: 4px;
}

.btn-reset-route {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  padding: 4px 8px;
  white-space: nowrap;
}

.btn-reset-route:hover {
  color: var(--color-danger, #ef4444);
}

.route-calc-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1-5);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger, #ef4444);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-calc-footer {
  display: flex;
  margin-top: 2px;
}

.route-source-link {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-decoration: underline;
  text-decoration-style: dotted;
  transition: color 0.15s ease;
  font-family: inherit;
}

.route-source-link:hover {
  color: var(--color-primary-dark);
}

@keyframes route-content-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.time-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.time-input-wrap :deep(.input) {
  width: 100%;
}

.time-input-wrap.has-sparkle :deep(input) {
  padding-right: 56px;
}

.time-sparkle-btn {
  position: absolute;
  right: 30px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary, #6366f1);
  cursor: pointer;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  transition:
    transform 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
  z-index: 2;
}

.time-sparkle-btn:hover {
  background-color: var(--color-surface-hover, rgba(0, 0, 0, 0.06));
  color: var(--color-primary-hover, #4f46e5);
  transform: translateY(-50%) scale(1.15);
}

.time-sparkle-btn:active {
  transform: translateY(-50%) scale(0.92);
}

.time-sparkle-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

@keyframes sparkleRotate {
  0% {
    transform: translateY(-50%) rotate(0deg) scale(0.9);
  }
  50% {
    transform: translateY(-50%) rotate(180deg) scale(1.2);
  }
  100% {
    transform: translateY(-50%) rotate(360deg) scale(1);
  }
}

.sparkle-spin {
  animation: sparkleRotate 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.time-sync-bar {
  margin-top: calc(-1 * var(--space-1));
}

.time-sync-message {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .transit-dropdown-wrapper,
  .transit-dropdown-inner,
  .route-calc-wrapper,
  .route-calc-section,
  .route-calc-stats,
  .route-calc-hint,
  .route-calc-error,
  .sparkle-spin {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 600px) {
  .row {
    grid-template-columns: 1fr;
  }

  .route-calc-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-calc-init-controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .route-preference-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-preference-toggle {
    max-width: 100%;
    width: 100%;
  }

  .route-calc-body {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .route-calc-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .transport-toggle :deep(.segmented-option),
  .route-mode-toggle :deep(.segmented-option) {
    padding: 6px 4px;
    font-size: 0.8rem;
    gap: 4px;
  }
}
</style>
