import type { NotificationItem } from '../api/types';

/** Ziel-Route für einen Klick auf einen Notification-Inbox-Eintrag (#97). Folgt denselben
 *  Domäne→Route-Zuordnungen, die im Rest der App schon für Querverweise genutzt werden (siehe
 *  TripMap.vue/ScheduleView.vue/DashboardView.vue/BudgetView.vue: `/excursions#excursion-<id>`,
 *  `/excursions#spot-<id>`, `/listen?tab=todo#todo-<id>`, …) - hier an einer Stelle zusammengefasst,
 *  da die Inbox als einzige Komponente über alle Domänen hinweg navigieren muss. `domain: 'schedule'`
 *  fehlt bewusst: der Kalender ist auf Desktop eine Schublade statt einer Route, NotificationInbox.vue
 *  ruft dafür direkt drawers.openCalendar() statt hier einen Pfad zu erhalten.
 *  Gibt null zurück, wenn es (wie bei 'members') kein sinnvolles Sprungziel gibt - die Inbox
 *  navigiert dann einfach nicht, sondern markiert nur als gelesen. */
export function notificationTarget(n: NotificationItem): string | null {
  const id = n.entity_id;
  const prefix = n.trip_id ? `/trip/${n.trip_id}` : '';
  switch (n.domain) {
    case 'packing':
      return `${prefix}/listen?tab=packing`;
    case 'shopping':
      return `${prefix}/listen?tab=shopping`;
    case 'todos':
      return id != null ? `${prefix}/listen?tab=todo#todo-${id}` : `${prefix}/listen?tab=todo`;
    case 'spots':
      return id != null ? `${prefix}/excursions#spot-${id}` : `${prefix}/excursions`;
    case 'ideas':
      // Deckt auch Touren mit gesetzter role ab (Reise-Etappen, #176) - eigene 'travel'-Domain gibt
      // es seit #176 nicht mehr, eine eigene "Reise"-Gruppierung seit #196 ebenfalls nicht mehr.
      return id != null ? `${prefix}/excursions#excursion-${id}` : `${prefix}/excursions`;
    case 'budget':
      return `${prefix}/budget`;
    case 'diary':
      return `${prefix}/diary`;
    case 'notes':
      return `${prefix}/notes`;
    default:
      return null;
  }
}
