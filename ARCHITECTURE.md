# ARCHITECTURE.md

Ausführliche Architektur-Beschreibung von Reisotor — **nicht automatisch geladen**, im Unterschied
zu `AGENTS.md`. Bei Bedarf lesen: vor größeren strukturellen Änderungen, wenn unklar ist, wo etwas
lebt, oder wenn die "Code-Map" unten als Startpunkt für die Suche gebraucht wird. Handlungsanweisungen
(Befehle, Test-/Migrations-/PR-Workflow, Konsistenz-Check-Policy) stehen weiterhin in `AGENTS.md`.

## Backend (`backend/src/`)

Fastify-App, `app.ts` exportiert `buildApp()` getrennt von `server.ts` (das nur `buildApp()` aufruft
und `.listen()`), damit Tests eine fertig konfigurierte Instanz per `.inject()` ansprechen können,
ohne einen Port zu binden. Plugin-Reihenfolge in `app.ts`: CORS → statische Uploads
(`/api/uploads/`) → Cookie+Session (`@fastify/session` mit eigenem `SqliteSessionStore` aus
`sessionStore.ts`, damit Sessions einen Prozess-Neustart überleben) → `/api`-Präfix mit offenen
`/auth/*`-Routen und einer zweiten, per `requireAuth` (`auth.ts`) geschützten Gruppe für alle
übrigen Routen. Jede fachliche Domäne hat eine eigene Datei unter `routes/` (siehe Code-Map unten)
plus `buildInfo` für den Git-Commit/Build-Zeitstempel; alle werden in `app.ts` registriert. Routen
greifen direkt per `better-sqlite3` (synchron, kein ORM/Query-Builder) auf `db.prepare(...)` zu.
`tripAccess.ts`s `requireTripMember()` ist der zentrale Gate für die Mitgliedschaftsprüfung (siehe
"Auth & Mitgliedschaft" unten) und wird von jeder Urlaub-bezogenen Route als Erstes aufgerufen.
Es gibt kein eigenes `routes/accommodation.ts` mehr — Unterkunft ist eine Spot-Kategorie und läuft
über `routes/spots.ts` (siehe "Datenbank" unten).

`backend/src/utils/mapsLink.ts`s `resolveLatLng()` löst Kurzlinks serverseitig zweistufig auf:
zuerst `resolveViaRedirectHeaders()` (folgt nur den `Location`-Headern Hop für Hop, ruft nie die
volle Zielseite ab — umgeht so Googles Bot-Erkennung bei bestimmten Kurzlink-Varianten wie
`g_st=ic`), erst danach als Fallback ein vollständiger Redirect-Follow.

## Datenbank (`backend/src/db/index.ts`)

Eine SQLite-Datei (`data.sqlite`), Schema wird bei jedem Prozessstart synchron per
`CREATE TABLE IF NOT EXISTS` + additiven Migrationen (`ensureColumn`, `dropColumnIfExists`)
angewendet — Konventionen dafür siehe "Datenmodell-Änderungen" in `AGENTS.md`. Domänen umfassen
u. a. `trips`, `trip_members`, `schedule_items`, `packing_items`, `ideas` (Ausflugsideen),
`budget_items`/`budget_transfers`/`budgets`/`budget_allocations`, `shopping_items`, `todo_items`,
`notes`, `diary_entries` sowie je eigene `*_likes`/`*_comments`-Tabellen für Ausflüge/Notizen/
Tagebuch/Spots, `travel_items`/`travel_places` (Flug/Zug), `spots`/`excursion_spots` (Karte) und
`sessions`. **Unterkunft ist keine eigene Tabelle mehr**: die frühere `accommodation`-Tabelle wurde
per einmaliger Migration in `spots` verschmolzen — ein Spot der Kategorie "Unterkunft" trägt
zusätzlich Adresse/Zeitraum/Check-in-out/Kontakt/Kosten-Felder (`spots.address`/`start_date`/
`end_date`/`checkin`/`checkout`/`contact`/`amount`/`budget_expense_id`), bei gewöhnlichen Spots
bleiben diese leer. Bewusst quer liegender Zusammenhang: Unterkunfts-/Reisekosten hängen per
`budget_expense_id`-FK an `budget_items` (Sync-Logik in `routes/spots.ts`/`routes/travel.ts`) —
beim Löschen zuerst die referenzierende Zeile aktualisieren/entfernen, danach die `budget_items`-
Zeile (siehe "Bekannte Stolpersteine" in `README.md` zum genauen FK-Constraint-Fehler bei falscher
Reihenfolge).

Alle 11 Domänen-Tabellen haben zusätzlich eine `deleted_at`-Spalte statt echtem `DELETE`
(Soft-Delete/Papierkorb, siehe unten).

