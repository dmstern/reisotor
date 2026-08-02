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
  'INSERT OR IGNORE INTO users (username, password_hash, avatar) VALUES (?, ?, ?)',
);
for (const u of users) {
  insertUser.run(u.username, bcrypt.hashSync(u.password, 10), u.avatar);
}
const [user1, user2] = users.map(
  (u) => db.prepare('SELECT id FROM users WHERE username = ?').get(u.username) as { id: number },
);

const today = new Date();
const startDate = addDays(today, 14);
const endDate = addDays(today, 24);
const LISBON = { lat: 38.7223, lng: -9.1393 };

const tripResult = db
  .prepare(
    `INSERT INTO trips (name, destination, start_date, end_date, maps_link, lat, lng, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  .run(
    'Sommerurlaub Lissabon',
    'Lissabon, Portugal',
    fmt(startDate),
    fmt(endDate),
    null,
    LISBON.lat,
    LISBON.lng,
    tilePreviewUrl(LISBON.lat, LISBON.lng),
  );
const tripId = tripResult.lastInsertRowid as number;

// Ohne diese Zeilen wäre der Demo-Urlaub für beide Seed-Nutzer:innen unsichtbar (siehe
// trip_members-Mitgliedschaftskonzept in tripAccess.ts) – normalerweise legt die POST /trips-Route
// das für den anlegenden Account automatisch an, dieses Skript umgeht die Route aber per Direkt-SQL.
const insertMembership = db.prepare(
  'INSERT OR IGNORE INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)',
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
  'UPDATE budget_allocations SET amount = ? WHERE budget_id = ? AND category = ?',
);
for (const [category, amount] of Object.entries(allocations)) {
  updateAllocation.run(amount, sharedBudgetId, category);
}

const insertExpense = db.prepare(
  `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

// --- Unterkunft (inkl. automatisch verknüpfter Budget-Ausgabe, analog routes/accommodation.ts) ---
const accommodationAmount = 540;
const accommodationExpenseId = insertExpense.run(
  tripId,
  'Hotel Alfama',
  'Unterkunft',
  accommodationAmount,
  user1.id,
  fmt(startDate),
  'Automatisch aus Unterkunft-Eintrag',
  sharedBudgetId,
).lastInsertRowid as number;

db.prepare(
  `INSERT INTO accommodation
    (trip_id, name, address, maps_link, start_date, end_date, checkin, checkout, contact, note, lat, lng,
     amount, paid_by_user_id, budget_expense_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
).run(
  tripId,
  'Hotel Alfama',
  'Rua de São Pedro 12, 1100-590 Lisboa',
  null,
  fmt(startDate),
  fmt(endDate),
  '15:00',
  '11:00',
  'reservas@hotelalfama.example',
  'Zentrale Lage im Altstadtviertel Alfama, Klimaanlage vorhanden.',
  LISBON.lat + 0.0015,
  LISBON.lng + 0.001,
  accommodationAmount,
  user1.id,
  accommodationExpenseId,
);

// --- Reise/Transport: Hin- und Rückflug (inkl. automatisch verknüpfter Budget-Ausgabe) ---
const insertTravel = db.prepare(
  `INSERT INTO travel_items
    (trip_id, title, type, from_location, to_location, date, departure_time, arrival_time, checkin_info, amount,
     paid_by_user_id, luggage, seat, note, budget_expense_id, role)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const outboundExpenseId = insertExpense.run(
  tripId,
  'Hinflug nach Lissabon',
  'Transport',
  189,
  user2.id,
  fmt(startDate),
  'Automatisch aus Reise-Eintrag',
  sharedBudgetId,
).lastInsertRowid as number;
insertTravel.run(
  tripId,
  'Hinflug nach Lissabon',
  'flight',
  'Berlin (BER)',
  'Lissabon (LIS)',
  fmt(startDate),
  '07:20',
  '10:05',
  'Online-Check-in ab 24h vorher',
  189,
  user2.id,
  '1x 23kg Koffer',
  '14C',
  'Direktflug',
  outboundExpenseId,
  'arrival',
);

const returnExpenseId = insertExpense.run(
  tripId,
  'Rückflug nach Berlin',
  'Transport',
  189,
  user1.id,
  fmt(endDate),
  'Automatisch aus Reise-Eintrag',
  sharedBudgetId,
).lastInsertRowid as number;
insertTravel.run(
  tripId,
  'Rückflug nach Berlin',
  'flight',
  'Lissabon (LIS)',
  'Berlin (BER)',
  fmt(endDate),
  '18:40',
  '22:15',
  null,
  189,
  user1.id,
  '1x 23kg Koffer',
  '9A',
  'Direktflug',
  returnExpenseId,
  'departure',
);

// --- Weitere Budget-Ausgaben (manuell, ohne Verknüpfung) ---
insertExpense.run(tripId, 'Abendessen Time Out Market', 'Essen & Trinken', 42.5, user1.id, fmt(addDays(startDate, 1)), null, sharedBudgetId);
insertExpense.run(tripId, 'Tickets Torre de Belém', 'Aktivitäten & Spaß', 12, user2.id, fmt(addDays(startDate, 2)), null, sharedBudgetId);
insertExpense.run(tripId, 'Azulejo-Kacheln als Souvenir', 'Souvenirs', 24.9, user1.id, fmt(addDays(startDate, 3)), null, sharedBudgetId);

// --- Überweisung (Schulden begleichen) ---
db.prepare(
  'INSERT INTO budget_transfers (trip_id, from_user_id, to_user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)',
).run(tripId, user2.id, user1.id, 120, fmt(addDays(startDate, 4)), 'Teilausgleich für Hotel');

// --- Ablauf/Kalender ---
const insertSchedule = db.prepare(
  `INSERT INTO schedule_items (trip_id, date, end_date, time, title, note, location, category)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'other')`,
);
insertSchedule.run(tripId, fmt(addDays(startDate, 1)), null, '19:30', 'Abendessen im Time Out Market', 'Tisch für 2 reservieren', 'Time Out Market, Lissabon');
insertSchedule.run(tripId, fmt(addDays(startDate, 2)), null, '10:00', 'Torre de Belém besichtigen', null, 'Torre de Belém');
insertSchedule.run(tripId, fmt(addDays(startDate, 5)), null, '09:00', 'Tagesausflug nach Sintra', 'Zug ab Rossio-Bahnhof', 'Sintra');

// --- Packliste (pro Nutzer + gemeinsam) ---
// packed_count/laid_out_count statt des alten booleschen "checked" (per Migration in db/index.ts
// entfernt) - bei "gepackt" beide auf quantity (Default 1) setzen, sonst beide 0.
const insertPacking = db.prepare(
  'INSERT INTO packing_items (trip_id, category, label, owner_id, packed_count, laid_out_count) VALUES (?, ?, ?, ?, ?, ?)',
);
insertPacking.run(tripId, 'Kleidung', 'Badehose', user1.id, 0, 0);
insertPacking.run(tripId, 'Kleidung', 'Sommerkleid', user2.id, 0, 0);
insertPacking.run(tripId, 'Elektronik', 'Reiseadapter', null, 1, 1);
insertPacking.run(tripId, 'Elektronik', 'Powerbank', null, 0, 0);
insertPacking.run(tripId, 'Dokumente', 'Reisepass', user1.id, 0, 0);
insertPacking.run(tripId, 'Dokumente', 'Reisepass', user2.id, 0, 0);

// --- Einkaufsliste ---
const insertShopping = db.prepare(
  'INSERT INTO shopping_items (trip_id, label, assigned_to_user_id, checked, link, note, shop, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);
insertShopping.run(tripId, 'Sonnencreme', user2.id, 0, null, null, 'dm', 'before');
insertShopping.run(tripId, 'Reiseführer Lissabon', user1.id, 1, null, null, null, 'before');
insertShopping.run(tripId, 'Postkarten', null, 0, null, null, null, 'during');

// --- Ausflugsideen & Spots (Karte) ---
const insertSpot = db.prepare(
  `INSERT INTO spots (trip_id, title, image_url, category, note, maps_link, lat, lng, created_by)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  user1.id,
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
  user2.id,
).lastInsertRowid as number;

db.prepare('INSERT INTO spot_likes (spot_id, user_id, created_at) VALUES (?, ?, ?)').run(
  belemSpotId,
  user2.id,
  new Date().toISOString(),
);
db.prepare('INSERT INTO spot_comments (spot_id, author_id, content, created_at) VALUES (?, ?, ?, ?)').run(
  belemSpotId,
  user2.id,
  'Unbedingt früh morgens hin, bevor die Reisebusse kommen!',
  new Date().toISOString(),
);

const ideaResult = db
  .prepare('INSERT INTO ideas (trip_id, title, image_url, note, created_by) VALUES (?, ?, ?, ?, ?)')
  .run(tripId, 'Sightseeing-Tag Belém', null, 'Turm + danach im Market essen', user1.id);
const ideaId = ideaResult.lastInsertRowid as number;
const insertStation = db.prepare('INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (?, ?, ?)');
insertStation.run(ideaId, `spot-${belemSpotId}`, 0);
insertStation.run(ideaId, `spot-${marketSpotId}`, 1);
// "Geplant" ergibt sich aus einem verknüpften Kalender-Termin statt einer eigenen Datums-Spalte
// auf dem Ausflug (siehe Kommentar in db/index.ts/routes/ideas.ts).
db.prepare('INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)').run(
  tripId,
  fmt(addDays(startDate, 2)),
  'Sightseeing-Tag Belém',
  ideaId,
);

db.prepare('INSERT INTO idea_likes (idea_id, user_id, created_at) VALUES (?, ?, ?)').run(
  ideaId,
  user2.id,
  new Date().toISOString(),
);
db.prepare('INSERT INTO idea_comments (idea_id, author_id, content, created_at) VALUES (?, ?, ?, ?)').run(
  ideaId,
  user2.id,
  'Klingt gut, sollten wir früh starten!',
  new Date().toISOString(),
);

// --- Tagebuch ---
const diaryResult = db
  .prepare('INSERT INTO diary_entries (trip_id, author_id, title, content, images, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(
    tripId,
    user1.id,
    'Ankunft in Lissabon',
    'Nach dem Flug direkt ins Hotel und dann noch einen Abendspaziergang durch die Alfama gemacht. Traumhafter Blick vom Miradouro!',
    JSON.stringify([]),
    new Date().toISOString(),
  );
const diaryEntryId = diaryResult.lastInsertRowid as number;
db.prepare('INSERT INTO diary_likes (entry_id, user_id, created_at) VALUES (?, ?, ?)').run(
  diaryEntryId,
  user2.id,
  new Date().toISOString(),
);
db.prepare('INSERT INTO diary_comments (entry_id, author_id, content, created_at) VALUES (?, ?, ?, ?)').run(
  diaryEntryId,
  user2.id,
  'Sieht traumhaft aus, ich freu mich schon!',
  new Date().toISOString(),
);

// --- Notizen ---
db.prepare('INSERT INTO notes (trip_id, title, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)').run(
  tripId,
  'WLAN & Notfallkontakte',
  'Hotel-WLAN: siehe Zimmerkarte. Notfallnummer Portugal: 112.',
  user1.id,
  new Date().toISOString(),
);

console.log(
  `Demo-Seed abgeschlossen: Trip "${tripId}" mit Unterkunft, Reise, Kalender, Packliste, Einkaufsliste, Ausflug/Spots, Budget, Tagebuch und Notiz angelegt.`,
);
