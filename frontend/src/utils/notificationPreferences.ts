import { SECTION_ICONS } from './sectionIcons';

// Dieselben 11 Domain-Keys wie backend/src/push.ts's PUSH_PREFERENCE_DOMAINS - 10
// Aktivitäts-Domänen (recordActivity()) plus 'departure' für die Abreise-Erinnerung
// (departureReminders.ts, kein Aktivitäts-Event). 'travel' entfällt seit #176 - Reise-Etappen
// laufen jetzt als Touren (role gesetzt) über die 'ideas'-Domäne.
export const NOTIFICATION_DOMAINS = [
  'schedule',
  'members',
  'departure',
  'budget',
  'ideas',
  'spots',
  'diary',
  'notes',
  'packing',
  'shopping',
  'todos',
] as const;
export type NotificationDomain = (typeof NOTIFICATION_DOMAINS)[number];

export type NotificationPreferences = Record<NotificationDomain, boolean>;

interface DomainMeta {
  label: string;
  icon: string;
}

// Icons wiederverwenden statt neu erfinden (siehe DESIGN.md): die meisten kommen 1:1 aus
// sectionIcons.ts; spots/members/departure haben dort keinen eigenen Eintrag (Spots/Touren teilen
// sich dort ein gemeinsames "Karte"-Icon, Mitglieder haben gar keinen Nav-Punkt) - hier stattdessen
// die anderswo in der App bereits etablierten Emoji (📍 = Spots-Sonstiges-Fallback in
// spotCategory.ts, 👥 = Mitglieder-Einladen-Button in TripSwitcher.vue, ✈️ = auch schon der Titel
// der Abreise-Erinnerung selbst in departureReminders.ts).
export const NOTIFICATION_DOMAIN_META: Record<NotificationDomain, DomainMeta> = {
  schedule: { label: 'Kalender', icon: SECTION_ICONS.calendar },
  members: { label: 'Mitglieder', icon: '👥' },
  departure: { label: 'Abreise-Erinnerung', icon: '✈️' },
  budget: { label: 'Budget', icon: SECTION_ICONS.budget },
  ideas: { label: 'Touren', icon: SECTION_ICONS.excursions },
  spots: { label: 'Spots', icon: '📍' },
  diary: { label: 'Tagebuch', icon: SECTION_ICONS.diary },
  notes: { label: 'Notizen', icon: SECTION_ICONS.notes },
  packing: { label: 'Packliste', icon: SECTION_ICONS.packing },
  shopping: { label: 'Einkaufsliste', icon: SECTION_ICONS.shopping },
  todos: { label: 'ToDos', icon: SECTION_ICONS.todo },
};

// Drei Wichtigkeits-Stufen ("Tiers"), aus denen sich die vier Komplett-Level ableiten - kein
// eigener "Level"-Zustand nötig, ein Level ist nur eine bestimmte An/Aus-Kombination dieser
// Domänen. "chatty" sind die Listen, deren Einträge oft einzeln angehakt werden (Hauptquelle vieler
// Pushes) - die bleiben bei "Ausgewogen" bewusst aus, aber einzeln zuschaltbar.
const ESSENTIAL: NotificationDomain[] = ['schedule', 'members', 'departure'];
const NORMAL: NotificationDomain[] = ['budget', 'ideas', 'spots', 'diary', 'notes'];
const CHATTY: NotificationDomain[] = ['packing', 'shopping', 'todos'];

export type NotificationLevel = 'essential' | 'balanced' | 'all';

function presetFor(domains: NotificationDomain[]): NotificationPreferences {
  const enabled = new Set(domains);
  return Object.fromEntries(NOTIFICATION_DOMAINS.map((d) => [d, enabled.has(d)])) as NotificationPreferences;
}

export const NOTIFICATION_LEVEL_PRESETS: Record<NotificationLevel, NotificationPreferences> = {
  essential: presetFor(ESSENTIAL),
  balanced: presetFor([...ESSENTIAL, ...NORMAL]),
  all: presetFor(NOTIFICATION_DOMAINS as unknown as NotificationDomain[]),
};

export const NOTIFICATION_LEVEL_OPTIONS: { value: NotificationLevel; label: string }[] = [
  { value: 'essential', label: 'Nötigste' },
  { value: 'balanced', label: 'Ausgewogen' },
  { value: 'all', label: 'Alles' },
];

/** Vergleicht die aktuellen Präferenzen exakt gegen die drei Presets - passt keins, ist die
 *  Auswahl "individuell angepasst" (die Level-Segmented-Control zeigt dann bewusst keinen aktiven
 *  Zustand). */
export function matchingLevel(prefs: NotificationPreferences): NotificationLevel | null {
  for (const level of Object.keys(NOTIFICATION_LEVEL_PRESETS) as NotificationLevel[]) {
    const preset = NOTIFICATION_LEVEL_PRESETS[level];
    if (NOTIFICATION_DOMAINS.every((d) => prefs[d] === preset[d])) return level;
  }
  return null;
}
