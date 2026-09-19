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
// Statisches Asset aus public/demo/ Lissabon-Panorama für den Demo-Build
const demoTripBanner = `${import.meta.env.BASE_URL}demo/lissabon.jpg`;

export interface DemoTrip {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  maps_link: string;
  lat: number;
  lng: number;
  image_url: string;
  packing_category_required: number;
  weather_model: string;
}

export interface DemoDataSet {
  user: User;
  partner: User;
  user3: User;
  user4: User;
  users: User[];
  trip: DemoTrip;
  spots: Spot[];
  schedule: ScheduleItem[];
  excursions: Excursion[];
  budgets: Budget[];
  budgetAllocations: BudgetAllocation[];
  budgetExpenses: BudgetExpense[];
  budgetTransfers: BudgetTransfer[];
  packing: PackingItem[];
  shopping: ShoppingItem[];
  todos: TodoItem[];
  notes: Note[];
  diary: DiaryEntry[];
  spotLikes: Array<{ id: number; spot_id: number; user_id: number }>;
  spotComments: Array<{
    id: number;
    spot_id: number;
    author_id: number;
    content: string;
    created_at: string;
  }>;
  excursionLikes: Array<{ id: number; idea_id: number; user_id: number }>;
  excursionComments: Array<{
    id: number;
    idea_id: number;
    author_id: number;
    content: string;
    created_at: string;
  }>;
  diaryLikes: Array<{ id: number; entry_id: number; user_id: number }>;
  diaryComments: Array<{
    id: number;
    entry_id: number;
    author_id: number;
    content: string;
    created_at: string;
  }>;
}

