import bcrypt from 'bcrypt';
import { db, ensureDefaultSharedBudget } from './index.js';
import { tilePreviewUrl } from '../utils/mapsLink.js';

// Demo-Seed für Sandbox-/Dev-Umgebungen: legt zusätzlich zu den 2 Standard-Nutzern (wie seed.ts)
// einen kompletten Beispiel-Urlaub mit Daten in allen Bereichen an, damit eine frische Instanz
// sofort "voll" aussieht und sich Änderungen ohne manuelles Anlegen von Trip/Unterkunft/Budget
// etc. testen lassen. Läuft NIE auf dem Produktions-Pi (siehe deploy.sh/README) – nur lokal/in
// Sandboxes. Bricht ab, statt Duplikate anzulegen, falls schon ein Urlaub existiert.
const existingTrip = db.prepare('SELECT id FROM trips LIMIT 1').get();
if (existingTrip) {
  console.log('Demo-Seed übersprungen: es existiert bereits mindestens ein Urlaub.');
  process.exit(0);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const users = [
  {
    username: process.env.SEED_USER1 ?? 'user1',
    password: process.env.SEED_PASS1 ?? 'changeme1',
    avatar: process.env.SEED_AVATAR1 ?? '🧑',
  },
  {
    username: process.env.SEED_USER2 ?? 'user2',
    password: process.env.SEED_PASS2 ?? 'changeme2',
    avatar: process.env.SEED_AVATAR2 ?? '👩',
  },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, ?)'
);
for (let i = 0; i < users.length; i++) {
  const u = users[i];
  insertUser.run(u.username, bcrypt.hashSync(u.password, 10), u.avatar, i === 0 ? 1 : 0, 0);
}
const [user1, user2] = users.map(
  (u) => db.prepare('SELECT id FROM users WHERE username = ?').get(u.username) as { id: number }
);

const today = new Date();
const startDate = addDays(today, 14);
const endDate = addDays(today, 24);
const LISBON = { lat: 38.7223, lng: -9.1393 };

