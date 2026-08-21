// Dummy-Datensatz für den backend-losen Demo-Build (Issue #172) - angelehnt an
// backend/src/db/seedDemo.ts (ein Trip, zwei Nutzer:innen, Daten in allen Bereichen), aber als
// reine TS-Objekte passend zu api/types.ts statt SQL-Zeilen. Relative Daten (heute ± n Tage) wie
// im Backend-Seed, damit die Demo immer aktuell wirkt.
import type {
  Budget,
  BudgetAllocation,
  BudgetExpense,
  BudgetTransfer,
  DiaryEntry,
  Excursion,
  Note,
  PackingItem,
  ScheduleItem,
  ShoppingItem,
  Spot,
  TodoItem,
  User,
} from '../api/types';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEMO_USER: User = { id: 1, username: 'Mika', avatar: '🧑‍🚀' };
const DEMO_PARTNER: User = { id: 2, username: 'Jo', avatar: '🧑‍🎨' };
export const DEMO_USERS: User[] = [DEMO_USER, DEMO_PARTNER];

export const DEMO_TRIP = {
  id: 1,
  name: 'Sommerurlaub Lissabon',
  destination: 'Lissabon, Portugal',
  start_date: addDays(3),
  end_date: addDays(10),
  maps_link: 'https://maps.google.com/?q=Lissabon',
  lat: 38.7223,
  lng: -9.1393,
  image_url: null,
  packing_category_required: 0,
};

export const DEMO_SPOTS: Spot[] = [
  {
    id: 1,
    trip_id: 1,
    title: 'Casa Alfama',
    image_url: null,
    category: 'Unterkunft',
    note: 'Gemütliches Apartment in der Altstadt, 2 Min. zur Tram 28.',
    note_format: 'plain',
    maps_link: 'https://maps.google.com/?q=Alfama+Lissabon',
    lat: 38.7124,
    lng: -9.1303,
    created_by: 1,
    is_home: 0,
    address: 'Rua de São Miguel 12, Lissabon',
    start_date: addDays(3),
    end_date: addDays(10),
    checkin: '15:00',
    checkout: '11:00',
    contact: '+351 21 000 0000',
    amount: 560,
    paid_by_user_id: 1,
    budget_expense_id: null,
    done: 0,
  },
  {
    id: 2,
    trip_id: 1,
    title: 'Torre de Belém',
    image_url: null,
    category: 'Sehenswürdigkeit',
    note: 'Unbedingt früh morgens, wird schnell voll.',
    note_format: 'plain',
    maps_link: 'https://maps.google.com/?q=Torre+de+Belem',
    lat: 38.6916,
    lng: -9.2159,
    created_by: 2,
    is_home: 0,
    address: null,
    start_date: null,
    end_date: null,
    checkin: null,
    checkout: null,
    contact: null,
    amount: null,
    paid_by_user_id: null,
    budget_expense_id: null,
    done: 0,
  },
  {
    id: 3,
    trip_id: 1,
    title: 'Time Out Market',
    image_url: null,
    category: 'Restaurant',
    note: 'Gute Auswahl für beide.',
    note_format: 'plain',
    maps_link: null,
    lat: 38.7069,
    lng: -9.1459,
    created_by: 1,
    is_home: 0,
    address: null,
    start_date: null,
    end_date: null,
    checkin: null,
    checkout: null,
    contact: null,
    amount: null,
    paid_by_user_id: null,
    budget_expense_id: null,
    done: 0,
  },
];

export const DEMO_SCHEDULE: ScheduleItem[] = [
  {
    id: 1,
    trip_id: 1,
    date: addDays(4),
    end_date: null,
    time: '09:00',
    end_time: '11:00',
    title: 'Torre de Belém besichtigen',
    note: null,
    location: null,
    maps_link: null,
    lat: null,
    lng: null,
    category: 'excursion',
    spot_id: 2,
    idea_id: null,
  },
  {
    id: 2,
    trip_id: 1,
    date: addDays(5),
    end_date: null,
    time: '19:00',
    end_time: null,
    title: 'Abendessen im Time Out Market',
    note: null,
    location: null,
    maps_link: null,
    lat: null,
    lng: null,
    category: 'other',
    spot_id: 3,
    idea_id: null,
  },
];