export function createDemoData(baseDate: Date = new Date()): DemoDataSet {
  const addDays = (days: number): string => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const nowIso = baseDate.toISOString();

  const DEMO_USER: User = {
    id: 1,
    username: 'Mia',
    avatar: '🦊',
    email: 'mia@example.com',
    is_admin: true,
    must_change_password: false,
  };
  const DEMO_PARTNER: User = {
    id: 2,
    username: 'Amari',
    avatar: '🐼',
    email: 'jo@example.com',
    is_admin: false,
    must_change_password: false,
  };
  const DEMO_USER_3: User = {
    id: 3,
    username: 'Alex',
    avatar: '🐱',
    email: 'alex@example.com',
    is_admin: false,
    must_change_password: false,
  };
  const DEMO_USER_4: User = {
    id: 4,
    username: 'Sam',
    avatar: '🐶',
    email: 'sam@example.com',
    is_admin: false,
    must_change_password: false,
  };
  const DEMO_USERS: User[] = [DEMO_USER, DEMO_PARTNER, DEMO_USER_3, DEMO_USER_4];

  const DEMO_TRIP = {
    id: 1,
    name: 'Sommerurlaub Lissabon',
    destination: 'Lissabon, Portugal',
    start_date: addDays(3),
    end_date: addDays(10),
    maps_link: 'https://maps.google.com/?q=Lissabon',
    lat: 38.7223,
    lng: -9.1393,
    image_url: demoTripBanner,
    packing_category_required: 0,
    weather_model: 'ecmwf_ifs025',
  };

  const DEMO_SPOTS: Spot[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Hotel Alfama',
      image_url: null,
      category: 'Unterkunft',
      note: 'Zentrale Lage im Altstadtviertel Alfama, Klimaanlage vorhanden.',
      note_format: 'plain',
      maps_link: 'https://maps.google.com/?q=Alfama+Lissabon',
      lat: 38.72,
      lng: -9.12,
      created_by: 1,
      is_home: 0,
      address: 'Rua de São Pedro 12, 1100-590 Lisboa',
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
    {
      id: 4,
      trip_id: 1,
      title: 'Flughafen BER',
      image_url: null,
      category: 'Flughafen',
      note: null,
      note_format: 'plain',
      maps_link: null,
      lat: 52.3667,
      lng: 13.5033,
      created_by: 1,
      is_home: 1,
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
      id: 5,
      trip_id: 1,
      title: 'Flughafen LIS',
      image_url: null,
      category: 'Flughafen',
      note: null,
      note_format: 'plain',
      maps_link: null,
      lat: 38.7742,
      lng: -9.1342,
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
    {
      id: 6,
      trip_id: 1,
      title: 'Praça do Comércio',
      image_url: null,
      category: 'Sehenswürdigkeit',
      note: null,
      note_format: 'plain',
      maps_link: null,
      lat: 38.7055,
      lng: -9.133,
      created_by: 3,
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
      id: 7,
      trip_id: 1,
      title: 'Castelo de São Jorge',
      image_url: null,
      category: 'Sehenswürdigkeit',
      note: 'Tolle Aussicht.',
      note_format: 'plain',
      maps_link: null,
      lat: 38.718,
      lng: -9.138,
      created_by: 4,
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
      id: 8,
      trip_id: 1,
      title: 'Miradouro de Santa Luzia',
      image_url: null,
      category: 'Aussichtspunkt',
      note: 'Wunderschöner Panoramablick über die roten Ziegeldächer der Alfama bis zum Tejo.',
      note_format: 'plain',
      maps_link: 'https://maps.google.com/?q=Miradouro+de+Santa+Luzia',
      lat: 38.713,
      lng: -9.127,
      created_by: 2,
      is_home: 0,
      address: 'Largo Santa Luzia, 1100-487 Lisboa',
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

  const DEMO_SCHEDULE: ScheduleItem[] = [
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
    {
      id: 3,
      trip_id: 1,
      date: addDays(4),
      end_date: null,
      time: '09:30',
      end_time: '16:00',
      title: 'Panoramatour Alfama & Belém',
      note: 'Start beim Hotel Alfama',
      location: 'Lissabon',
      maps_link: null,
      lat: null,
      lng: null,
      category: 'excursion',
      spot_id: null,
      idea_id: 3,
    },
  ];

  const DEMO_EXCURSIONS: Excursion[] = [
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
      destination_spot_id: null,
    },
    {
      id: 2,
      trip_id: 1,
      title: 'Hinflug',
      image_url: null,
      note: 'Flug TP533',
      note_format: 'plain',
      date: addDays(3),
      created_by: 1,
      spot_ids: [4, 5],
      done: 0,
      role: 'arrival',
      transport_type: 'Flugzeug',
      departure_time: '14:00',
      arrival_time: '16:30',
      checkin_info: 'Terminal 1',
      amount: null,
      paid_by_user_id: null,
      luggage: null,
      seat: '12A, 12B',
      ticket_link: null,
      budget_expense_id: null,
      destination_spot_id: null,
    },
    {
      id: 3,
      trip_id: 1,
      title: 'Panoramatour Alfama & Belém',
      image_url: null,
      note: 'Rundgang vom Aussichtspunkt über die Burg hinunter zum Tejo und mit der historischen Tram weiter nach Belém.',
      note_format: 'plain',
      date: addDays(4),
      created_by: 1,
      spot_ids: [1, 8, 7, 6, 3, 2],
      legs: [
        {
          id: 1,
          position: 0,
          from_spot_id: 1,
          to_spot_id: 8,
          transport_type: 'Zu Fuß',
          departure_time: '09:30',
          arrival_time: '09:45',
          checkin_info: null,
          seat: null,
          luggage: null,
          ticket_link: null,
          note: 'Durch die kleinen Gassen bergauf',
          amount: null,
          paid_by_user_id: null,
          budget_expense_id: null,
        },
        {
          id: 2,
          position: 1,
          from_spot_id: 8,
          to_spot_id: 7,
          transport_type: 'Zu Fuß',
          departure_time: '10:30',
          arrival_time: '10:45',
          checkin_info: null,
          seat: null,
          luggage: null,
          ticket_link: null,
          note: 'Weiter zur Festungsmauer',
          amount: null,
          paid_by_user_id: null,
          budget_expense_id: null,
        },
        {
          id: 3,
          position: 2,
          from_spot_id: 7,
          to_spot_id: 6,
          transport_type: 'Straßenbahn',
          departure_time: '12:00',
          arrival_time: '12:20',
          checkin_info: null,
          seat: 'Tram 28',
          luggage: null,
          ticket_link: null,
          note: 'Historische Tram bergab',
          amount: 3.1,
          paid_by_user_id: 1,
          budget_expense_id: null,
        },
        {
          id: 4,
          position: 3,
          from_spot_id: 6,
          to_spot_id: 3,
          transport_type: 'Zu Fuß',
          departure_time: '13:30',
          arrival_time: '13:45',
          checkin_info: null,
          seat: null,
          luggage: null,
          ticket_link: null,
          note: 'Flaniermeile am Flussufer',
          amount: null,
          paid_by_user_id: null,
          budget_expense_id: null,
        },
        {
          id: 5,
          position: 4,
          from_spot_id: 3,
          to_spot_id: 2,
          transport_type: 'Straßenbahn',
          departure_time: '15:15',
          arrival_time: '15:40',
          checkin_info: null,
          seat: 'Linie 15E',
          luggage: null,
          ticket_link: null,
          note: 'Mit der Tram direkt nach Belém',
          amount: 3.1,
          paid_by_user_id: 2,
          budget_expense_id: null,
        },
      ],
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
      destination_spot_id: null,
    },
    {
      id: 4,
      trip_id: 1,
      title: 'Alfama Spaziergang',
      image_url: null,
      note: 'Durch die kleinen Gassen',
      note_format: 'plain',
      date: addDays(4),
      created_by: 3,
      spot_ids: [1, 7],
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
      destination_spot_id: null,
    },
    {
      id: 5,
      trip_id: 1,
      title: 'Innenstadt',
      image_url: null,
      note: 'Praça do Comércio und Umgebung',
      note_format: 'plain',
      date: addDays(5),
      created_by: 4,
      spot_ids: [6, 3],
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
      destination_spot_id: null,
    },
    {
      id: 6,
      trip_id: 1,
      title: 'Rückflug',
      image_url: null,
      note: 'Flug TP532',
      note_format: 'plain',
      date: addDays(10),
      created_by: 1,
      spot_ids: [5, 4],
      done: 0,
      role: 'departure',
      transport_type: 'Flugzeug',
      departure_time: '09:00',
      arrival_time: '13:30',
      checkin_info: null,
      amount: null,
      paid_by_user_id: null,
      luggage: null,
      seat: '14C, 14D',
      ticket_link: null,
      budget_expense_id: null,
      destination_spot_id: null,
    },
  ];

  const DEMO_BUDGETS: Budget[] = [
    { id: 1, trip_id: 1, name: 'Gemeinsame Kasse', owner_id: null, target_amount: 1200 },
  ];
  const DEMO_BUDGET_ALLOCATIONS: BudgetAllocation[] = [
    { id: 1, budget_id: 1, category: 'Unterkunft', amount: 560 },
    { id: 2, budget_id: 1, category: 'Essen & Trinken', amount: 350 },
    { id: 3, budget_id: 1, category: 'Aktivitäten', amount: 290 },
  ];
  const DEMO_BUDGET_EXPENSES: BudgetExpense[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Anzahlung Apartment',
      category: 'Unterkunft',
      amount: 200,
      paid_by_user_id: 1,
      date: addDays(-10),
      note: null,
      budget_id: 1,
    },
    {
      id: 2,
      trip_id: 1,
      title: 'Zugtickets Sintra',
      category: 'Aktivitäten',
      amount: 24,
      paid_by_user_id: 2,
      date: addDays(-2),
      note: null,
      budget_id: 1,
    },
  ];
  const DEMO_BUDGET_TRANSFERS: BudgetTransfer[] = [];

  const DEMO_PACKING: PackingItem[] = [
    {
      id: 1,
      trip_id: 1,
      category: 'Kleidung',
      subcategory: null,
      label: 'Badesachen',
      quantity: 2,
      laid_out_count: 0,
      packed_count: 0,
      owner_id: null,
    },
    {
      id: 2,
      trip_id: 1,
      category: 'Dokumente',
      subcategory: null,
      label: 'Personalausweis',
      quantity: 2,
      laid_out_count: 2,
      packed_count: 1,
      owner_id: null,
    },
    {
      id: 3,
      trip_id: 1,
      category: 'Technik',
      subcategory: null,
      label: 'Ladekabel',
      quantity: 1,
      laid_out_count: 0,
      packed_count: 0,
      owner_id: 1,
    },
  ];

  const DEMO_SHOPPING: ShoppingItem[] = [
    {
      id: 1,
      trip_id: 1,
      label: 'Sonnencreme',
      assigned_to_user_id: 2,
      checked: 0,
      link: null,
      note: null,
      shop: null,
      period: 'before',
    },
    {
      id: 2,
      trip_id: 1,
      label: 'Reiseadapter',
      assigned_to_user_id: 1,
      checked: 1,
      link: null,
      note: null,
      shop: null,
      period: 'before',
    },
  ];

  const DEMO_TODOS: TodoItem[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Reisepässe auf Gültigkeit prüfen',
      assigned_to_user_id: 1,
      due_date: addDays(-4),
      period: 'before',
      priority: 'high',
      note: 'Muss mind. 6 Monate über das Rückreisedatum hinaus gültig sein',
      done: 1,
    },
    {
      id: 2,
      trip_id: 1,
      title: 'Auslandskrankenversicherung abschließen',
      assigned_to_user_id: 2,
      due_date: addDays(-2),
      period: 'before',
      priority: 'medium',
      note: 'Versicherungsschein als PDF unter Dokumente hinterlegen',
      done: 1,
    },
    {
      id: 3,
      trip_id: 1,
      title: 'Online-Check-in für Hinflug durchführen',
      assigned_to_user_id: 1,
      due_date: addDays(0),
      period: 'before',
      priority: 'high',
      note: 'Öffnet 24 Stunden vor Abflug auf der Airline-Website',
      done: 0,
    },
    {
      id: 4,
      trip_id: 1,
      title: 'Pflanzen gießen & Nachbarn Schlüssel geben',
      assigned_to_user_id: 2,
      due_date: addDays(0),
      period: 'before',
      priority: 'high',
      note: 'Blumen auf dem Balkon gießen und Briefkasten leeren',
      done: 0,
    },
    {
      id: 5,
      trip_id: 1,
      title: 'Viva-Viagem-Karten an Metrostation aufladen',
      assigned_to_user_id: null,
      due_date: addDays(1),
      period: 'during',
      priority: 'medium',
      note: 'Am Fahrkartenautomaten am Flughafen oder Rossio-Bahnhof',
      done: 0,
    },
    {
      id: 6,
      trip_id: 1,
      title: 'Tickets für Mosteiro dos Jerónimos vorab buchen',
      assigned_to_user_id: 1,
      due_date: addDays(2),
      period: 'during',
      priority: 'medium',
      note: 'Zeitfenster-Tickets sichern, um langes Anstehen zu vermeiden',
      done: 0,
    },
    {
      id: 7,
      trip_id: 1,
      title: 'Pastéis de Belém frisch für die Familie besorgen',
      assigned_to_user_id: 2,
      due_date: addDays(8),
      period: 'during',
      priority: 'low',
      note: 'Am Abreisetag frisch in der Antiga Confeitaria de Belém holen',
      done: 0,
    },
  ];

  const DEMO_NOTES: Note[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'Packliste-Ideen',
      content: 'Nicht vergessen: Steckdosenadapter, Regenjacke für den Abend.',
      content_format: 'plain',
      created_by: 1,
      created_at: nowIso,
      updated_at: null,
      is_draft: 0,
    },
  ];

  const DEMO_DIARY: DiaryEntry[] = [
    {
      id: 1,
      trip_id: 1,
      author_id: 1,
      title: 'Ankunft',
      content: 'Nach der Landung direkt in die Altstadt - schon jetzt ein toller erster Eindruck.',
      content_format: 'plain',
      images: [],
      date: addDays(3),
      created_at: nowIso,
      updated_at: null,
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      is_draft: 0,
    },
  ];

  const DEMO_SPOT_LIKES = [
    { id: 1, spot_id: 2, user_id: 3 },
    { id: 2, spot_id: 2, user_id: 4 },
  ];
  const DEMO_SPOT_COMMENTS = [
    {
      id: 1,
      spot_id: 2,
      author_id: 3,
      content: 'Da will ich unbedingt hin!',
      created_at: nowIso,
    },
  ];

  const DEMO_EXCURSION_LIKES = [
    { id: 1, idea_id: 1, user_id: 2 },
    { id: 2, idea_id: 3, user_id: 2 },
  ];
  const DEMO_EXCURSION_COMMENTS = [
    {
      id: 1,
      idea_id: 1,
      author_id: 2,
      content: 'Klingt super!',
      created_at: nowIso,
    },
    {
      id: 2,
      idea_id: 3,
      author_id: 2,
      content: 'Die Route ist perfekt für den ersten vollen Tag!',
      created_at: nowIso,
    },
  ];

  const DEMO_DIARY_LIKES = [{ id: 1, entry_id: 1, user_id: 4 }];
  const DEMO_DIARY_COMMENTS = [
    {
      id: 1,
      entry_id: 1,
      author_id: 4,
      content: 'Toller Start!',
      created_at: nowIso,
    },
  ];

  return {
    user: DEMO_USER,
    partner: DEMO_PARTNER,
    user3: DEMO_USER_3,
    user4: DEMO_USER_4,
    users: DEMO_USERS,
    trip: DEMO_TRIP,
    spots: DEMO_SPOTS,
    schedule: DEMO_SCHEDULE,
    excursions: DEMO_EXCURSIONS,
    budgets: DEMO_BUDGETS,
    budgetAllocations: DEMO_BUDGET_ALLOCATIONS,
    budgetExpenses: DEMO_BUDGET_EXPENSES,
    budgetTransfers: DEMO_BUDGET_TRANSFERS,
    packing: DEMO_PACKING,
    shopping: DEMO_SHOPPING,
    todos: DEMO_TODOS,
    notes: DEMO_NOTES,
    diary: DEMO_DIARY,
    spotLikes: DEMO_SPOT_LIKES,
    spotComments: DEMO_SPOT_COMMENTS,
    excursionLikes: DEMO_EXCURSION_LIKES,
    excursionComments: DEMO_EXCURSION_COMMENTS,
    diaryLikes: DEMO_DIARY_LIKES,
    diaryComments: DEMO_DIARY_COMMENTS,
  };
}

