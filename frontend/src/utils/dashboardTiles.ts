import { IconBed, IconBedFilled, IconShieldCheck, IconShieldCheckFilled } from '@tabler/icons-vue';
import { SECTION_ICON_DEFS } from './sectionIcons';
import type { IconDef } from './icon';

export interface DashboardTileDef {
  key: string;
  label: string;
  icon: IconDef;
}

// Unterkunft/Sicherheits-Check haben keinen eigenen SECTION_ICON_DEFS-Eintrag (sie sind reine
// Dashboard-Kacheln, keine eigenständigen App-Bereiche mit Nav-Punkt) - gleiches Icon wie
// spotCategoryMeta('Unterkunft').tabler bzw. DashboardView.vue's Sicherheits-Check-Kachel.
export const ACCOMMODATION_ICON: IconDef = { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled };
export const SECURITY_CHECK_ICON: IconDef = {
  id: 'shield-check',
  emoji: '🛡️',
  outline: IconShieldCheck,
  filled: IconShieldCheckFilled,
};

// Registry der konfigurierbaren Dashboard-Kacheln (siehe stores/dashboardConfig.ts, ProfileView.vue)
// - 1:1 nach dem Muster von utils/navLinks.ts (NavBar-Konfiguration). Reihenfolge hier ist nur der
// Fallback-Default für neue Installationen bzw. neu hinzukommende Kacheln - die tatsächliche
// Anzeige-Reihenfolge kommt aus dashboardConfig.ts. Icons entsprechen den auf den Kacheln selbst
// gezeigten (SECTION_ICON_DEFS bzw. dieselben IconDefs wie DashboardView.vue's Unterkunft-/
// Sicherheits-Check-Kachel), damit die Einstellungen-Liste wiedererkennbar bleibt.
export const DASHBOARD_TILES: DashboardTileDef[] = [
  { key: 'calendar', label: 'Kalender', icon: SECTION_ICON_DEFS.calendar },
  { key: 'packing', label: 'Packliste', icon: SECTION_ICON_DEFS.packing },
  { key: 'budget', label: 'Budget', icon: SECTION_ICON_DEFS.budget },
  { key: 'shopping', label: 'Einkaufsliste', icon: SECTION_ICON_DEFS.shopping },
  { key: 'todo', label: 'ToDo', icon: SECTION_ICON_DEFS.todo },
  { key: 'travel', label: 'Reise', icon: SECTION_ICON_DEFS.travel },
  { key: 'accommodation', label: 'Unterkunft', icon: ACCOMMODATION_ICON },
  { key: 'diary', label: 'Tagebuch', icon: SECTION_ICON_DEFS.diary },
  { key: 'notes', label: 'Notizen', icon: SECTION_ICON_DEFS.notes },
  { key: 'securityCheck', label: 'Sicherheits-Check', icon: SECURITY_CHECK_ICON },
];
