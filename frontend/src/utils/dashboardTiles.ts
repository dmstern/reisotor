import { SECTION_ICONS } from './sectionIcons';

export interface DashboardTileDef {
  key: string;
  label: string;
  icon: string;
}

// Registry der konfigurierbaren Dashboard-Kacheln (siehe stores/dashboardConfig.ts, ProfileView.vue)
// - 1:1 nach dem Muster von utils/navLinks.ts (NavBar-Konfiguration). Reihenfolge hier ist nur der
// Fallback-Default für neue Installationen bzw. neu hinzukommende Kacheln - die tatsächliche
// Anzeige-Reihenfolge kommt aus dashboardConfig.ts. Icons entsprechen den auf den Kacheln selbst
// gezeigten (SECTION_ICONS bzw. dieselben Literale wie DashboardView.vue's Unterkunft-/
// Sicherheits-Check-Kachel), damit die Einstellungen-Liste wiedererkennbar bleibt.
export const DASHBOARD_TILES: DashboardTileDef[] = [
  { key: 'calendar', label: 'Kalender', icon: SECTION_ICONS.calendar },
  { key: 'packing', label: 'Packliste', icon: SECTION_ICONS.packing },
  { key: 'budget', label: 'Budget', icon: SECTION_ICONS.budget },
  { key: 'shopping', label: 'Einkaufsliste', icon: SECTION_ICONS.shopping },
  { key: 'todo', label: 'ToDo', icon: SECTION_ICONS.todo },
  { key: 'travel', label: 'Reise', icon: SECTION_ICONS.travel },
  { key: 'accommodation', label: 'Unterkunft', icon: '🛏️' },
  { key: 'diary', label: 'Tagebuch', icon: SECTION_ICONS.diary },
  { key: 'notes', label: 'Notizen', icon: SECTION_ICONS.notes },
  { key: 'securityCheck', label: 'Sicherheits-Check', icon: '🛡️' },
];