const defaultData = createDemoData();
export const DEMO_USER = defaultData.user;
export const DEMO_PARTNER = defaultData.partner;
export const DEMO_USER_3 = defaultData.user3;
export const DEMO_USER_4 = defaultData.user4;
export const DEMO_USERS = defaultData.users;
export const DEMO_TRIP = defaultData.trip;
export const DEMO_SPOTS = defaultData.spots;
export const DEMO_SCHEDULE = defaultData.schedule;
export const DEMO_EXCURSIONS = defaultData.excursions;
export const DEMO_BUDGETS = defaultData.budgets;
export const DEMO_BUDGET_ALLOCATIONS = defaultData.budgetAllocations;
export const DEMO_BUDGET_EXPENSES = defaultData.budgetExpenses;
export const DEMO_BUDGET_TRANSFERS = defaultData.budgetTransfers;
export const DEMO_PACKING = defaultData.packing;
export const DEMO_SHOPPING = defaultData.shopping;
export const DEMO_TODOS = defaultData.todos;
export const DEMO_NOTES = defaultData.notes;
export const DEMO_DIARY = defaultData.diary;
export const DEMO_SPOT_LIKES = defaultData.spotLikes;
export const DEMO_SPOT_COMMENTS = defaultData.spotComments;
export const DEMO_EXCURSION_LIKES = defaultData.excursionLikes;
export const DEMO_EXCURSION_COMMENTS = defaultData.excursionComments;
export const DEMO_DIARY_LIKES = defaultData.diaryLikes;
export const DEMO_DIARY_COMMENTS = defaultData.diaryComments;
