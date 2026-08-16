# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Reisotor ist eine Vue 3 + Fastify-Web-App zur gemeinsamen Reiseplanung, ursprünglich für zwei
Personen pro Haushalt gebaut. Registrierung ist offen (E-Mail-Adresse, siehe `routes/auth.ts`),
Zugriff auf einen Urlaub ist aber zusätzlich per Mitgliedschaft (`trip_members`) beschränkt — wer
einen Urlaub anlegt, ist zunächst allein darauf, weitere Personen müssen erst per Autocomplete-Suche
eingeladen werden (siehe Abschnitt "Auth" unten). Siehe `README.md` für Features, lokale
Setup-/Deploy-Schritte und Umgebungsvariablen. Diese Datei hält Architektur-Überblick und
Dev-Workflow-Konventionen für Claude Code fest.

## Setup & Befehle

```bash
# Backend (Fastify + TypeScript + better-sqlite3, /backend)
cd backend
npm install
npm run seed        # legt 2 Nutzer + leere Trip-/Unterkunftszeile an (idempotent)
npm run seed:demo   # zusätzlich kompletter Beispiel-Urlaub mit Daten in allen Bereichen
npm run dev         # tsx watch auf http://localhost:3000
npm run build       # tsc -> backend/dist
npm test            # vitest run; npm run test:watch für Watch-Mode

# Frontend (Vite + Vue 3 + TypeScript, /frontend)
cd frontend
npm install
npm run dev         # Vite auf http://localhost:5173, proxied /api ans Backend
npm run build   # vue-tsc --noEmit + vite build -> frontend/dist
npm test            # vitest run

# E2E (Playwright, /e2e) — siehe eigener Abschnitt unten
cd e2e && npm install && npx playwright install chromium && npm test
```

Einzelnen Test ausführen: `npx vitest run <pfad-zur-datei>` bzw. `npx vitest run -t "<name>"`
(aus `backend/` oder `frontend/`); für E2E `npx playwright test <pfad-zur-spec>` aus `e2e/`.

Node.js 20+ sowie `make`/`gcc`/`python3` nötig (native Module `better-sqlite3`, `bcrypt`). Volle
Setup-/Deploy-/Env-Var-Details: `README.md`.

## Architektur

**Backend** (`backend/src/`): Fastify-App, `app.ts` exportiert `buildApp()` getrennt von
`server.ts` (das nur `buildApp()` aufruft und `.listen()`), damit Tests eine fertig konfigurierte
Instanz per `.inject()` ansprechen können, ohne einen Port zu binden. Plugin-Reihenfolge in
`app.ts`: CORS → statische Uploads (`/api/uploads/`) → Cookie+Session (`@fastify/session` mit
eigenem `SqliteSessionStore` aus `sessionStore.ts`, damit Sessions einen Prozess-Neustart
überleben) → `/api`-Präfix mit offenen `/auth/*`-Routen und einer zweiten, per `requireAuth`
(`auth.ts`) geschützten Gruppe für alle übrigen Routen. Jede fachliche Domäne hat eine eigene Datei
unter `routes/` (trips, schedule, packing, ideas, accommodation, budget, users, backup, shopping,
todos, notes, diary, travel, spots) plus `buildInfo` für den Git-Commit/Build-Zeitstempel; alle
werden in `app.ts` registriert. Routen greifen direkt per `better-sqlite3` (synchron, kein
ORM/Query-Builder) auf `db.prepare(...)` zu. `tripAccess.ts`s `requireTripMember()` ist der zentrale
Gate für die Mitgliedschaftsprüfung (siehe "Auth" unten) und wird von jeder Urlaub-bezogenen Route
als Erstes aufgerufen.

**Datenbank** (`backend/src/db/index.ts`): eine SQLite-Datei (`data.sqlite`), Schema wird bei jedem
Prozessstart synchron per `CREATE TABLE IF NOT EXISTS` + additiven Migrationen (`ensureColumn`,
`dropColumnIfExists`) angewendet — siehe Abschnitt "Datenmodell-Änderungen" unten für die
Konventionen dabei. Domänen umfassen u. a. `trips`, `trip_members` (Mitgliedschaft pro Urlaub,
siehe "Auth" unten), `schedule_items`, `packing_items`, `ideas`
(Ausflugsideen), `accommodation`, `budget_items`/`budget_transfers`/`budgets`/
`budget_allocations`, `shopping_items`, `todo_items`, `notes`, `diary_entries` sowie je eigene
`*_likes`/`*_comments`-Tabellen für Ausflüge/Notizen/Tagebuch/Spots, `travel_items`/
`travel_places` (Flug/Zug), `spots`/`excursion_spots` (Karte) und `sessions`. Bewusst quer
liegender Zusammenhang: Unterkunfts-/Reisekosten hängen per `budget_expense_id`-FK an
`budget_items` (Sync-Logik in `routes/accommodation.ts`/`routes/travel.ts`) — beim Löschen zuerst
die referenzierende Zeile aktualisieren/entfernen, danach die `budget_items`-Zeile (siehe
"Bekannte Stolpersteine" in `README.md` zum genauen FK-Constraint-Fehler bei falscher Reihenfolge).

