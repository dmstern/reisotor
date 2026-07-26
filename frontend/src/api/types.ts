export interface User {
  id: number;
  username: string;
  avatar: string;
}

export interface Trip {
  id: number;
  name: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
}

export type ScheduleCategory = 'trip' | 'excursion' | 'todo' | 'travel' | 'other';

/** Zeitraum, in dem ein Einkaufs-/ToDo-Eintrag erledigt werden soll: vor oder während des Urlaubs. */
export type Period = 'before' | 'during';

export interface ScheduleItem {
  id: number;
  trip_id: number;
  date: string;
  end_date: string | null;
  time: string | null;
  title: string;
  note: string | null;
  location: string | null;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  category: ScheduleCategory;
}

/** Vereinheitlichte Darstellung für die Kalenderansicht: entweder ein echter Kalender-Termin
 *  (scheduleItem gesetzt) oder ein synthetischer, nicht editierbarer Eintrag wie Urlaub-Start/-Ende
 *  (scheduleItem null), der nur zur Ursprungssicht springt statt inline editierbar zu sein. */
export interface CalendarEntry {
  key: string;
  /** Herkunft des Eintrags: 'schedule' ist ein echter, editierbarer Kalender-Termin;
   *  'trip', 'todo', 'travel' und 'excursion' sind synthetische, nicht editierbare Einträge aus
   *  anderen Sichten (Architekturregel Batch 3: nur lesend/verknüpfend, mit Sprung-Button zur
   *  Ursprungssicht). */
  kind: 'schedule' | 'trip' | 'todo' | 'travel' | 'excursion';
  date: string;
  endDate: string;
  time: string | null;
  title: string;
  note: string | null;
  location: string | null;
  category: ScheduleCategory;
  ideaId: number | null;
  todoId: number | null;
  travelId: number | null;
  scheduleItem: ScheduleItem | null;
}

export interface PackingItem {
  id: number;
  trip_id: number;
  category: string | null;
  label: string;
  checked: 0 | 1;
  owner_id: number | null;
}

export interface Excursion {
  id: number;
  trip_id: number;
  title: string;
  image_url: string | null;
  note: string | null;
  /** Optionales Datum: gesetzt = "geplant" (im Kalender eingeplant), ungesetzt = "in Planung". */
  date: string | null;
  created_by: number | null;
  /** IDs der Spots, die diesem Ausflug als Stationen zugeordnet sind. */
  spot_ids: number[];
}

export interface ExcursionLike {
  id: number;
  idea_id: number;
  user_id: number;
}

export interface ExcursionComment {
  id: number;
  idea_id: number;
  author_id: number;
  content: string;
  created_at: string;
}

export interface Accommodation {
  id: number;
  trip_id: number;
  name: string;
  address: string | null;
  link: string | null;
  maps_link: string | null;
  start_date: string | null;
  end_date: string | null;
  checkin: string | null;
  checkout: string | null;
  contact: string | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  amount: number | null;
  paid_by_user_id: number | null;
  budget_expense_id: number | null;
}

/** Rolle des Reise-Eintrags: für die Karten-Fokussierung auf den Urlaubsort ("Urlaubsfokus")
 *  muss die App wissen, welche Seite (Von/Nach) zuhause ist und welche zum Urlaubsziel gehört. */
export type TravelRole = 'arrival' | 'departure' | 'onward';

export interface TravelItem {
  id: number;
  trip_id: number;
  title: string;
  type: string | null;
  from_location: string | null;
  to_location: string | null;
  date: string | null;
  departure_time: string | null;
  checkin_info: string | null;
  amount: number | null;
  paid_by_user_id: number | null;
  luggage: string | null;
  seat: string | null;
  link: string | null;
  note: string | null;
  budget_expense_id: number | null;
  from_maps_link: string | null;
  from_lat: number | null;
  from_lng: number | null;
  to_maps_link: string | null;
  to_lat: number | null;
  to_lng: number | null;
  role: TravelRole | null;
}

export interface Spot {
  id: number;
  trip_id: number;
  title: string;
  image_url: string | null;
  /** Freitext-Kategorie (Combobox mit Vorschlägen, siehe utils/spotCategory.ts). */
  category: string | null;
  note: string | null;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  created_by: number | null;
}

export interface SpotLike {
  id: number;
  spot_id: number;
  user_id: number;
}

export interface SpotComment {
  id: number;
  spot_id: number;
  author_id: number;
  content: string;
  created_at: string;
}

export interface BudgetExpense {
  id: number;
  trip_id: number;
  title: string;
  category: string | null;
  amount: number;
  paid_by_user_id: number | null;
  date: string | null;
  note: string | null;
  budget_id: number | null;
}

/** Ein Budget ist entweder persönlich (owner_id gesetzt) oder geteilt (owner_id null). */
export interface Budget {
  id: number;
  trip_id: number;
  name: string;
  owner_id: number | null;
}

/** Kategorien-Anteil innerhalb eines Budgets. Die Summe aller Allocations eines Budgets
 *  ergibt dessen Ziel-Gesamtsumme; die Summe über alle Budgets ergibt das Gesamtbudget des Urlaubs. */
export interface BudgetAllocation {
  id: number;
  budget_id: number;
  category: string;
  amount: number;
}

export interface BudgetTransfer {
  id: number;
  trip_id: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  date: string | null;
  note: string | null;
}

export interface ShoppingItem {
  id: number;
  trip_id: number;
  label: string;
  assigned_to_user_id: number | null;
  checked: 0 | 1;
  link: string | null;
  note: string | null;
  shop: string | null;
  period: Period | null;
}

export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoItem {
  id: number;
  trip_id: number;
  title: string;
  assigned_to_user_id: number | null;
  due_date: string | null;
  priority: TodoPriority;
  note: string | null;
  done: 0 | 1;
  period: Period | null;
}

export interface Note {
  id: number;
  trip_id: number;
  title: string | null;
  content: string;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface NoteLike {
  id: number;
  note_id: number;
  user_id: number;
}

export interface NoteComment {
  id: number;
  note_id: number;
  author_id: number;
  content: string;
  created_at: string;
}

export interface DiaryEntry {
  id: number;
  trip_id: number;
  author_id: number;
  title: string | null;
  content: string;
  images: string[];
  created_at: string;
  updated_at: string | null;
}

export interface DiaryLike {
  id: number;
  entry_id: number;
  user_id: number;
}

export interface DiaryComment {
  id: number;
  entry_id: number;
  author_id: number;
  content: string;
  created_at: string;
}
