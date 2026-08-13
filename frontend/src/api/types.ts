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
  packing_category_required: number;
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
  end_time: string | null;
  title: string;
  note: string | null;
  location: string | null;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  category: ScheduleCategory;
  /** Verknüpfter Spot (aus der Spots-Übersicht) statt Freitext-Standort – schließt sich mit
   *  idea_id gegenseitig aus (siehe ScheduleView.vue's Verknüpfungs-Auswahl). */
  spot_id: number | null;
  /** Verknüpfte Tour (Ausflug) – z. B. wenn die Tour auf einen Kalendertag gezogen wurde
   *  (drawers/excursionsStore.setDate) statt manuell einen Termin anzulegen. */
  idea_id: number | null;
}

/** Vereinheitlichte Darstellung für die Kalenderansicht: entweder ein echter Kalender-Termin
 *  (scheduleItem gesetzt) oder ein synthetischer, nicht editierbarer Eintrag wie Urlaub-Start/-Ende
 *  (scheduleItem null), der nur zur Ursprungssicht springt statt inline editierbar zu sein. Ein mit
 *  Spot/Tour verknüpfter Termin bleibt trotzdem 'schedule' (editierbar) – nur seine Optik (Icon,
 *  Kategorie-Farbe) übernimmt die des verknüpften Objekts, siehe calendarEntries.ts. */
export interface CalendarEntry {
  key: string;
  /** Herkunft des Eintrags: 'schedule' ist ein echter, editierbarer Kalender-Termin (auch wenn er
   *  mit einem Spot/einer Tour verknüpft ist); 'trip', 'todo' und 'travel' sind synthetische, nicht
   *  editierbare Einträge aus anderen Sichten (Architekturregel Batch 3: nur lesend/verknüpfend,
   *  mit Sprung-Button zur Ursprungssicht). */
  kind: 'schedule' | 'trip' | 'todo' | 'travel';
  date: string;
  endDate: string;
  time: string | null;
  endTime: string | null;
  title: string;
  note: string | null;
  location: string | null;
  category: ScheduleCategory;
  /** Icon-Override statt SCHEDULE_CATEGORY_META[category].icon – für Termine, die mit einem Spot
   *  (dessen Kategorie-Emoji) oder einer Tour mit genau einer Spot-Station (deren Emoji statt des
   *  generischen 🎒) verknüpft sind, siehe scheduleItemToEntry. Die Rahmenfarbe bleibt bewusst
   *  einheitlich Ausflug-orange (category bleibt 'excursion'). */
  icon?: string;
  ideaId: number | null;
  /** Verknüpfter Spot, falls der Termin (siehe scheduleItem.spot_id) direkt mit einem Spot statt
   *  einer Tour verknüpft ist. */
  spotId: number | null;
  todoId: number | null;
  travelId: number | null;
  scheduleItem: ScheduleItem | null;
  /** Nur für kind 'todo' aussagekräftig (TodoItem.done) – speist die Checkbox in
   *  CalendarWeek.vue's Kompaktzelle, die selbst keinen Zugriff auf die vollständige
   *  Todo-Liste hat. Bei anderen kinds schlicht false/irrelevant. */
  done: boolean;
}

export interface PackingItem {
  id: number;
  trip_id: number;
  category: string | null;
  /** Unterkategorie innerhalb der Kategorie, z. B. "Outfit Tag 1" innerhalb "Kleidung". */
  subcategory: string | null;
  label: string;
  /** Wie viele Exemplare insgesamt eingepackt werden sollen (Standard 1). */
  quantity: number;
  /** Wie viele der `quantity` Exemplare bereits rausgelegt sind – umfasst auch bereits eingepackte
   *  Exemplare (laid_out_count >= packed_count), da etwas Eingepacktes vorher rausgelegt wurde. */
  laid_out_count: number;
  /** Wie viele der `quantity` Exemplare bereits eingepackt sind. */
  packed_count: number;
  owner_id: number | null;
  /** Nur clientseitig gesetzt (api/client.ts's optimistische Antwort auf ein offline gequeutes
   *  POST/PUT, siehe api/offline.ts) - dieses Objekt wurde offline angelegt/bearbeitet und wartet
   *  noch auf den nächsten erfolgreichen Sync-Versuch (stores/connectivity.ts). Nie vom Backend
   *  gesetzt. */
  _pending?: boolean;
}