const tripResult = db
  .prepare(
    `INSERT INTO trips (name, destination, start_date, end_date, maps_link, lat, lng, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .run(
    'Sommerurlaub Lissabon',
    'Lissabon, Portugal',
    fmt(startDate),
    fmt(endDate),
    null,
    LISBON.lat,
    LISBON.lng,
    tilePreviewUrl(LISBON.lat, LISBON.lng)
  );
const tripId = tripResult.lastInsertRowid as number;

// Ohne diese Zeilen wäre der Demo-Urlaub für beide Seed-Nutzer:innen unsichtbar (siehe
// trip_members-Mitgliedschaftskonzept in tripAccess.ts) – normalerweise legt die POST /trips-Route
// das für den anlegenden Account automatisch an, dieses Skript umgeht die Route aber per Direkt-SQL.
const insertMembership = db.prepare(
  'INSERT OR IGNORE INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)'
);
const membershipNow = new Date().toISOString();
insertMembership.run(tripId, user1.id, membershipNow);
insertMembership.run(tripId, user2.id, membershipNow);

// --- Budget: Kategorien-Allokationen des automatisch angelegten "Gemeinsamen Budgets" befüllen ---
const sharedBudgetId = ensureDefaultSharedBudget(tripId);
const allocations: Record<string, number> = {
  'Essen & Trinken': 400,
  Unterkunft: 600,
  Transport: 350,
  'Aktivitäten & Spaß': 200,
  Souvenirs: 80,
  Sonstiges: 100,
};
const updateAllocation = db.prepare(
  'UPDATE budget_allocations SET amount = ? WHERE budget_id = ? AND category = ?'
);
for (const [category, amount] of Object.entries(allocations)) {
  updateAllocation.run(amount, sharedBudgetId, category);
}

const insertExpense = db.prepare(
  `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

// --- Unterkunft (inkl. automatisch verknüpfter Budget-Ausgabe, analog spots.ts's planBudgetExpense)
// – seit der Verschmelzung von Unterkunft in Spots (siehe Migrationskommentar in db/index.ts) ein
// ganz normaler Spot der Kategorie "Unterkunft" statt einer eigenen Tabelle. ---
const accommodationAmount = 540;
const accommodationExpenseId = insertExpense.run(
  tripId,
  'Hotel Alfama',
  'Unterkunft',
  accommodationAmount,
  user1.id,
  fmt(startDate),
  'Automatisch aus Unterkunft-Eintrag',
  sharedBudgetId
).lastInsertRowid as number;

db.prepare(
  `INSERT INTO spots
    (trip_id, title, category, note, maps_link, lat, lng, address, start_date, end_date,
     checkin, checkout, contact, amount, paid_by_user_id, budget_expense_id)
   VALUES (?, ?, 'Unterkunft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  tripId,
  'Hotel Alfama',
  'Zentrale Lage im Altstadtviertel Alfama, Klimaanlage vorhanden.',
  null,
  LISBON.lat + 0.0015,
  LISBON.lng + 0.001,
  'Rua de São Pedro 12, 1100-590 Lisboa',
  fmt(startDate),
  fmt(endDate),
  '15:00',
  '11:00',
  'reservas@hotelalfama.example',
  accommodationAmount,
  user1.id,
  accommodationExpenseId
);

// --- Weitere Budget-Ausgaben (manuell, ohne Verknüpfung) ---
insertExpense.run(
  tripId,
  'Abendessen Time Out Market',
  'Essen & Trinken',
  42.5,
  user1.id,
  fmt(addDays(startDate, 1)),
  null,
  sharedBudgetId
);
insertExpense.run(
  tripId,
  'Tickets Torre de Belém',
  'Aktivitäten & Spaß',
  12,
  user2.id,
  fmt(addDays(startDate, 2)),
  null,
  sharedBudgetId
);
insertExpense.run(
  tripId,
  'Azulejo-Kacheln als Souvenir',
  'Souvenirs',
  24.9,
  user1.id,
  fmt(addDays(startDate, 3)),
  null,
  sharedBudgetId
);

// --- Überweisung (Schulden begleichen) ---
db.prepare(
  'INSERT INTO budget_transfers (trip_id, from_user_id, to_user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)'
).run(tripId, user2.id, user1.id, 120, fmt(addDays(startDate, 4)), 'Teilausgleich für Hotel');

// --- Ablauf/Kalender ---
const insertSchedule = db.prepare(
  `INSERT INTO schedule_items (trip_id, date, end_date, time, title, note, location, category)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'other')`
);
insertSchedule.run(
  tripId,
  fmt(addDays(startDate, 1)),
  null,
  '19:30',
  'Abendessen im Time Out Market',
  'Tisch für 2 reservieren',
  'Time Out Market, Lissabon'
);
insertSchedule.run(
  tripId,
  fmt(addDays(startDate, 2)),
  null,
  '10:00',
  'Torre de Belém besichtigen',
  null,
  'Torre de Belém'
);
insertSchedule.run(
  tripId,
  fmt(addDays(startDate, 5)),
  null,
  '09:00',
  'Tagesausflug nach Sintra',
  'Zug ab Rossio-Bahnhof',
  'Sintra'
);

// --- Packliste (pro Nutzer + gemeinsam) ---
// packed_count/laid_out_count statt des alten booleschen "checked" (per Migration in db/index.ts
// entfernt) - bei "gepackt" beide auf quantity (Default 1) setzen, sonst beide 0.
const insertPacking = db.prepare(
  'INSERT INTO packing_items (trip_id, category, label, owner_id, packed_count, laid_out_count) VALUES (?, ?, ?, ?, ?, ?)'
);
insertPacking.run(tripId, 'Kleidung', 'Badehose', user1.id, 0, 0);
insertPacking.run(tripId, 'Kleidung', 'Sommerkleid', user2.id, 0, 0);
insertPacking.run(tripId, 'Elektronik', 'Reiseadapter', null, 1, 1);
insertPacking.run(tripId, 'Elektronik', 'Powerbank', null, 0, 0);
insertPacking.run(tripId, 'Dokumente', 'Reisepass', user1.id, 0, 0);
insertPacking.run(tripId, 'Dokumente', 'Reisepass', user2.id, 0, 0);

// --- Einkaufsliste ---
const insertShopping = db.prepare(
  'INSERT INTO shopping_items (trip_id, label, assigned_to_user_id, checked, link, note, shop, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
insertShopping.run(tripId, 'Sonnencreme', user2.id, 0, null, null, 'dm', 'before');
insertShopping.run(tripId, 'Reiseführer Lissabon', user1.id, 1, null, null, null, 'before');
insertShopping.run(tripId, 'Postkarten', null, 0, null, null, null, 'during');

// --- Ausflugsideen & Spots (Karte) ---
const insertSpot = db.prepare(
  `INSERT INTO spots (trip_id, title, image_url, category, note, maps_link, lat, lng, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const belemLat = 38.6916;
const belemLng = -9.2159;
const belemSpotId = insertSpot.run(
  tripId,
  'Torre de Belém',
  tilePreviewUrl(belemLat, belemLng),
  'Sehenswürdigkeit',
  'Ikonischer Wehrturm direkt am Tejo.',
  null,
  belemLat,
  belemLng,
  user1.id
).lastInsertRowid as number;

const marketLat = 38.7075;
const marketLng = -9.1459;
const marketSpotId = insertSpot.run(
  tripId,
  'Time Out Market',
  tilePreviewUrl(marketLat, marketLng),
  'Restaurant',
  'Große Markthalle mit vielen Ständen bekannter Lissabonner Restaurants.',
  null,
  marketLat,
  marketLng,
  user2.id
).lastInsertRowid as number;

db.prepare('INSERT INTO spot_likes (spot_id, user_id, created_at) VALUES (?, ?, ?)').run(
  belemSpotId,
  user2.id,
  new Date().toISOString()
);
db.prepare(
  'INSERT INTO spot_comments (spot_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
).run(
  belemSpotId,
  user2.id,
  'Unbedingt früh morgens hin, bevor die Reisebusse kommen!',
  new Date().toISOString()
);

// --- Reise/Transport: Hin- und Rückflug (#176: Touren mit gesetzter role statt einer eigenen
// travel_items-Tabelle - Von/Nach sind ganz normale Spots, genau wie bei einer Unterkunft) ---
const insertHomeSpot = db.prepare(
  'INSERT INTO spots (trip_id, title, category, is_home) VALUES (?, ?, ?, 1)'
);
const berlinSpotId = insertHomeSpot.run(tripId, 'Berlin (BER)', 'Flughafen')
  .lastInsertRowid as number;
// Eigene Koordinaten statt LISBON (Altstadt-Zentrum) - sonst läge der Flughafen-Pin praktisch
// deckungsgleich auf dem "Hotel Alfama"-Pin (LISBON.lat/lng + kleinem Offset). Bewusst nur wenige
// hundert Meter versetzt statt der echten ~7km zum tatsächlichen Flughafen Lissabon: ein Punkt so
// weit außerhalb der übrigen Spots (Belém/Market, siehe belemLat/marketLat oben) zwingt
// TripMap.vue's Default-fitBounds zu einem so starken Zoom-Out, dass die übrigen, eng
// beieinanderliegenden Spot-Pins auf kleinen Viewports (Mobil) sichtbar überlappen (e2e:
// map-focus-covered-drawer.spec.ts).
const LISBON_AIRPORT = { lat: 38.735, lng: -9.13 };
const lisbonAirportSpotId = insertSpot.run(
  tripId,
  'Lissabon (LIS)',
  null,
  'Flughafen',
  null,
  null,
  LISBON_AIRPORT.lat,
  LISBON_AIRPORT.lng,
  user1.id
).lastInsertRowid as number;

const insertTravelIdea = db.prepare(
  `INSERT INTO ideas (
    trip_id, title, note, created_by, role, transport_type, departure_time, arrival_time,
    checkin_info, amount, paid_by_user_id, luggage, seat, budget_expense_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertTravelStation = db.prepare(
  'INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)'
);
const insertTravelSchedule = db.prepare(
  'INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)'
);

const outboundExpenseId = insertExpense.run(
  tripId,
  'Hinflug nach Lissabon',
  'Transport',
  189,
  user2.id,
  fmt(startDate),
  'Automatisch aus Tour',
  sharedBudgetId
).lastInsertRowid as number;
const outboundIdeaId = insertTravelIdea.run(
  tripId,
  'Hinflug nach Lissabon',
  'Direktflug',
  user2.id,
  'arrival',
  'Flug',
  '07:20',
  '10:05',
  'Online-Check-in ab 24h vorher',
  189,
  user2.id,
  '1x 23kg Koffer',
  '14C',
  outboundExpenseId
).lastInsertRowid as number;
insertTravelStation.run(outboundIdeaId, berlinSpotId, 0);
insertTravelStation.run(outboundIdeaId, lisbonAirportSpotId, 1);
insertTravelSchedule.run(tripId, fmt(startDate), 'Hinflug nach Lissabon', outboundIdeaId);

const returnExpenseId = insertExpense.run(
  tripId,
  'Rückflug nach Berlin',
  'Transport',
  189,
  user1.id,
  fmt(endDate),
  'Automatisch aus Tour',
  sharedBudgetId
).lastInsertRowid as number;
const returnIdeaId = insertTravelIdea.run(
  tripId,
  'Rückflug nach Berlin',
  'Direktflug',
  user1.id,
  'departure',
  'Flug',
  '18:40',
  '22:15',
  null,
  189,
  user1.id,
  '1x 23kg Koffer',
  '9A',
  returnExpenseId
).lastInsertRowid as number;
insertTravelStation.run(returnIdeaId, lisbonAirportSpotId, 0);
insertTravelStation.run(returnIdeaId, berlinSpotId, 1);
insertTravelSchedule.run(tripId, fmt(endDate), 'Rückflug nach Berlin', returnIdeaId);

const ideaResult = db
  .prepare('INSERT INTO ideas (trip_id, title, image_url, note, created_by) VALUES (?, ?, ?, ?, ?)')
  .run(tripId, 'Sightseeing-Tag Belém', null, 'Turm + danach im Market essen', user1.id);
const ideaId = ideaResult.lastInsertRowid as number;
const insertStation = db.prepare(
  'INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)'
);
insertStation.run(ideaId, belemSpotId, 0);
insertStation.run(ideaId, marketSpotId, 1);
// "Geplant" ergibt sich aus einem verknüpften Kalender-Termin statt einer eigenen Datums-Spalte
// auf dem Ausflug (siehe Kommentar in db/index.ts/routes/ideas.ts).
db.prepare('INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)').run(
  tripId,
  fmt(addDays(startDate, 2)),
  'Sightseeing-Tag Belém',
  ideaId
);

db.prepare('INSERT INTO idea_likes (idea_id, user_id, created_at) VALUES (?, ?, ?)').run(
  ideaId,
  user2.id,
  new Date().toISOString()
);
db.prepare(
  'INSERT INTO idea_comments (idea_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
).run(ideaId, user2.id, 'Klingt gut, sollten wir früh starten!', new Date().toISOString());

// --- Tagebuch ---
const diaryResult = db
  .prepare(
    'INSERT INTO diary_entries (trip_id, author_id, title, content, images, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
  .run(
    tripId,
    user1.id,
    'Ankunft in Lissabon',
    'Nach dem Flug direkt ins Hotel und dann noch einen Abendspaziergang durch die Alfama gemacht. Traumhafter Blick vom Miradouro!',
    JSON.stringify([]),
    new Date().toISOString()
  );
const diaryEntryId = diaryResult.lastInsertRowid as number;
db.prepare('INSERT INTO diary_likes (entry_id, user_id, created_at) VALUES (?, ?, ?)').run(
  diaryEntryId,
  user2.id,
  new Date().toISOString()
);
db.prepare(
  'INSERT INTO diary_comments (entry_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
).run(
  diaryEntryId,
  user2.id,
  'Sieht traumhaft aus, ich freu mich schon!',
  new Date().toISOString()
);

// --- Notizen ---
db.prepare(
  'INSERT INTO notes (trip_id, title, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
).run(
  tripId,
  'WLAN & Notfallkontakte',
  'Hotel-WLAN: siehe Zimmerkarte. Notfallnummer Portugal: 112.',
  user1.id,
  new Date().toISOString()
);

console.log(
  `Demo-Seed abgeschlossen: Trip "${tripId}" mit Unterkunft, Reise, Kalender, Packliste, Einkaufsliste, Ausflug/Spots, Budget, Tagebuch und Notiz angelegt.`
);