## Auth & Mitgliedschaft

Session-Cookie-basiert (kein JWT), `requireAuth`-preHandler-Hook gated alle Routen außer `/auth/*`.
Registrierung ist offen (`POST /auth/register`, E-Mail + Benutzername + Passwort, loggt danach
direkt ein wie `/auth/login`) — kein Einladungscode oder Admin-Freischaltung nötig. Kein globales
User-Rollensystem (keine Admin-/Owner-Rolle).

Zugriff auf einen konkreten Urlaub ist stattdessen per Mitgliedschaft geregelt: `trip_members`
(`trip_id`, `user_id`) legt fest, wer einen Urlaub überhaupt sehen/bearbeiten darf. Wer einen Urlaub
anlegt (`POST /trips`), wird automatisch dessen einziges Mitglied; alle anderen Urlaub-bezogenen
Routen prüfen als Erstes per `tripAccess.ts`s `requireTripMember()`, ob die aktuelle Session
Mitglied des betroffenen `trip_id` ist (403, auch bei nicht-existenter `trip_id`, um deren Existenz
nicht zu verraten). Weitere Nutzer:innen werden über eine Autocomplete-Suche nach
Benutzername/E-Mail (`GET /users/search?q=&trip_id=`, nur bereits registrierte Accounts, die noch
nicht Mitglied sind) gefunden und per `POST /trips/:id/members` eingeladen (Frontend:
`TripMembersDialog.vue`, aufrufbar über den 👥-Button im `TripSwitcher.vue`). Keine Owner-/
Admin-Unterscheidung innerhalb eines Urlaubs — jedes Mitglied kann weitere Mitglieder einladen oder
entfernen (auch sich selbst), kein Schutz vor einem Urlaub mit null Mitgliedern.

Bereits vor Einführung dieses Konzepts angelegte Urlaube/Nutzer:innen wurden per einmaligem Backfill
(`db/index.ts`, gated auf `!hasTable('trip_members')` vor dem Erstellen der Tabelle) so migriert,
dass jede:r bestehende Nutzer:in weiterhin Mitglied jedes bestehenden Urlaubs ist — greift bewusst
nur einmalig beim allerersten Deploy dieser Änderung, nicht bei jedem Prozessstart, sonst würden
sich künftig neu registrierte Accounts automatisch in alle bestehenden Urlaube einklinken.

## Frontend (`frontend/src/`)

Vue 3 (Composition API, `<script setup>`) + Pinia-Stores (je einer pro Domäne unter `stores/`) +
`vue-router`. `router/index.ts` hat einen globalen `beforeEach`-Guard, der `auth.checkSession()`
erzwingt und unauthentifizierte Zugriffe auf `/login` umleitet. Responsive Besonderheit: Kalender
(`ScheduleView`) ist auf Desktop eine globale, in `App.vue` fest gemountete Schublade (seitliche
Lasche), dieselbe Komponente dient auf Mobil zusätzlich als eigenständige Route (`/calendar`) — der
Router blockt einen direkten Aufruf dieser Mobil-Route auf Desktop-Breite, um doppeltes Mounten zu
vermeiden. Wiederkehrende Architekturkonvention: Referenzen auf fremde Objekte (z. B. ein verknüpfter
Trip von einer anderen View aus) springen zur Ursprungs-View statt dort inline editierbar zu sein
(siehe `stores/trip.ts`, `editTripRequestId`).

Touren (Ausflüge) haben seit dem Zurückbau eines früher parallel existierenden "erweiterten
Touren-Modus" **keine eigene Schublade/Route mehr** — Touren-Verwaltung (Anlegen/Bearbeiten/Löschen,
Reihenfolge der Stationen per Drag&Drop) lebt vollständig in `ExcursionsView.vue` (Route
`/excursions`, "🗺️ Karte"), zusammen mit der Spots-Liste und der eingebetteten `TripMap.vue`. Beim
Gruppieren dieser Liste nach Touren (statt nach Kategorie) rendert die Gruppen-Überschrift für jede
echte Tour eine anklickbare `ExcursionCard.vue` statt einer reinen Text-Überschrift — ein Klick
visualisiert die Tour-Route direkt in der danebenliegenden Karte (`drawers.openMapForExcursion()`).
Reihenfolge/Mehrfachbesuch lassen sich im Anlege-/Bearbeiten-Formular per `SpotOrderPicker.vue`
(Drag&Drop) pflegen; `TourAssignPicker.vue` bietet daneben im Spot-Formular einen schnelleren Weg,
einen Spot ohne Reihenfolge einer (ggf. neuen) Tour zuzuordnen — beide schreiben in dasselbe
`Excursion.spot_ids`.