export interface Excursion {
  id: number;
  trip_id: number;
  title: string;
  image_url: string | null;
  note: string | null;
  note_format: string;
  /** Optionales Datum: gesetzt = "geplant" (im Kalender eingeplant), ungesetzt = "in Planung". */
  date: string | null;
  created_by: number | null;
  /** Spots dieser Tour, in Reihenfolge (Duplikate erlaubt, z. B. Start UND Ende am selben Ort bei
   *  einem Rundgang) – seit Unterkunft/Reise-Orte längst normale Spots sind, ist eine Tour-Station
   *  IMMER ein echter Spot (siehe Migrationskommentar in db/index.ts). Reihenfolge/Mehrfachbesuch
   *  lassen sich per Drag&Drop im Touren-Formular editieren (SpotOrderPicker.vue,
   *  ExcursionsView.vue); TourAssignPicker.vue bietet daneben einen schnelleren Weg, einen Spot
   *  ohne Reihenfolge einer Tour zuzuordnen. */
  spot_ids: number[];
  /** Unabhängig von `date`/geplant: explizit als tatsächlich unternommen markiert, auch für
   *  spontane, nie geplante Touren nutzbar (siehe stores/excursions.ts's setDone()). */
  done: 0 | 1;
  /** Nur clientseitig gesetzt, siehe PackingItem._pending oben. */
  _pending?: boolean;
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
  arrival_time: string | null;
  checkin_info: string | null;
  amount: number | null;
  paid_by_user_id: number | null;
  luggage: string | null;
  seat: string | null;
  link: string | null;
  note: string | null;
  note_format: string;
  budget_expense_id: number | null;
  from_maps_link: string | null;
  from_lat: number | null;
  from_lng: number | null;
  to_maps_link: string | null;
  to_lat: number | null;
  to_lng: number | null;
  role: TravelRole | null;
  from_place_id: number | null;
  to_place_id: number | null;
}

export interface Spot {
  id: number;
  trip_id: number;
  title: string;
  image_url: string | null;
  /** Freitext-Kategorie (Combobox mit Vorschlägen, siehe utils/spotCategory.ts). */
  category: string | null;
  note: string | null;
  note_format: string;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  created_by: number | null;
  /** Heimat-Seite eines Orts (Flughafen/Bahnhof/Zuhause/…), unabhängig von der Kategorie – ein
   *  Flughafen kann sowohl der heimische Abflughafen als auch der Zielflughafen sein. Nur für als
   *  Reise-Etappen-Ort verwendete Spots relevant (siehe TravelView.vue), bei gewöhnlichen Spots
   *  ungenutzt/0. Das Backend leitet daraus die passende TravelRole (Anreise/Abreise/Weiterreise)
   *  einer Etappe ab (routes/travel.ts's applyPlaces()). */
  is_home: 0 | 1;
  // Zusatzfelder für Spots der Kategorie "Unterkunft" (ehemals eigene Accommodation-Tabelle, siehe
  // Migrationskommentar in db/index.ts) – bei anderen Kategorien einfach null/ungenutzt.
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  checkin: string | null;
  checkout: string | null;
  contact: string | null;
  amount: number | null;
  paid_by_user_id: number | null;
  budget_expense_id: number | null;
  /** Unabhängig von der aus schedule_items abgeleiteten geplant/ungeplant-Anzeige: explizit als
   *  tatsächlich besucht markiert, auch für spontane, nie geplante Besuche nutzbar (siehe
   *  stores/spots.ts's setDone()). */
  done: 0 | 1;
  /** Nur clientseitig gesetzt, siehe PackingItem._pending oben. */
  _pending?: boolean;
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

/** Ein Budget ist entweder persönlich (owner_id gesetzt) oder geteilt (owner_id null). Effektives
 *  Ziel: target_amount gewinnt, falls gesetzt (einfacher Modus); sonst die Summe seiner
 *  Kategorie-Allokationen (detaillierter Modus) - siehe utils/budgetTargets.ts. */
export interface Budget {
  id: number;
  trip_id: number;
  name: string;
  owner_id: number | null;
  target_amount: number | null;
}

/** Kategorien-Anteil innerhalb eines Budgets, nur relevant im detaillierten Modus (kein
 *  target_amount gesetzt). Die Summe aller Allocations eines Budgets ergibt dessen
 *  Ziel-Gesamtsumme in diesem Fall; die Summe über alle Budgets ergibt das Gesamtbudget des Urlaubs. */
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
  /** Nur clientseitig gesetzt, siehe PackingItem._pending oben. */
  _pending?: boolean;
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
  /** Nur clientseitig gesetzt, siehe PackingItem._pending oben. */
  _pending?: boolean;
}

export interface Note {
  id: number;
  trip_id: number;
  title: string | null;
  content: string;
  content_format: string;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  /** Nur clientseitig gesetzt, siehe PackingItem._pending oben. */
  _pending?: boolean;
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
  content_format: string;
  images: string[];
  /** Frei änderbares Datum des Eintrags (YYYY-MM-DD) - unabhängig von created_at, siehe DiaryView.vue. */
  date: string;
  created_at: string;
  updated_at: string | null;
  /** IDs der Ausflüge, die diesem Eintrag zugeordnet sind (z. B. an diesem Tag unternommen). */
  excursion_ids: number[];
  /** Nur clientseitig gesetzt, siehe PackingItem._pending oben. */
  _pending?: boolean;
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

/** Domänen, die Datei-Anhänge (Tickets/Dokumente) tragen können – siehe FileAttachments.vue.
 *  'spots' deckt seit der Verschmelzung von Unterkunft in Spots auch Unterkunft-Anhänge ab (siehe
 *  Migrationskommentar in db/index.ts). */
export type AttachmentDomain = 'travel' | 'spots' | 'notes' | 'schedule' | 'budget';

export interface Attachment {
  id: number;
  trip_id: number;
  domain: AttachmentDomain;
  entity_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: number;
  created_at: string;
  url: string;
}