export const DEMO_EXCURSIONS: Excursion[] = [
  {
    id: 1,
    trip_id: 1,
    title: 'Tagestour Sintra',
    image_url: null,
    note: 'Mit dem Zug ab Rossio, ca. 40 Minuten.',
    note_format: 'plain',
    date: addDays(6),
    created_by: 1,
    spot_ids: [],
    done: 0,
    role: null,
    transport_type: null,
    departure_time: null,
    arrival_time: null,
    checkin_info: null,
    amount: null,
    paid_by_user_id: null,
    luggage: null,
    seat: null,
    ticket_link: null,
    budget_expense_id: null,
  },
];

export const DEMO_BUDGETS: Budget[] = [{ id: 1, trip_id: 1, name: 'Gemeinsame Kasse', owner_id: null, target_amount: 1200 }];
export const DEMO_BUDGET_ALLOCATIONS: BudgetAllocation[] = [
  { id: 1, budget_id: 1, category: 'Unterkunft', amount: 560 },
  { id: 2, budget_id: 1, category: 'Essen & Trinken', amount: 350 },
  { id: 3, budget_id: 1, category: 'Aktivitäten', amount: 290 },
];
export const DEMO_BUDGET_EXPENSES: BudgetExpense[] = [
  { id: 1, trip_id: 1, title: 'Anzahlung Apartment', category: 'Unterkunft', amount: 200, paid_by_user_id: 1, date: addDays(-10), note: null, budget_id: 1 },
  { id: 2, trip_id: 1, title: 'Zugtickets Sintra', category: 'Aktivitäten', amount: 24, paid_by_user_id: 2, date: addDays(-2), note: null, budget_id: 1 },
];
export const DEMO_BUDGET_TRANSFERS: BudgetTransfer[] = [];

export const DEMO_PACKING: PackingItem[] = [
  { id: 1, trip_id: 1, category: 'Kleidung', subcategory: null, label: 'Badesachen', quantity: 2, laid_out_count: 0, packed_count: 0, owner_id: null },
  { id: 2, trip_id: 1, category: 'Dokumente', subcategory: null, label: 'Personalausweis', quantity: 2, laid_out_count: 2, packed_count: 1, owner_id: null },
  { id: 3, trip_id: 1, category: 'Technik', subcategory: null, label: 'Ladekabel', quantity: 1, laid_out_count: 0, packed_count: 0, owner_id: 1 },
];

export const DEMO_SHOPPING: ShoppingItem[] = [
  { id: 1, trip_id: 1, label: 'Sonnencreme', assigned_to_user_id: 2, checked: 0, link: null, note: null, shop: null, period: 'before' },
  { id: 2, trip_id: 1, label: 'Reiseadapter', assigned_to_user_id: 1, checked: 1, link: null, note: null, shop: null, period: 'before' },
];

export const DEMO_TODOS: TodoItem[] = [
  { id: 1, trip_id: 1, title: 'Wohnung gießen lassen', assigned_to_user_id: 1, due_date: addDays(2), priority: 'high', note: null, done: 0 },
  { id: 2, trip_id: 1, title: 'Reisepässe prüfen', assigned_to_user_id: 2, due_date: addDays(1), priority: 'medium', note: null, done: 1 },
];

export const DEMO_NOTES: Note[] = [
  {
    id: 1,
    trip_id: 1,
    title: 'Packliste-Ideen',
    content: 'Nicht vergessen: Steckdosenadapter, Regenjacke für den Abend.',
    content_format: 'plain',
    created_by: 1,
    created_at: new Date().toISOString(),
    updated_at: null,
    is_draft: 0,
  },
];

export const DEMO_DIARY: DiaryEntry[] = [
  {
    id: 1,
    trip_id: 1,
    author_id: 1,
    title: 'Ankunft',
    content: 'Nach der Landung direkt in die Altstadt - schon jetzt ein toller erster Eindruck.',
    content_format: 'plain',
    images: [],
    date: addDays(3),
    created_at: new Date().toISOString(),
    updated_at: null,
    excursion_ids: [],
    editor_ids: [],
    is_draft: 0,
  },
];
