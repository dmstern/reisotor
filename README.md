<p align="center">
  <img src="./reisotor_logo.svg" alt="Reisotor Logo" width="120" />
</p>

# 🎒🤖 Reisotor

Web-App zur gemeinsamen Reiseplanung – ein zentraler Ort für alles rund um Deine Reise.

[🌍👉 Demo 👈🎒](https://dmstern.github.io/reisotor/)

## Features

- 🏠 **Übersicht/Dashboard** mit Countdown, nächstem Programmpunkt, Packlisten- und Budget-Kurzstatus
- 📅 **Ablauf/Kalender**: Wochenansicht über den ganzen Reisezeitraum, Termine mit Uhrzeit & Notiz, Drag & Drop von geplanten Ideen direkt auf einen Tag
- 🧳 **Packliste**: eigene Liste pro Nutzer:in + eine gemeinsame Liste, Kategorien mit Autovervollständigung
- 🛒 **Einkaufsliste**: gemeinsame Liste mit optionaler Käufer:in-Zuweisung, Filter danach, Produktlinks
- 🎒 **Ausflugsideen**: Status Idee/Geplant/Verworfen, optionaler Google-Maps-Link (erscheint dann automatisch auf der Karte)
- 🗺️ **Spots & Karte**: Restaurants, Sehenswürdigkeiten etc. mit Koordinaten, alles zusammen auf einer Leaflet/OpenStreetMap-Karte
- 🛏️ **Unterkunft**: mehrere Einträge möglich, mit Zeitraum, Check-in/-out, Kosten
- ✈️ **Reise/Transport**: Flug-/Zug-Infos (Zeiten, Gepäck, Sitzplatz), Kosten
- 💶 **Budget**: Ziel- und Kategorienbudgets, Ausgaben und Überweisungen, automatische Saldo-/Schulden-Berechnung (Splitwise-artig)
- 📔 **Tagebuch**: Einträge mit Bildern, Likes und Kommentaren
- 📝 **Notizen**: freier Bereich für alles Sonstige, mit einfachem Rich-Text (fett/kursiv/Listen/Auto-Links)
- 📎 **Anhänge**: Dateien/Bilder direkt an Reise-, Unterkunfts-, Notiz-, Kalender- und Budget-Einträge hängen
- 🌍 **Reiseregion-Infos**: Sprache, Währung, aktueller Wechselkurs zur eigenen Heimatwährung und Reisehinweise direkt im Dashboard
- 📍 **Live-Standort**: Mitglieder können ihren aktuellen Standort auf der Karte teilen
- 🔔 **Echtzeit-Zusammenarbeit**: Änderungen anderer Mitglieder erscheinen live (ohne Neuladen), inkl. Anwesenheitsanzeige und optionalen Push-Benachrichtigungen
- 📴 **Offline-fähig**: als App installierbar (Icon auf Startbildschirm bei iOS/Android/Desktop), lädt auch ohne Internetverbindung; zuletzt geladene Daten bleiben einsehbar, Änderungen werden bei Wiederverbindung automatisch nachgereicht
- 🗑️ **Papierkorb**: gelöschte Einträge lassen sich rückgängig machen (60-Sekunden-Fenster direkt an Ort und Stelle) oder später im Papierkorb wiederherstellen
- 👥 **Mitgliedschaft & Einladung**: offene Registrierung per E-Mail, Zugriff auf einen Urlaub aber nur für eingeladene Mitglieder (Autocomplete-Suche nach Benutzername/E-Mail)
- ⚙️ **Einstellungen**: Emoji-Avatar, Passwort ändern, Kalender-Einstellungen (Wochenanfang, Datumsformat)
- 💾 **Backup**: vollständiger Datenexport/-import als JSON

## Struktur

```
/backend    Fastify + TypeScript + better-sqlite3
/frontend   Vite + Vue 3 + TypeScript
```

## Lokale Entwicklung

Voraussetzung: Node.js 20+, sowie `make`/`gcc`/`python3` (für die nativen Module `better-sqlite3` und `bcrypt`).

```bash
# Backend
cd backend
npm install
npm run seed   # legt 2 Nutzer + leere Trip-/Unterkunftszeile an
npm run dev    # Fastify auf http://localhost:3000

# Frontend (zweites Terminal)
cd frontend
npm install
npm run dev    # Vite auf http://localhost:5173, proxied /api an Backend
```

Die App ist unter `http://localhost:5173` erreichbar.

### Nutzer anlegen

`npm run seed` im Backend legt standardmäßig zwei Nutzer an (`user1`/`changeme1`, `user2`/`changeme2`) – das ist nur ein Startpunkt für die lokale Entwicklung. Registrierung ist in der App selbst offen (Login-Seite, E-Mail + Benutzername + Passwort) – jede:r kann sich einen eigenen Account anlegen. Zugriff auf einen konkreten Urlaub ist davon unabhängig: wer einen Urlaub anlegt, ist zunächst allein darauf, weitere Personen müssen erst per Autocomplete-Suche (Benutzername/E-Mail) eingeladen werden. Für echte Zugangsdaten beim Seed folgende Umgebungsvariablen setzen:

```bash
SEED_USER1=daniel SEED_PASS1=... SEED_USER2=partner SEED_PASS2=... npm run seed
```

Das Skript ist idempotent (`INSERT OR IGNORE`) – bereits vorhandene Nutzer/Zeilen werden nicht überschrieben.

### Demo-Daten für Sandbox/Testing (mit Backend)

`npm run seed:demo` im Backend legt zusätzlich zu den 2 Nutzern einen kompletten Beispiel-Urlaub mit Daten in allen Bereichen an (Unterkunft, Hin-/Rückflug, Kalendertermine, Pack- und Einkaufsliste, Ausflug mit Spots auf der Karte, Budget mit Ausgaben und Überweisung, Tagebucheintrag, Notiz) – praktisch, um Änderungen in einer frischen Sandbox zu sehen, ohne erst alles von Hand anzulegen. Bricht ab, falls schon ein Urlaub existiert (kein Duplizieren). Nicht für Produktionsdaten gedacht.

### Backend-loser Demo-Modus (Frontend only)

Reisotor bietet auch einen vollständig backend-losen Demo-Modus, der alle API-Aufrufe mit Beispieldaten im Arbeitsspeicher simuliert (entspricht der [GitHub-Pages-Live-Demo](https://dmstern.github.io/reisotor/)):

```bash
# Frontend im Demo-Modus starten (kein Backend erforderlich)
cd frontend
npm install
npm run dev:demo   # Vite Dev-Server mit Watch/Hot-Reloading auf http://localhost:5173
```

Für einen statischen Produktions-Build der Demo:

```bash
cd frontend
npm run build:demo # statischer Build nach dist-demo/
```

### Backend-Umgebungsvariablen

| Variable | Zweck | Default |
|---|---|---|
| `PORT` | Port des Fastify-Servers | `3000` |
| `SESSION_SECRET` | Secret zum Signieren der Session-Cookies | unsicherer Dev-Default – **in Produktion zwingend setzen** |
| `NODE_ENV` | `production` aktiviert `secure`-Cookies und schärfere CORS-Regel | – |
| `DB_PATH` | Pfad zur SQLite-Datei | `backend/data.sqlite` |
| `GITHUB_TOKEN` | Fine-grained GitHub Personal Access Token für das In-App-Feedback-Formular (Bug/Feature-Meldungen landen darüber als echtes Issue im Repo, mitgesendete Screenshots werden per Contents API in den Branch `feedback-screenshots` committet, siehe `backend/src/utils/githubIssue.ts`). **Nur mit „Issues: Read and write" UND „Contents: Read and write" auf genau diesem Repo anlegen, sonst nichts** – selbst bei Kompromittierung bleibt der Schaden dann auf Issues und den Screenshot-Branch beschränkt. Ohne gesetzten Token bleibt die App voll funktionsfähig, nur das Feedback-Formular meldet einen Fehler. | – (Feature deaktiviert) |
| `GITHUB_REPO` | `owner/repo`, in dem das Feedback-Formular Issues anlegt | `dmstern/reisotor` |
| `REGISTRATION_MODE` | Steuert die offene Selbstregistrierung (`POST /auth/register`, siehe `backend/src/registrationConfig.ts`): `off` deaktiviert sie komplett, `full` erlaubt sie uneingeschränkt, `restricted` erlaubt sie, markiert neu registrierte Accounts aber dauerhaft als eingeschränkt (kein Datei-/Bild-Upload, max. 1 selbst angelegter Urlaub, max. 3 Mitglieder in einem selbst angelegten Urlaub – spart Ressourcen auf dem Pi-Host). Ein unbekannter Wert fällt auf `full` zurück. | `full` |
| `REGISTRATION_FULL_ACCESS_USERS` | Kommagetrennte Reisotor-Benutzernamen, die von den `restricted`-Einschränkungen ausgenommen sind (dynamisch geprüft, wirkt auch nachträglich auf bereits als eingeschränkt registrierte Accounts). Bewusst nur per Server-Env-Var pflegbar: Registrierung ist offen, ein Self-Service-Toggle würde jeder registrierten Person erlauben, sich selbst freizuschalten. | – (niemand ausgenommen) |
| `HOSTING_LOCATION` | Ort, der im "Über"-Bereich der Einstellungen im Hosting-/Copyright-Hinweis genannt wird (`GET /build-info`, siehe `routes/buildInfo.ts`) – für Betreiber:innen, die die App an einem anderen Ort als Berlin hosten. | `Berlin` |
| `APP_ENV` | Umgebungskennung dieser Instanz (`GET /build-info`, siehe `routes/buildInfo.ts`), z. B. `production`/`staging` – das Frontend wird für alle Instanzen identisch gebaut (siehe unten) und fragt die Umgebung deshalb zur Laufzeit hier ab (z. B. für den DEV-Badge im Header), statt sie aus der Domain zu raten. Auf der Staging-Instanz auf einen von `production` abweichenden Wert setzen. | `production` |

## Deployment

Reisotor ist als klassische Node.js-App + statische Dateien konzipiert und läuft auf so gut wie jedem Linux-Server (auch auf leistungsschwacher Hardware, siehe unten). Es ist bewusst kein Cloud-Anbieter oder Container-Setup vorausgesetzt.

### Build

```bash
cd frontend && npm run build     # -> frontend/dist
cd backend  && npm run build     # -> backend/dist (tsc)
```

Der Frontend-Build läuft **lokal**, nicht auf dem Zielserver – auf schwacher Hardware (z. B. Einplatinencomputer mit wenig RAM) kann das Kompilieren dort zu langsam oder gar nicht möglich sein.

### Auf dem Server

1. Kopiere auf den Server:
   - `backend/dist`, `backend/package.json`, `backend/package-lock.json`
   - `frontend/dist` (Inhalt in ein von deinem Webserver ausgeliefertes Verzeichnis, z. B. `/var/www/reisotor`)
2. Auf dem Server im Backend-Ordner:
   ```bash
   npm ci --omit=dev
   SESSION_SECRET=... SEED_USER1=... SEED_PASS1=... SEED_USER2=... SEED_PASS2=... node dist/db/seed.js
   ```
3. Backend als Dauerprozess starten (Beispiel mit systemd, `/etc/systemd/system/reisotor.service`):
   ```ini
   [Unit]
   Description=Reisotor Backend
   After=network.target

   [Service]
   Type=simple
   User=<dein-nutzer>
   WorkingDirectory=/home/<dein-nutzer>/reisotor/backend
   ExecStart=/usr/bin/node dist/server.js
   Restart=on-failure
   Environment=NODE_ENV=production
   Environment=SESSION_SECRET=<zufaelliger-wert>
   Environment=APP_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
   Auf einer separaten Staging-Instanz (eigener systemd-Service/Checkout, siehe unten) `APP_ENV=staging` setzen.
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now reisotor
   ```
4. Reverse Proxy davorschalten, der `/api/*` ans Backend (`localhost:3000`) weiterreicht und alles andere als statische Dateien aus dem Frontend-Verzeichnis ausliefert (inkl. SPA-Fallback auf `index.html`). Beispiel mit Caddy:
   ```
   deine-domain.de {
       handle /api/* {
           reverse_proxy localhost:3000
       }
       handle {
           root * /var/www/reisotor
           try_files {path} /index.html
           file_server
       }
   }
   ```
   Das Backend sollte dabei nur auf `localhost` lauschen, nicht öffentlich exponiert sein.

### Automatisiertes Deployment über GitHub Actions + Pi-Cronjob

Zweistufiger Ablauf, damit eine Änderung erst angeschaut werden kann, bevor sie auf der von Nutzer:innen tatsächlich verwendeten Produktion landet – Versionierung folgt [Semantic Versioning](https://semver.org/), `deploy-staging` bildet dabei immer den aktuellen `main`-Stand ab, `deploy` bekommt ausschließlich benannte Releases:

1. **Push auf `main`** löst `.github/workflows/ci.yml` aus: Frontend und Backend werden gebaut (inkl. Typecheck, der Build schlägt bei Fehlern fehl) und das Ergebnis als einzelner Commit auf den Branch `deploy-staging` veröffentlicht. Der Server pollt diesen Branch per Cronjob (`~/reisotor-deploy-staging.sh`, alle 5 Minuten) und deployt automatisch auf DEV (Basic-Auth-geschützt, eigene Datenbank mit `npm run seed:demo`-Demo-Daten – niemals echte Nutzerdaten).
2. Sieht das Ergebnis auf Staging gut aus, wird ein Release erstellt: im Actions-Tab den Workflow **„Release"** (`.github/workflows/release.yml`) manuell über „Run workflow" ausführen – standardmäßig reicht ein Klick ohne weitere Eingabe. Versions-Sprung (`patch`/`minor`/`major`) wird automatisch aus den Commit-Nachrichten seit dem letzten Tag abgeleitet (lose an [Conventional Commits](https://www.conventionalcommits.org/) angelehnt, siehe `AGENTS.md`) und lässt sich bei Bedarf per Dropdown übersteuern. Die Changelog-Stichpunkte kommen aus den während der Entwicklung gesammelten Fragmenten unter `release-notes/pending/` (siehe `AGENTS.md`) statt aus einer manuellen Eingabe. Der Workflow bumpt die Version in der Root-`package.json`, fasst die Fragmente zu einem neuen `CHANGELOG.md`-Abschnitt zusammen, committet beides auf `main`, setzt einen Git-Tag `vX.Y.Z` und leert `release-notes/pending/` wieder. Dieser Tag-Push (und nur er) löst `.github/workflows/ci.yml` erneut aus, diesmal mit Ziel-Branch `deploy` – der Server pollt diesen separat (`~/reisotor-deploy.sh`) und deployt auf die echte Produktion. Der Release-Workflow lässt sich statt über die Weboberfläche auch programmatisch auslösen (z. B. über die GitHub-API/`gh workflow run`, etwa aus einer Agenten-Session heraus).

Kein Laptop/Client muss für den Rollout selbst online sein oder Zugangsdaten zum Server halten – beide Deploy-Skripte sind zusätzlich manuell auf dem Server ausführbar, falls man nicht auf den nächsten Cron-Tick warten will.

Voraussetzung auf dem Server: ein read-only Deploy Key fürs Repo (unter GitHub → Settings → Deploy keys hinterlegt) sowie je ein separater flacher Checkout der beiden Branches (`~/reisotor-deploy-src` für `deploy`, `~/reisotor-deploy-src-staging` für `deploy-staging`).

Einmaliger manueller Setup-Schritt in den Repo-Settings, damit der Tag-Push aus `release.yml`
`.github/workflows/ci.yml`/`pages-deploy.yml` überhaupt auslöst: unter Settings → Secrets and variables →
Actions ein Secret `RELEASE_TOKEN` anlegen (fine-grained Personal Access Token mit „Contents: Read
and write" auf genau diesem Repo). Grund: ein mit dem automatischen `GITHUB_TOKEN` ausgeführter
Push löst laut GitHub bewusst keine Folge-Workflows aus (Anti-Rekursions-Schutz) – ohne dieses
Secret bumpt `release.yml` zwar Version/Changelog und setzt den Tag, aber Prod-Deploy/Pages-Deploy
müssen dann manuell nachgestoßen werden (siehe Issue #221 für den Workaround: den Tag im
GitHub-UI löschen und über „Draft a new release" mit demselben Namen neu erzeugen, oder
`.github/workflows/ci.yml` bzw. `pages-deploy.yml` per `workflow_dispatch` mit dem Tag als Ref manuell
ausführen).

### Manuelles Deployment mit `deploy.sh`

Alternativ (z. B. wenn kein Internetzugang zu GitHub Actions gewünscht ist oder rein lokal getestet werden soll) automatisiert `deploy.sh` im Repo-Root Build + Kopieren + Neustart **vom eigenen Rechner aus**. Persönliche Werte (SSH-Nutzer, öffentliche Domain, optional ein lokaler Hostname) kommen aus einer lokalen `.env`-Datei (siehe `.env.example`), damit das Skript selbst ohne Infrastruktur-Details versioniert werden kann:

```bash
cp .env.example .env   # einmalig, dann eigene Werte eintragen
./deploy.sh
```

Falls Client und Server im selben lokalen Netz hinter demselben Router hängen, ist die öffentliche Domain von dort aus oft nicht erreichbar (klassisches NAT-Hairpin-Problem). Dagegen helfen zwei Optionen:

- **`LOCAL_HOST`** in der `.env` setzen (z. B. der lokale Hostname/die lokale IP des Servers) – das Skript probiert diesen zuerst und fällt sonst auf `PUBLIC_HOST` zurück.
- Alternativ (z. B. per `/etc/hosts`) die öffentliche Domain lokal direkt auf die interne IP des Servers auflösen lassen – dann funktioniert auch der Browser-Zugriff auf die App selbst im Heimnetz ohne Umweg, und `LOCAL_HOST` kann in der `.env` weggelassen werden.

## Bekannte Stolpersteine

- **Leaflet-Kartenmarker unsichtbar:** Leaflets `Icon.Default._getIconUrl` versucht automatisch, den Bildpfad aus einer CSS-Regel (`.leaflet-default-icon-path`) zu erkennen und stellt diesen den eigentlichen Icon-URLs voran – auch wenn man über `mergeOptions` bereits vollständige, von Vite aufgelöste URLs gesetzt hat. Das Ergebnis war eine doppelt verschachtelte, 404-URL, wodurch der Browser nur das `alt`-Attribut ("marker icon", abgeschnitten zu "mark") anzeigte. Gelöst durch eigene Emoji-`divIcon`s statt der Standard-Icons.
- **`FOREIGN KEY constraint failed` beim Löschen von Reise-/Unterkunft-Kosten:** Die Budget-Sync-Logik hat beim Entfernen eines Betrags zuerst die verknüpfte `budget_items`-Zeile gelöscht, während `travel_items.budget_expense_id`/`spots.budget_expense_id` (Unterkunft ist eine Spot-Kategorie, siehe `ARCHITECTURE.md`) noch darauf verwiesen – SQLite verweigert das per Foreign-Key-Constraint. Reihenfolge umgekehrt: erst die referenzierende Zeile aktualisieren/löschen, danach die verwaiste `budget_items`-Zeile entfernen.
- **Karte plötzlich leer, ohne erkennbaren Code-Fehler:** meist ein verwaister, alter Vite-Dev-Server-Prozess mit veraltetem Modul-Cache (z. B. nach größeren lokalen Git-Historie-Operationen). Hilft: alte Prozesse beenden, `frontend/node_modules/.vite` löschen, Dev-Server neu starten.