**Auth**: Session-Cookie-basiert (kein JWT), `requireAuth`-preHandler-Hook gated alle Routen außer
`/auth/*`. Registrierung ist offen (`POST /auth/register`, E-Mail + Benutzername + Passwort, loggt
danach direkt ein wie `/auth/login`) — kein Einladungscode oder Admin-Freischaltung nötig, um
überhaupt einen Account zu bekommen. Kein globales User-Rollensystem (keine Admin-/Owner-Rolle).

Zugriff auf einen konkreten Urlaub ist stattdessen per Mitgliedschaft geregelt: `trip_members`
(`trip_id`, `user_id`) legt fest, wer einen Urlaub überhaupt sehen/bearbeiten darf. Wer einen Urlaub
anlegt (`POST /trips`), wird automatisch dessen einziges Mitglied; alle anderen Urlaub-bezogenen
Routen (Kalender, Packliste, Budget, Notizen, Tagebuch, Spots, Ausflüge, Unterkunft, Reise, ToDos,
Einkaufsliste, Papierkorb) prüfen als Erstes per `tripAccess.ts`s `requireTripMember()`, ob die
aktuelle Session Mitglied des betroffenen `trip_id` ist (403, falls nicht — auch bei einer
nicht-existenten `trip_id`, um deren Existenz nicht zu verraten). Weitere Nutzer:innen werden über
eine Autocomplete-Suche nach Benutzername/E-Mail (`GET /users/search?q=&trip_id=`, nur bereits
registrierte Accounts, die noch nicht Mitglied sind) gefunden und per `POST /trips/:id/members`
eingeladen (Frontend: `TripMembersDialog.vue`, aufrufbar über den 👥-Button im `TripSwitcher.vue`).
Es gibt keine Owner-/Admin-Unterscheidung innerhalb eines Urlaubs — jedes Mitglied kann weitere
Mitglieder einladen oder entfernen (auch sich selbst), es gibt keinen Schutz davor, dass ein Urlaub
am Ende null Mitglieder hat.

Bereits vor Einführung dieses Konzepts angelegte Urlaube/Nutzer:innen wurden per einmaligem Backfill
(`db/index.ts`, gated auf `!hasTable('trip_members')` vor dem Erstellen der Tabelle) so migriert,
dass jede:r bestehende Nutzer:in weiterhin Mitglied jedes bestehenden Urlaubs ist — das greift
bewusst nur einmalig beim allerersten Deploy dieser Änderung, nicht bei jedem Prozessstart, sonst
würden sich künftig neu registrierte Accounts automatisch in alle bestehenden Urlaube einklinken.

**Frontend** (`frontend/src/`): Vue 3 (Composition API, `<script setup>`) + Pinia-Stores (je einer
pro Domäne unter `stores/`: `trip`, `schedule`, `spots`, `excursions`, `drawers`, `navPosition`,
`theme`, `auth`) + `vue-router`. `router/index.ts` hat einen globalen `beforeEach`-Guard, der
`auth.checkSession()` erzwingt und unauthentifizierte Zugriffe auf `/login` umleitet. Responsive
Besonderheit: Kalender (`ScheduleView`) ist auf Desktop eine globale, in `App.vue` fest gemountete
Schublade (seitliche Lasche), dieselbe Komponente dient auf Mobil zusätzlich als eigenständige Route
(`/calendar`) — der Router blockt einen direkten Aufruf dieser Mobil-Route auf Desktop-Breite, um
doppeltes Mounten zu vermeiden. Wiederkehrende Architekturkonvention: Referenzen auf fremde Objekte
(z. B. ein verknüpfter Trip von einer anderen View aus) springen zur Ursprungs-View statt dort
inline editierbar zu sein (siehe `stores/trip.ts`, `editTripRequestId`).

