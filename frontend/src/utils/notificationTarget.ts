import type { NotificationItem } from '../api/types';

/** Ziel-Route für einen Klick auf einen Notification-Inbox-Eintrag (#97). Folgt denselben
 *  Domäne→Route-Zuordnungen, die im Rest der App schon für Querverweise genutzt werden (siehe
 *  TripMap.vue/ScheduleView.vue/DashboardView.vue/BudgetView.vue: `/excursions?group=travel#travel-<id>`,
 *  `/excursions#spot-<id>`, `/listen?tab=todo#todo-<id>`, …) - hier an einer Stelle zusammengefasst,
 *  da die Inbox als einzige Komponente über alle Domänen hinweg navigieren muss. `domain: 'schedule'`
 *  fehlt bewusst: der Kalender ist auf Desktop eine Schublade statt einer Route, NotificationInbox.vue
 *  ruft dafür direkt drawers.openCalendar() statt hier einen Pfad zu erhalten.
 *  Gibt null zurück, wenn es (wie bei 'members') kein sinnvolles Sprungziel gibt - die Inbox
 *  navigiert dann einfach nicht, sondern markiert nur als gelesen. */
export function notificationTarget(n: NotificationItem): string | null {
  const id = n.entity_id;
  switch (n.domain) {
    case 'packing':
      return '/listen?tab=packing';
    case 'shopping':
      return '/listen?tab=shopping';
    case 'todos':
      return id != null ? `/listen?tab=todo#todo-${id}` : '/listen?tab=todo';
    case 'spots':
      return id != null ? `/excursions#spot-${id}` : '/excursions';
    case 'ideas':
      return id != null ? `/excursions#excursion-${id}` : '/excursions';
    case 'travel':
      // Reise lebt seit #175 eingebettet in ExcursionsView.vue (TravelSection.vue) statt einer
      // eigenen Route - ?group=travel wählt dort direkt die passende Gruppierung (siehe
      // ExcursionsView.vue's onMounted()).
      return id != null ? `/excursions?group=travel#travel-${id}` : '/excursions?group=travel';
    case 'budget':
      return '/budget';
    case 'diary':
      return '/diary';
    case 'notes':
      return '/notes';
    default:
      return null;
  }
}
