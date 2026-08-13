import { SECTION_ICONS } from './sectionIcons';
import type { LiveDomain } from '../stores/liveSync';

export interface NavLinkDef {
  key: string;
  to: string;
  label: string;
  icon: string;
  domain?: LiveDomain;
  domains?: LiveDomain[];
}

// Registry der konfigurierbaren NavBar-Einträge (siehe stores/navConfig.ts, ProfileView.vue) -
// "Übersicht" (Dashboard) ist bewusst NICHT Teil dieser Liste, sie bleibt als fixer, nicht
// ausblendbarer/verschiebbarer erster Eintrag direkt in NavBar.vue (zentraler Einstiegspunkt der
// App). Reihenfolge hier ist nur der Fallback-Default für neue Installationen bzw. neu
// hinzukommende Einträge - die tatsächliche Anzeige-Reihenfolge kommt aus navConfig.ts.
export const NAV_LINKS: NavLinkDef[] = [
  { key: 'listen', to: '/listen', label: 'Listen', icon: SECTION_ICONS.todo, domains: ['packing', 'shopping', 'todos'] },
  // domains statt domain: ExcursionsView.vue bündelt Spots UND Touren (ideas), beide Domänen
  // müssen den Nav-Punkt auslösen können - vorher fehlte 'ideas' hier, wodurch neue Touren nie
  // einen Punkt zeigten (siehe auch ExcursionsView.vue's markSeen()-Aufrufe).
  { key: 'excursions', to: '/excursions', label: 'Karte', icon: SECTION_ICONS.map, domains: ['spots', 'ideas'] },
  { key: 'travel', to: '/travel', label: 'Reise', icon: SECTION_ICONS.travel, domain: 'travel' },
  { key: 'budget', to: '/budget', label: 'Budget', icon: SECTION_ICONS.budget, domain: 'budget' },
  { key: 'diary', to: '/diary', label: 'Tagebuch', icon: SECTION_ICONS.diary, domain: 'diary' },
  { key: 'notes', to: '/notes', label: 'Notizen', icon: SECTION_ICONS.notes, domain: 'notes' },
];