Touren (Ausflüge) haben seit dem Zurückbau eines früher parallel existierenden "erweiterten
Touren-Modus" (separate Ausflüge-Schublade + Reihenfolge-Editor nur hinter einer Einstellung)
**keine eigene Schublade/Route mehr** — Touren-Verwaltung (Anlegen/Bearbeiten/Löschen, Reihenfolge
der Stationen per Drag&Drop) lebt vollständig in `ExcursionsView.vue` (Route `/excursions`,
"🗺️ Karte"), zusammen mit der Spots-Liste und der eingebetteten `TripMap.vue`. Beim Gruppieren
dieser Liste nach Touren (statt nach Kategorie, Umschalter im Filter-Bereich) rendert die
Gruppen-Überschrift für jede echte Tour eine anklickbare `ExcursionCard.vue` statt einer reinen
Text-Überschrift — ein Klick darauf visualisiert die Tour-Route direkt in der danebenliegenden
Karte (`drawers.openMapForExcursion()`), kein Sichtwechsel nötig. Reihenfolge/Mehrfachbesuch einer
Tour lassen sich im Anlege-/Bearbeiten-Formular immer per `SpotOrderPicker.vue` (Drag&Drop) pflegen;
`TourAssignPicker.vue` bietet daneben im Spot-Formular einen schnelleren Weg, einen Spot ohne
Reihenfolge einer (ggf. neuen) Tour zuzuordnen — beide schreiben in dasselbe `Excursion.spot_ids`.

API-Zugriff läuft zentral über `api/client.ts` (`fetch`-Wrapper mit `credentials: 'include'`); ein
`401` leitet dort hart auf `/login` um (außer auf den paar selbst-behandelten Auth-Pfaden wie
`/auth/login`), da eine im Arbeitsspeicher gehaltene Session einen Backend-Neustart nicht übersteht.
Karte (`components/TripMap.vue` u. a.) nutzt Leaflet/OpenStreetMap mit eigenen Emoji-`divIcon`s
statt der Standard-Marker (siehe "Bekannte Stolpersteine" in `README.md`).

**Echtzeit-Sync & Präsenz**: SSE-basiert, kein WebSocket. `GET /realtime/stream?trip_id=` (`routes/
realtime.ts`) hält pro Client eine offene Verbindung; `activity.ts`s `recordActivity()` (in
praktisch jeder mutierenden Route verdrahtet, schreibt in `trip_activity`) broadcastet das Event an
alle offenen Streams desselben Urlaubs und pflegt eine In-Memory-Präsenz-Registry (wer ist gerade
online, inkl. optionalem Live-Standort-Broadcast). Frontend: `stores/liveSync.ts` hält die
SSE-Verbindung und refetcht automatisch die passenden Stores bei Fremdänderungen; neu
hinzugekommene/geänderte Objekte landen zusätzlich in einer `highlightedIds`-Menge pro View
(`markSeen()` leert sie beim Betreten der View), sichtbar als roter Punkt auf NavBar/Drawer-Icons
und als Farb-Highlight auf dem Objekt selbst — dieselbe Menge/derselbe visuelle Mechanismus wird
auch für den Klick-Sprung zu Querverweisen genutzt (siehe unten). `components/PresenceAvatars.vue`
zeigt die gerade anwesenden Mitglieder im Header. Zusätzlich Web-Push (`push_subscriptions`-Tabelle,
Opt-in in `ProfileView.vue`, `public/sw.js`s `push`/`notificationclick`-Handler) für
Benachrichtigungen auch bei geschlossenem Tab/Browser.

**Offline-Fähigkeit** — zwei bewusst getrennte, nicht überlappende Schichten:
- *Daten-Ebene*: `api/client.ts`/`api/offline.ts` cachen GET-Antworten in `localStorage` und queuen
  Mutationen in einer Outbox, die `stores/connectivity.ts` bei Wiedererkennen der Verbindung
  abarbeitet; `components/OfflineIndicator.vue` zeigt den Zustand im Header.
- *App-Shell-Ebene (volle PWA)*: `vite-plugin-pwa` (`injectManifest`-Strategie, `frontend/
  vite.config.ts`) erweitert denselben `public/sw.js` (statt ihn zu ersetzen) um
  Workbox-Precaching für das komplette Bundle, damit die App auch ohne jedes Netz überhaupt lädt.
  Macht die App auf iOS/Android/Desktop als Icon installierbar (PNG-/Maskable-Icons unter
  `public/icons/`, erzeugt von `scripts/generate-icons.mjs` aus `reisotor_logo.svg`). Bewusst **kein**
  Runtime-Caching von `/api/*` in dieser Schicht — das bleibt exklusiv Aufgabe der Daten-Ebene oben,
  um nicht zwei konkurrierende Caches für dieselben Daten zu haben. `devOptions.enabled` ist im
  Dev-Server bewusst `false` (Precaching gegen den sich ständig ändernden Vite-Dev-Bundle wäre nur
  Verwirrung) — echtes Testen dieser Schicht braucht einen Produktions-Build (siehe
  `e2e/tests/offline-app-shell.spec.ts`). `components/PwaUpdatePrompt.vue` zeigt einen Hinweis, wenn
  eine neue Version bereitsteht bzw. einmalig, dass die App jetzt offline nutzbar ist.

