import { SECTION_ICON_DEFS } from './sectionIcons';
import type { IconDef } from './icon';
import type { LiveDomain } from '../stores/liveSync';

export interface NavLinkDef {
  key: string;
  to: string;
  label: string;
  icon: IconDef;
  domain?: LiveDomain;
  domains?: LiveDomain[];
}

// Registry der konfigurierbaren NavBar-Einträge (siehe stores/navConfig.ts, SettingsView.vue) -
// "Übersicht" (Dashboard) ist bewusst NICHT Teil dieser Liste, sie bleibt als fixer, nicht
// ausblendbarer/verschiebbarer erster Eintrag direkt in NavBar.vue (zentraler Einstiegspunkt der
// App). Reihenfolge hier ist nur der Fallback-Default für neue Installationen bzw. neu
// hinzukommende Einträge - die tatsächliche Anzeige-Reihenfolge kommt aus navConfig.ts.
export const NAV_LINKS: NavLinkDef[] = [
  {
    key: 'listen',
    to: '/listen',
    label: 'Listen',
    icon: SECTION_ICON_DEFS.todo,
    domains: ['packing', 'shopping', 'todos'],
  },
  // domains statt domain: ExcursionsView.vue bündelt Spots, Touren (ideas) UND seit #175 auch Reise
  // (travel, eingebettet als TravelSection.vue statt eigener NavBar-Punkt/Route) - alle drei Domänen
  // müssen den Nav-Punkt auslösen können (siehe auch ExcursionsView.vue's markSeen()-Aufrufe).
  {
    key: 'excursions',
    to: '/excursions',
    label: 'Karte',
    icon: SECTION_ICON_DEFS.map,
    domains: ['spots', 'ideas'],
  },
  {
    key: 'budget',
    to: '/budget',
    label: 'Budget',
    icon: SECTION_ICON_DEFS.budget,
    domain: 'budget',
  },
  { key: 'diary', to: '/diary', label: 'Tagebuch', icon: SECTION_ICON_DEFS.diary, domain: 'diary' },
  { key: 'notes', to: '/notes', label: 'Notizen', icon: SECTION_ICON_DEFS.notes, domain: 'notes' },
];