API-Zugriff läuft zentral über `api/client.ts` (`fetch`-Wrapper mit `credentials: 'include'`); ein
`401` leitet dort hart auf `/login` um (außer auf selbst-behandelten Auth-Pfaden wie `/auth/login`),
da eine im Arbeitsspeicher gehaltene Session einen Backend-Neustart nicht übersteht. Karte
(`components/TripMap.vue` u. a.) nutzt Leaflet/OpenStreetMap mit eigenen Emoji-`divIcon`s statt der
Standard-Marker (siehe "Bekannte Stolpersteine" in `README.md`).

## Echtzeit-Sync & Präsenz

SSE-basiert, kein WebSocket. `GET /realtime/stream?trip_id=` (`routes/realtime.ts`) hält pro Client
eine offene Verbindung; `activity.ts`s `recordActivity()` (in praktisch jeder mutierenden Route
verdrahtet, schreibt in `trip_activity`) broadcastet das Event an alle offenen Streams desselben
Urlaubs und pflegt eine In-Memory-Präsenz-Registry (wer ist gerade online, inkl. optionalem
Live-Standort-Broadcast). Frontend: `stores/liveSync.ts` hält die SSE-Verbindung und refetcht
automatisch die passenden Stores bei Fremdänderungen; neu hinzugekommene/geänderte Objekte landen
zusätzlich in einer `highlightedIds`-Menge pro View (`markSeen()` leert sie beim Betreten der View),
sichtbar als roter Punkt auf NavBar/Drawer-Icons und als Farb-Highlight auf dem Objekt selbst —
derselbe Mechanismus wird auch für den Klick-Sprung zu Querverweisen genutzt (siehe "Kalender-
Einstellungen & Querverweis-Hervorhebung" unten). `components/PresenceAvatars.vue` zeigt die gerade
anwesenden Mitglieder im Header. Zusätzlich Web-Push (`push_subscriptions`-Tabelle, Opt-in in
`ProfileView.vue`, `public/sw.js`s `push`/`notificationclick`-Handler) für Benachrichtigungen auch
bei geschlossenem Tab/Browser.

## Offline-Fähigkeit

Zwei bewusst getrennte, nicht überlappende Schichten:
- *Daten-Ebene*: `api/client.ts`/`api/offline.ts` cachen GET-Antworten in `localStorage` und queuen
  Mutationen in einer Outbox, die `stores/connectivity.ts` bei Wiedererkennen der Verbindung
  abarbeitet; `components/OfflineIndicator.vue` zeigt den Zustand im Header.
- *App-Shell-Ebene (volle PWA)*: `vite-plugin-pwa` (`injectManifest`-Strategie, `frontend/
  vite.config.ts`) erweitert denselben `public/sw.js` (statt ihn zu ersetzen) um
  Workbox-Precaching für das komplette Bundle, damit die App auch ohne jedes Netz überhaupt lädt.
  Macht die App auf iOS/Android/Desktop als Icon installierbar (PNG-/Maskable-Icons unter
  `public/icons/`, erzeugt von `scripts/generate-icons.mjs` aus `reisotor_logo.svg`). Bewusst
  **kein** Runtime-Caching von `/api/*` in dieser Schicht — bleibt exklusiv Aufgabe der Daten-Ebene
  oben, um nicht zwei konkurrierende Caches für dieselben Daten zu haben. `devOptions.enabled` ist
  im Dev-Server bewusst `false` — echtes Testen dieser Schicht braucht einen Produktions-Build
  (siehe `e2e/tests/offline-app-shell.spec.ts`). `components/PwaUpdatePrompt.vue` zeigt einen
  Hinweis, wenn eine neue Version bereitsteht bzw. einmalig, dass die App jetzt offline nutzbar ist.

## Anhänge

`attachments`-Tabelle + `routes/attachments.ts` (Upload/Auslieferung unter `/api/uploads/`), genutzt
von 5 Domänen (Reise, Unterkunft, Notizen, Kalender, Budget) über die gemeinsame Komponente
`components/FileAttachments.vue`. Verwaiste Dateien (z. B. nach gelöschtem verknüpftem Objekt)
werden per eigener Cleanup-Routine entfernt.

## Papierkorb/Soft-Delete

Lese-Routen filtern `deleted_at IS NULL`. `routes/trash.ts` listet/restauriert/purged endgültig.
Frontend zeigt beim Löschen zuerst ein 60-Sekunden-Rückgängig-Fenster direkt an der Listenstelle
(`useUndoableDelete.ts`-Composable + `UndoDeleteRow.vue`-Platzhalter), danach ist der Eintrag nur
noch über die eigene `TrashView.vue` (Profil/Avatar-Menü) wiederherstellbar.

## Kalender-Einstellungen & Querverweis-Hervorhebung

Wochenanfang (Standard Montag) und Datumsformat sind in `stores/calendarSettings.ts` (localStorage)
konfigurierbar (Einstellung in `ProfileView.vue`), angewendet über die zentralen Formatierfunktionen
in `utils/dateFormat.ts` (dort auch `startOfWeek()`/`endOfWeek()`) — nicht duplizieren. Klicks auf
Kalendereinträge/andere Querverweise hängen zusätzlich einen `#<domain>-<id>`-Hash an die Ziel-URL;
`utils/hashHighlight.ts`s `hashHighlightId()` merged die referenzierte Id in dieselbe
`highlightedIds`-Menge, die schon für das Echtzeit-"neu"-Highlighting oben genutzt wird.

## Deployment

Push auf `main` baut via `.github/workflows/ci.yml` (Workflow „CI": Unit-Tests → Build → E2E-Tests,
alles gated) und veröffentlicht auf Branch `deploy-staging` (Server pollt das, deployt auf
DEV). Produktion bekommt nur semver-Tags: `release.yml` setzt `vX.Y.Z`, dessen Push den gleichen
Workflow mit Ziel-Branch `deploy` auslöst (siehe README.md). Die SQLite-Datei wird beim
Deploy nie überschrieben. Details/Befehle: `README.md`.

## Code-Map

Startpunkt für "wo lebt X" — statt jedes Mal neu zu grep'en/explorieren, erst hier nachschauen.
Eine Zeile pro Domäne, keine Vollständigkeits-Doku.

| Domäne | Backend-Route | Frontend (Store/View/Komponente) | Kurzbeschreibung |
|---|---|---|---|
| Trips/Mitgliedschaft | `routes/trips.ts`, `tripAccess.ts` | `stores/trip.ts`, `TripSwitcher.vue`, `TripMembersDialog.vue` | Trip-CRUD, `requireTripMember()`-Gate, Einladung |
| Kalender | `routes/schedule.ts` | `stores/schedule.ts`, `ScheduleView.vue`, `CalendarWeek.vue` | Wochenansicht, Termine, Drag&Drop von Ideen |
| Packliste | `routes/packing.ts` | `PackingListView.vue` | Pro-Nutzer:in + gemeinsame Liste, Kategorien |
| Einkaufsliste | `routes/shopping.ts` | `ShoppingListView.vue` | Gemeinsame Liste, Käufer:in-Zuweisung |
| Ausflugsideen/Touren | `routes/ideas.ts` | `stores/excursions.ts`, `ExcursionsView.vue`, `ExcursionCard.vue` | Ideen-Status, Touren-Verwaltung (siehe Frontend-Abschnitt oben) |
| Spots & Karte (inkl. Unterkunft) | `routes/spots.ts` | `stores/spots.ts`, `TripMap.vue`, `SpotCard.vue` | Koordinaten, Leaflet-Karte, Emoji-`divIcon`s; Unterkunft = Spot-Kategorie mit Zeitraum/Check-in-out/Budget-Sync (keine eigene Route mehr) |
| Reise/Transport | `routes/travel.ts` | `TravelView.vue` | Flug/Zug, Budget-Sync |
| Budget | `routes/budget.ts` | `stores/budget.ts`, `BudgetView.vue` | Ziel-/Kategorienbudgets, Splitwise-artige Saldo-Berechnung |
| Tagebuch | `routes/diary.ts` | `DiaryView.vue` | Einträge mit Bildern, Likes, Kommentaren |
| Notizen | `routes/notes.ts` | `NotesView.vue` | Rich-Text (fett/kursiv/Listen/Auto-Links) |
| ToDos | `routes/todos.ts` | `TodoView.vue` | Aufgabenliste |
| Anhänge | `routes/attachments.ts` | `components/FileAttachments.vue` | Upload/Auslieferung, genutzt von 5 Domänen |
| Papierkorb | `routes/trash.ts` | `TrashView.vue`, `useUndoableDelete.ts` | Soft-Delete, 60s-Undo + dauerhafte Wiederherstellung |
| Backup | `routes/backup.ts` | — | Vollständiger JSON-Export/-Import |
| Nutzer:innen/Suche | `routes/users.ts` | `ProfileView.vue` | Autocomplete-Suche, Profil/Avatar |
| Auth | `routes/auth.ts`, `auth.ts` | `stores/auth.ts`, `router/index.ts`-Guard | Registrierung/Login, Session-Gate |
| Echtzeit/Präsenz | `routes/realtime.ts`, `activity.ts` | `stores/liveSync.ts`, `PresenceAvatars.vue` | SSE-Stream, Highlight-Mechanismus |
| Karten-Icons/Design | — | `utils/sectionIcons.ts`, `utils/spotCategory.ts`, `utils/scheduleCategory.ts` | Icon-Registries, siehe `DESIGN.md` |