**Anhänge**: `attachments`-Tabelle + `routes/attachments.ts` (Upload/Auslieferung unter
`/api/uploads/`, siehe Plugin-Reihenfolge oben), genutzt von 5 Domänen (Reise, Unterkunft, Notizen,
Kalender, Budget) über die gemeinsame Komponente `components/FileAttachments.vue`. Verwaiste Dateien
(z. B. nach gelöschtem verknüpftem Objekt) werden per eigener Cleanup-Routine entfernt.

**Papierkorb/Soft-Delete**: alle 11 Domänen-Tabellen haben eine `deleted_at`-Spalte statt echtem
`DELETE` (siehe "Datenmodell-Änderungen" unten für additive Migrationen allgemein); Lese-Routen
filtern `deleted_at IS NULL`. `routes/trash.ts` listet/restauriert/purged endgültig. Frontend zeigt
beim Löschen zuerst ein 60-Sekunden-Rückgängig-Fenster direkt an der Listenstelle
(`useUndoableDelete.ts`-Composable + `UndoDeleteRow.vue`-Platzhalter), danach ist der Eintrag nur
noch über die eigene `TrashView.vue` (erreichbar über Profil/Avatar-Menü) wiederherstellbar.

**Kalender-Einstellungen & Querverweis-Hervorhebung**: Wochenanfang (Standard Montag) und
Datumsformat sind in `stores/calendarSettings.ts` (localStorage) konfigurierbar (Einstellung in
`ProfileView.vue`), angewendet über die zentralen Formatierfunktionen in `utils/dateFormat.ts` (dort
auch `startOfWeek()`/`endOfWeek()`) — nicht duplizieren, jede View mit Datumsanzeige nutzt diese
statt eigener Formatierlogik. Klicks auf Kalendereinträge/andere Querverweise (siehe "Referenzen auf
fremde Objekte…" oben) hängen zusätzlich einen `#<domain>-<id>`-Hash an die Ziel-URL;
`utils/hashHighlight.ts`s `hashHighlightId()` merged die referenzierte Id in dieselbe
`highlightedIds`-Menge, die schon für das Echtzeit-"neu"-Highlighting oben genutzt wird (ein
gemeinsamer Hervorhebungs-Mechanismus statt zweier paralleler).

**Deployment** (Details: `README.md`): Push auf `main` baut via `.github/workflows/build-deploy.yml`
(Unit-Tests → Build → E2E-Tests, alles gated) und veröffentlicht auf Branch `deploy-staging`
(Server pollt das, deployt auf `dev.reise.ruebenherz.de`); erst ein expliziter
`git push origin main:prod` löst denselben Workflow für Branch `deploy` aus (echte Produktion,
`reise.ruebenherz.de`). Die SQLite-Datei wird beim Deploy nie überschrieben (siehe
"Datenmodell-Änderungen" unten).

**PR-Merge-Regel für Claude Code (Stand: seit Screenshots im PR, siehe unten)**: von Claude Code
erstellte PRs gegen `main` NICHT mehr automatisch mergen, sobald CI grün ist – stattdessen offen
lassen und auf das Review des Nutzers warten (er checkt jetzt bewusst zuerst visuell anhand der im
PR angehängten Screenshots, siehe unten, statt wie zuvor direkt auf `dev.reise.ruebenherz.de` zu
testen). Frühere Version dieser Regel (automatischer Merge bei grüner CI) war ausdrücklich dafür
gedacht, sofort auf dev testen zu können – mit den Screenshots direkt im PR ist das nicht mehr nötig,
ein visuelles Review vorab ist dem Nutzer lieber. Explizit auf einen Merge-Wunsch/eine Freigabe des
Nutzers warten, nicht eigenmächtig mergen, auch wenn CI längst grün ist. Weiterhin **nicht als
Draft** (`draft: false`) erstellen – rein informativ für ein sauberes PR-Listing, nicht mehr für
einen Auto-Merge-Trigger nötig.

**Screenshots im PR selbst, für das visuelle Review ohne Deploy-Wartezeit**: jeder PR, der eine
sichtbare UI-Änderung/einen sichtbaren Bugfix enthält, bekommt Screenshots des betroffenen Bereichs
direkt im PR (Body oder Kommentar) angehängt – in den relevanten Viewports (mind. mobil ~390px UND
Desktop ~1280px breit, bei einer reinen Desktop- oder reinen Mobil-Änderung reicht der jeweils
betroffene Viewport). Zweck: der Nutzer soll das Ergebnis direkt auf GitHub sehen und reviewen
können, bevor überhaupt gemergt/deployt wird (siehe PR-Merge-Regel oben) – nicht nur als Beleg nach
dem Merge.

Technisch: Screenshots per Playwright erzeugen (siehe Abschnitt "Ad-hoc-Checks" unten für den
Wegwerf-Spec-Kniff), dann NICHT im gitignoreten `e2e/tests/scratch/` belassen, sondern gezielt in
den PR einbetten. Da die GitHub-Tools dieser Umgebung keinen direkten Bild-Upload-Endpunkt für
Kommentare bieten, dafür die Bilder committen (z. B. unter `docs/pr-screenshots/<kurzer-slug>/` auf
demselben Feature-Branch) und im PR-Body/-Kommentar per Markdown-Bild-Syntax auf die
`raw.githubusercontent.com`- bzw. Blob-URL dieses Branches verlinken – GitHub rendert das inline.
Reine Text-/Backend-only-Änderungen ohne sichtbare Oberfläche brauchen keine Screenshots.

Token-sparend bleiben dabei bewusst lokal (Wegwerf-Spec), nicht nach CI verlagern: die Wegwerf-Spec
soll nur die tatsächlich geänderte(n) View(s)/Komponente(n) ansteuern, ohne unnötige Zwischenschritte
über das für den Screenshot Nötige hinaus – der erzeugte Playwright-Report/Reporter-Output selbst
muss dafür nicht gelesen werden, es zählen nur die erzeugten PNG-Dateien (kurz per Read-Tool
sichtprüfen, dann direkt committen). Eine Verlagerung nach CI (Job erzeugt Screenshots und committet
sie zurück auf den PR-Branch) spart zwar lokale Tokens, würde aber Push-Rechte aus dem
CI-Workflow zurück auf den eigenen PR-Branch brauchen (Trigger-Loop-Gefahr, mehr Angriffsfläche) –
für einen Schritt, der lokal ohnehin schon günstig ist (einzelne gezielte Spec statt Suite, kein
Output-Auswerten nötig). Genauso bewusst keine persistenten Specs dafür verwenden: Regressionstests
unter `e2e/tests/` sollen bei einer verletzten Erwartung rot werden, nicht nebenbei Bilder für ein
manuelles Review erzeugen – das vermischt zwei verschiedene Zwecke in einer Datei.

## Konsistenz-Check bei Änderungen

Die App ist über viele Sessions gewachsen, und dasselbe Konzept (Icon, Bezeichnung, Layout-/
Verhaltensmuster, Datenmodell-Feld) taucht oft an mehreren Stellen gleichzeitig auf, ohne dass das
zentral dokumentiert ist — der Nutzer hat nicht mehr die ganze App im Kopf und merkt nicht jede
Stelle, die mitgezogen werden sollte (Beispiel: Todo-Icon wurde im Kalender zu einem Clipboard
geändert, dasselbe Icon in der NavBar aber vergessen; ein Flex-Wrap-Fix an einer Card-Komponente,
der an strukturell ähnlichen Cards woanders genauso gilt). Bei jeder Änderung an UI-Bausteinen
(Icons, wiederkehrende Bezeichnungen, Layout-/Interaktionsmuster wie Card-Wrap-Verhalten) oder am
Datenmodell (`backend/src/db/index.ts`, `api/types.ts`) deshalb aktiv prüfen, ob dasselbe Muster
noch anderswo in der App vorkommt (kurz grep auf das Icon/den Bezeichner/die Komponente, nicht nur
an der ursprünglich angefragten Stelle schauen):

- **Offensichtlich sinnvolle Folgeanpassung** (identisches Icon/Konzept an anderer Stelle, exakt
  gleiches Bug-Muster, klar auf dieselbe, gerade bearbeitete Baustelle begrenzt): nicht vorher
  nachfragen, einfach mit umsetzen — genau wie bei Bugfixes, die während der Umsetzung auffallen —
  und danach kurz erwähnen, was zusätzlich mit angepasst wurde.
- **Unklar, ob gewollt** (könnte an der anderen Stelle bewusst abweichen, Kontext unterschiedlich,
  größerer Umbau nötig): die Beobachtung nennen und nachfragen statt eigenmächtig mitzuändern.

**Neue UI-Bausteine/Design-Anforderungen speziell (nicht nur reines Bugfix-Nachziehen):** bevor eine
neue Komponente gebaut oder ein neues visuelles Muster eingeführt wird (z. B. ein neuer
Formularfeld-Label-Stil, ein neues Dropdown-/Filter-/Sortier-Muster), aktiv im Rest der App
nachschauen, was es dafür schon gibt (grep auf ähnliche Komponenten/Klassen/Konzepte), statt eine
zweite, leicht abweichende Variante danebenzubauen — siehe DESIGN.md, Abschnitt "Konsistenz", für
konkret schon aufgetretene Fälle (native `<select>` vs. custom `Combobox.vue` mit unterschiedlicher
Höhe, mehrere parallele Label-Stile, uneinheitliche Filter-/Gruppieren-/Sortieren-Präsentation je
View). Fällt dabei zusätzliches Konsistenz-Optimierungspotenzial an einer *nicht* angefragten Stelle
auf, das über eine 1:1-Wiederholung hinausgeht (z. B. eine App-weite Vereinheitlichung mehrerer
Views mit bisher unterschiedlichem Muster, oder eine Design-Entscheidung zwischen mehreren
gleichwertigen Optionen) — das zählt ab jetzt immer als "Unklar, ob gewollt" oben, auch wenn die
Verbesserung an sich naheliegend wirkt: die Beobachtung nennen und (z. B. per `AskUserQuestion`)
nachfragen, ob das gleich mitgemacht werden soll, statt eigenmächtig entweder den ganzen Scope
auszuweiten oder die Beobachtung nur zu erwähnen und liegen zu lassen.

Für Datenmodell-Änderungen im Speziellen gilt zusätzlich der Migrations-Check im nächsten Abschnitt.

**Design-Prinzipien**: Bei neuen UI-Elementen oder sichtbaren UI-Anpassungen zusätzlich `DESIGN.md`
(Projekt-Root) konsultieren — hält Farben/Abstände/Eckenrundung (Squircle-Prinzip)/Typografie/
Breakpoints/Icon-Konventionen als wiederverwendbare Prinzipien fest, damit neue Elemente bestehende
Tokens/Muster nutzen statt neue Werte ad hoc zu erfinden. Entsteht dabei ein neues, wiederverwendbares
Prinzip, dort ergänzen statt es nur implizit im CSS/einer Komponente stehen zu lassen.

## Typecheck

Nach jeder Frontend-Änderung zuerst den günstigsten Check laufen lassen:

```bash
cd frontend && npm run build   # führt vue-tsc --noEmit vor dem Vite-Build aus
```

## Datenmodell-Änderungen (DB-Migrationen)

Jede Änderung an `backend/src/db/index.ts` (neue/entfernte Spalte oder Tabelle, umgebautes
Feld) braucht diesen Check, bevor sie als fertig gilt — nicht erst, wenn explizit danach gefragt
wird:

1. **Ist das schon in Prod live?** Prüfen, ob die betroffene Spalte/Tabelle bereits Teil des
   letzten Prod-Deploys ist: `git merge-base origin/prod HEAD` (bzw. `origin/main`, falls der
   Branch von dort abzweigt) gibt den letzten gemeinsamen Commit; ein `git diff <dieser-commit>
   HEAD -- backend/src/db/index.ts` zeigt, was seitdem am Schema geändert wurde. Alles, was schon
   vorher drin war, kann echte Nutzdaten auf der echten `data.sqlite` enthalten (die App wird aktiv
   für echte Reiseplanung verwendet — ursprünglich von zwei festen Haushaltsmitgliedern, seit der
   offenen Registrierung potenziell auch von weiteren, eingeladenen Nutzer:innen).
2. **Rein additiv bleiben, wo möglich.** Neue Spalten/Tabellen nur über `ensureColumn` (nullable
   oder mit `DEFAULT`) bzw. `CREATE TABLE IF NOT EXISTS` — nie eine bestehende Tabelle mit einer
   `NOT NULL`-Spalte ohne Default versehen.
3. **Vor jedem `dropColumnIfExists`/Rename einer schon live gewesenen Spalte: Backfill davor.**
   Falls die Spalte echte Werte tragen könnte, deren fachliche Bedeutung im neuen Modell woanders
   landet, muss ein Backfill (`INSERT`/`UPDATE`) diese Werte migrieren, bevor die Spalte fällt —
   sonst gehen sie beim nächsten Deploy kommentarlos verloren. Muster: `if (hasColumn(table, col))
   { db.exec('INSERT/UPDATE ...'); dropColumnIfExists(table, col); }` (siehe die
   `packing_items.checked`- bzw. `ideas.date`-Migration in `backend/src/db/index.ts` als Vorlage).
   Ein reiner No-Op-Drop (Spalte war nie live oder nie befüllt) braucht keinen Backfill.
4. **Reihenfolge im Skript beachten.** Migrationen laufen beim Backend-Start synchron in
   Datei-Reihenfolge gegen den *tatsächlichen* aktuellen DB-Zustand, nicht gegen den Skript-Text.
   Ein Backfill, der eine Spalte braucht, die selbst erst weiter unten per `ensureColumn` ergänzt
   wird, muss hinter diese Stelle gesetzt werden — sonst schlägt er auf einer frischen/Test-DB mit
   `no such column` fehl (auf der echten Prod-DB fällt das nicht auf, weil die Spalte dort durch
   frühere Deploys schon längst existiert).
5. **Migrationstest ergänzen.** Für jeden Backfill einen Test analog zu
   `backend/test/unit/dbMigration.test.ts` schreiben: alten Schema-Stand in einer temporären
   SQLite-Datei nachbauen, `db/index.ts` importieren lassen und prüfen, dass die Daten im neuen
   Modell wiederzufinden sind.

Der eigentliche Rollout-Mechanismus dafür existiert schon und braucht keine separate
Migrations-Pipeline: `deploy.sh` und die Pi-Cronjob-Skripte schließen `*.sqlite*` explizit von
`rsync --delete` aus, die Datenbank wird also nie überschrieben. Der Backend-Prozess führt
`db/index.ts` bei jedem Neustart erneut aus, wendet die additiven Migrationen (und ggf. Backfills)
automatisch auf die bestehende Datei an. Schema-Änderungen im Code committen reicht also aus —
kein manueller Migrationsschritt auf dem Server nötig.

## Unit-Tests (`backend/test/`, `frontend/src/**/*.test.ts`)

Vitest auf beiden Seiten, unabhängig konfiguriert (Backend: `backend/vitest.config.ts`; Frontend:
`test`-Key in `frontend/vite.config.ts`). Laufen ohne Browser/Server, deterministisch und schnell —
laufen deshalb automatisch in CI, direkt vor dem jeweiligen Build-Schritt in
`.github/workflows/build-deploy.yml`. Ein fehlschlagender Unit-Test verhindert damit sowohl den
`main`→Staging- als auch den `prod`→Produktions-Deploy (die E2E-Suite unten läuft im selben
Workflow ebenfalls automatisch und gated genauso, ist nur spürbar langsamer wegen Browser-Start).

```bash
cd backend && npm test    # bzw. npm run test:watch für Watch-Mode
cd frontend && npm test
```

Backend-Tests laufen gegen eine isolierte `:memory:`-SQLite-Instanz pro Testdatei (siehe
`backend/test/helpers/buildTestApp.ts`), nie gegen echte Nutzdaten oder `data.sqlite`. Isolation ist
bewusst pro Testdatei, nicht pro einzelnem Test (`beforeAll` statt `beforeEach`) — Tests innerhalb
einer Datei legen dafür jeweils eigene, eindeutig identifizierbare Ressourcen an, statt sich auf
eine leere Tabelle zu verlassen. Bei wachsender Suite ließe sich das mit `vi.resetModules()` in
`beforeEach` auf echte Pro-Test-Isolation umstellen.

`backend/src/utils/mapsLink.ts`s `resolveLatLng()` löst Kurzlinks serverseitig zweistufig auf:
zuerst `resolveViaRedirectHeaders()` (folgt nur den `Location`-Headern Hop für Hop, ruft nie die
volle Zielseite ab — genau das umgeht Googles Bot-Erkennung bei bestimmten Kurzlink-Varianten wie
`g_st=ic`), erst danach als Fallback ein vollständiger Redirect-Follow. Beide Pfade sind mit
gemocktem `fetch()` getestet (`vi.stubGlobal`, gleiches Muster wie `regionInfo.test.ts`) — echtes
Netzwerkverhalten (ob Google diesen speziellen Kurzlink-Typ tatsächlich noch blockt) lässt sich
damit nicht verifizieren, nur die Hop-Verkettungs-/Timeout-/Fehlerlogik selbst. Der direkte
Parse-Pfad davor (`parseLatLngFromText`) ist vollständig getestet.

### Umfang: Regressionsnetz statt Vollabdeckung

Dieselbe Philosophie wie bei der E2E-Suite unten ("Wann einen neuen/aktualisierten Test
schreiben?"): Regressionsnetz für echte Logik (Berechnungen, Regex-Parsing, Auth-Gating), keine
vollständige Abdeckung jeder Route/Funktion. Reine CRUD-Routen ohne Verzweigungslogik brauchen i. d.
R. keinen eigenen Test.

## E2E-Tests (`/e2e`)

Ergänzt die schnellen, browserlosen Unit-Tests oben um echte Klick-Interaktionen durch einen
Browser. Committete Playwright-Suite, die beide Dev-Server automatisch startet und gegen eine frisch
geseedete, isolierte Test-Datenbank läuft (nie gegen echte Nutzdaten). Funktioniert identisch
lokal, in einer Cloud-Sandbox und wenn Claude Code direkt am GitHub-Repo arbeitet (z. B. über die
Claude-Mobile-App) — die gesamte Infrastruktur (Server-Autostart, Seed-Daten, Login) ist committet,
nicht an lokale Umgebungsdaten gebunden.

Läuft auf eigenen Ports (Backend 3100, Frontend 5273, via `CORS_ORIGIN`-Env-Var in
`backend/src/server.ts` konfigurierbar) — kollidiert nicht mit einem eventuell schon laufenden
echten lokalen Dev-Server auf 3000/5173, der muss dafür nicht gestoppt werden.

Läuft außerdem automatisch in CI (`.github/workflows/build-deploy.yml`, nach den Unit-Tests, vor dem
Assemble-Schritt) — bei einem Fehlschlag wird als Artefakt der HTML-Report samt Screenshots
hochgeladen (`playwright-report`/`test-results`), abrufbar über den jeweiligen Workflow-Run.

**Token-sparend: die volle Suite (`npm test`) nicht routinemäßig lokal laufen lassen.** Da CI sie
bei jedem Push ohnehin gated ausführt, kostet ein lokaler Vollauf für Claude Code nur unnötig
Tokens — nicht wegen der Playwright-Laufzeit selbst, sondern weil die komplette Testausgabe
(Namen, Traces, Report) ins Kontextfenster zurückgelesen wird. Lokal stattdessen gezielt einsetzen:
- `npx playwright test <pfad-zur-spec>` für eine einzelne, gerade geschriebene/geänderte Spec
  direkt nach dem Schreiben verifizieren.
- Einen CI-E2E-Fehlschlag lokal reproduzieren/debuggen.
- Eine Wegwerf-Spec unter `e2e/tests/scratch/` für Ad-hoc-Checks/PR-Screenshots (siehe unten bzw.
  Abschnitt "Screenshots im PR selbst" oben).

Auf einen vollen lokalen `npm test`-Lauf "zur Sicherheit" vor jedem Push verzichten — dafür ist CI da.

```bash
cd e2e
npm install                       # einmalig
npx playwright install chromium   # einmalig pro (frischer) Umgebung — lädt beim allerersten Lauf
                                   # das Browser-Binary herunter, kein Fehler/Hänger, nur einmaliger
                                   # Download
npm test                          # komplette Suite, startet/beendet beide Server automatisch
npx playwright show-report        # HTML-Report des letzten Laufs (u. a. Screenshots bei Fehlern)
```

### Wann einen neuen/aktualisierten Test schreiben?

Nicht nach jeder Anpassung. Die Suite ist ein Regressionsnetz für die zentralen Abläufe der App
(Login-Gate, Kalender-Feature, Mitgliedschaft/Einladung, Echtzeit-Sync, …), keine vollständige
Abdeckung. Einen Test ergänzen/anpassen, wenn eine Änderung sichtbares Nutzerverhalten neu einführt
oder grundlegend ändert und das wert ist, gegen stille Regression abzusichern (Navigations-Logik,
Positionierungs-/Layout-Bugs, Auth-Gating, neue Kern-Abläufe). Triviale visuelle/Text-Anpassungen
brauchen keinen neuen Test.

**Standardverhalten, nicht Ausnahme:** Fällt während der Umsetzung eines Features ein Use Case auf,
bei dem sich ein persistenter e2e-Test lohnt (neuer Kern-Ablauf, ein gerade selbst gefundener/
gefixter Bug mit echtem Regressionsrisiko, ein Zusammenspiel mehrerer Komponenten, das leicht wieder
kaputtgehen kann), den Test direkt im selben Arbeitsschritt schreiben statt es zu erwähnen oder auf
Rückfrage zu warten — genau wie bei Bugfixes, die während der Umsetzung auffallen (siehe
"Konsistenz-Check bei Änderungen" oben). Das gilt ausdrücklich auch für das Aktualisieren/Anpassen/
Erweitern bestehender Spezifikationen (nicht nur neue Dateien): eine bestehende Spec darf und soll
nach eigenem Ermessen umgebaut werden, wenn sich dadurch tatsächliches Nutzerverhalten treffender
oder robuster abbilden lässt (z. B. eine zu spezifische Assertion verallgemeinern, einen neu
entdeckten Seiteneffekt mit abdecken). Kein Vorab-Okay nötig — die Suite soll mit der App mitwachsen,
nicht nur auf expliziten Auftrag hin.

**Keine Pixel-Diff-Screenshot-Tests** (`toHaveScreenshot()`) verwenden — diese Dev-/Sandbox-Umgebung
ist von Playwright selbst als nicht offiziell unterstütztes OS markiert (Font-/Rendering-Drift
zwischen Maschinen macht Snapshot-Baselines unzuverlässig). Stattdessen Interaktion +
Zustands-/Sichtbarkeits-/BoundingBox-Assertions.

Datums-Annahmen aus `e2e/fixtures/seeded-data.json` lesen (wird zur Laufzeit von
`global-setup.ts` geschrieben), nicht hartcodieren — die Demo-Seed-Termine liegen relativ zu
"heute".

### Ad-hoc-Checks ("schau selbst nach, ob X funktioniert/gut aussieht")

Für spontane visuelle Verifikation einer einzelnen Änderung (kein dauerhafter Regressionstest):
eine kurze Wegwerf-Spec unter `e2e/tests/scratch/` schreiben (gitignored, nie committen), die zur
fraglichen Stelle navigiert, interagiert und `page.screenshot({ path: ... })` aufruft. Mit
`npx playwright test tests/scratch/<name>.spec.ts` ausführen (startet automatisch beide Server +
Login), den erzeugten Screenshot per Read-Tool selbst ansehen und bewerten, Datei danach löschen.
