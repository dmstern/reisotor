# 🚀 Deployment & Self-Hosting

Reisotor ist als klassische Node.js-App + statische Dateien konzipiert und läuft auf so gut wie jedem Linux-Server (auch auf leistungsschwacher Hardware wie Einplatinencomputern/Raspberry Pi). Es ist bewusst kein Cloud-Anbieter oder Container-Setup vorausgesetzt.

## Inhaltsverzeichnis

- [Build](#build)
- [Auf dem Server (Manuelle Einrichtung)](#auf-dem-server-manuelle-einrichtung)
  - [Dateien kopieren](#1-dateien-kopieren)
  - [Backend vorbereiten & seeden](#2-backend-vorbereiten--seeden)
  - [systemd-Dienst einrichten](#3-systemd-dienst-einrichten)
  - [Reverse Proxy (z. B. Caddy)](#4-reverse-proxy-davorschalten)
- [Automatisiertes Deployment über GitHub Release Assets + Pi-Cronjob](#automatisiertes-deployment-über-github-release-assets--pi-cronjob)
- [Automatische Updates per Cronjob (Self-Hosting)](#automatische-updates-per-cronjob-self-hosting)
- [Manuelles Deployment mit `deploy.sh`](#manuelles-deployment-mit-deploysh)
- [Backup und Wiederherstellung](#backup-und-wiederherstellung)
  - [Backup erstellen](#backup-erstellen)
  - [Backup einspielen (Import)](#backup-einspielen-import)
- [Backend-Umgebungsvariablen](#backend-umgebungsvariablen)

---

## Build

```bash
cd frontend && npm run build     # -> frontend/dist
cd backend  && npm run build     # -> backend/dist (tsc)
```

Der Frontend-Build läuft **lokal**, nicht auf dem Zielserver – auf schwacher Hardware (z. B. Einplatinencomputer mit wenig RAM) kann das Kompilieren dort zu langsam oder gar nicht möglich sein.

---

## Auf dem Server (Manuelle Einrichtung)

### 1. Dateien kopieren

Kopiere auf den Server:

- `backend/dist`, `backend/package.json`, `backend/package-lock.json`
- `frontend/dist` (Inhalt in ein von deinem Webserver ausgeliefertes Verzeichnis, z. B. `/var/www/reisotor`)

### 2. Backend vorbereiten & seeden

Auf dem Server im Backend-Ordner:

```bash
npm ci --omit=dev
SESSION_SECRET=... SEED_USER1=... SEED_PASS1=... SEED_USER2=... SEED_PASS2=... node dist/db/seed.js
```

### 3. systemd-Dienst einrichten

Backend als Dauerprozess starten (Beispiel `/etc/systemd/system/reisotor.service`):

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
# Environment=ORS_API_KEY=<openrouteservice-api-key>

[Install]
WantedBy=multi-user.target
```

Auf einer separaten Staging-Instanz (eigener systemd-Service/Checkout, siehe unten) `APP_ENV=staging` setzen.

Anschließend den Dienst aktivieren und starten:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now reisotor
```

### 4. Reverse Proxy davorschalten

Ein Reverse Proxy reicht `/api/*` ans Backend (`localhost:3000`) weiter und liefert alles andere als statische Dateien aus dem Frontend-Verzeichnis aus (inkl. SPA-Fallback auf `index.html`).

Beispiel mit **Caddy**:

```caddy
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

Das Backend sollte dabei nur auf `localhost` lauschen und nicht öffentlich exponiert sein.

---

## Automatisiertes Deployment über GitHub Release Assets + Pi-Cronjob

Zweistufiger Ablauf, damit eine Änderung erst angeschaut werden kann, bevor sie auf der von Nutzer:innen tatsächlich verwendeten Produktion landet – Versionierung folgt [Semantic Versioning](https://semver.org/):

1. **Push auf `main`** löst `.github/workflows/ci.yml` aus: Frontend und Backend werden gebaut und als vorgebautes Release-Paket (`reisotor-staging.tar.gz`) an das Pre-Release-Tag `staging` auf GitHub angehängt. Der Server pollt dieses Paket per Cronjob (`~/reisotor-deploy-staging.sh`, alle 5 Minuten per `curl`) und deployt automatisch auf DEV (eigene Datenbank mit `npm run seed:demo`-Demo-Daten – niemals echte Nutzerdaten).
2. Sieht das Ergebnis auf Staging gut aus, wird ein Release erstellt: im Actions-Tab den Workflow **„Release"** (`.github/workflows/release.yml`) manuell über „Run workflow" ausführen – standardmäßig reicht ein Klick ohne weitere Eingabe. Versions-Sprung (`patch`/`minor`/`major`) wird automatisch aus den Commit-Nachrichten seit dem letzten Tag abgeleitet (lose an [Conventional Commits](https://www.conventionalcommits.org/) angelehnt, siehe `AGENTS.md`) und lässt sich bei Bedarf per Dropdown übersteuern. Die Changelog-Stichpunkte kommen aus den während der Entwicklung gesammelten Fragmenten unter `release-notes/pending/` (siehe `AGENTS.md`) statt aus einer manuellen Eingabe (bzw. automatisch „Verbesserungen unter der Haube.", falls nur interne/technische Änderungen vorliegen). Der Workflow bumpt die Version in der Root-`package.json`, fasst die Fragmente zu einem neuen `CHANGELOG.md`-Abschnitt zusammen, committet beides auf `main`, setzt einen Git-Tag `vX.Y.Z` und leert `release-notes/pending/` wieder. Dieser Tag-Push löst `.github/workflows/ci.yml` erneut aus – diesmal wird das Paket `reisotor-release.tar.gz` an das neue GitHub Release angehängt. Der Server pollt dieses separat (`~/reisotor-deploy.sh`, per `curl`) und deployt auf die echte Produktion.

Kein Laptop/Client muss für den Rollout selbst online sein oder Zugangsdaten zum Server halten – auf dem Zielserver werden weder `git`, noch SSH-Keys, Tokens oder Node-Build-Tools benötigt, da der Server nur noch das vorgebaute Paket per `curl` lädt.

---

## Automatische Updates per Cronjob (Self-Hosting)

Wenn du Reisotor auf einem eigenen Server betreibst und automatisch auf neue Releases aktualisieren möchtest, kannst du einen Cronjob einrichten, der regelmäßig das vorgebaute `reisotor-release.tar.gz` von GitHub zieht.

**Beispiel-Update-Skript auf dem Server (`/home/<nutzer>/update-reisotor.sh`):**

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/<nutzer>/reisotor"
WEB_ROOT="/var/www/reisotor"
MARKER_FILE="/home/<nutzer>/.reisotor-deployed-commit"
TMP_DIR="/tmp/reisotor-update-download"
ASSET_URL="https://github.com/dmstern/reisotor/releases/latest/download/reisotor-release.tar.gz"

mkdir -p "$TMP_DIR"
if ! curl -sSL -f "$ASSET_URL" -o "$TMP_DIR/release.tar.gz"; then
  rm -rf "$TMP_DIR"
  exit 0
fi

tar -xzf "$TMP_DIR/release.tar.gz" -C "$TMP_DIR"
REMOTE_COMMIT=$(cat "$TMP_DIR/COMMIT" 2>/dev/null || echo "")
LOCAL_COMMIT=$(cat "$MARKER_FILE" 2>/dev/null || echo "")

if [ -n "$REMOTE_COMMIT" ] && [ "$REMOTE_COMMIT" = "$LOCAL_COMMIT" ]; then
  rm -rf "$TMP_DIR"
  exit 0
fi

echo "[$(date)] Neues Release ($REMOTE_COMMIT) gefunden. Deploye..."
rsync -a --delete "$TMP_DIR/frontend/" "$WEB_ROOT/"
rsync -a --delete "$TMP_DIR/backend/dist/" "$APP_DIR/backend/dist/"
rsync -a "$TMP_DIR/backend/package.json" "$TMP_DIR/backend/package-lock.json" "$APP_DIR/backend/"

cd "$APP_DIR/backend"
npm ci --omit=dev
sudo systemctl restart reisotor

echo "$REMOTE_COMMIT" > "$MARKER_FILE"
echo "[$(date)] Update erfolgreich abgeschlossen."
rm -rf "$TMP_DIR"
```

**Cronjob einrichten (`crontab -e`):**

```cron
# Prüft alle 5 Minuten (oder täglich um 04:00 Uhr nachts) auf neue Releases
*/5 * * * * /home/<nutzer>/update-reisotor.sh >> /home/<nutzer>/reisotor-update.log 2>&1
```

---

## Manuelles Deployment mit `deploy.sh`

Alternativ (z. B. wenn kein Internetzugang zu GitHub Actions gewünscht ist oder rein lokal getestet werden soll) automatisiert `deploy.sh` im Repo-Root Build + Kopieren + Neustart **vom eigenen Rechner aus**. Persönliche Werte (SSH-Nutzer, öffentliche Domain, optional ein lokaler Hostname) kommen aus einer lokalen `.env`-Datei (siehe `.env.example`), damit das Skript selbst ohne Infrastruktur-Details versioniert werden kann:

```bash
cp .env.example .env   # einmalig, dann eigene Werte eintragen
./deploy.sh
```

Falls Client und Server im selben lokalen Netz hinter demselben Router hängen, ist die öffentliche Domain von dort aus oft nicht erreichbar (klassisches NAT-Hairpin-Problem). Dagegen helfen zwei Optionen:

- **`LOCAL_HOST`** in der `.env` setzen (z. B. der lokale Hostname/die lokale IP des Servers) – das Skript probiert diesen zuerst und fällt sonst auf `PUBLIC_HOST` zurück.
- Alternativ (z. B. per `/etc/hosts`) die öffentliche Domain lokal direkt auf die interne IP des Servers auflösen lassen – dann funktioniert auch der Browser-Zugriff auf die App selbst im Heimnetz ohne Umweg, und `LOCAL_HOST` kann in der `.env` weggelassen werden.

---

## Backup und Wiederherstellung

Admins können in der Weboberfläche unter **Einstellungen -> Datensicherung** jederzeit ein vollständiges ZIP-Backup herunterladen. Dieses enthält:

1. `data.sqlite` (die komplette Datenbank)
2. `uploads/` (alle gespeicherten Dateianhänge)

### Backup einspielen (Import)

Da das Einspielen einer kompletten Datenbank während des laufenden Betriebs fehleranfällig ist (offene Verbindungen, schreibende Nutzer), erfolgt der Import manuell auf dem Server:

1. Stoppe den laufenden Backend-Dienst:
   ```bash
   sudo systemctl stop reisotor
   ```
2. Entpacke das heruntergeladene ZIP-Archiv.
3. Ersetze die bestehende Datenbank und den Upload-Ordner im Backend-Verzeichnis (z. B. `/home/<nutzer>/reisotor/backend`):
   ```bash
   # Sichere ggf. den aktuellen Stand
   cp data.sqlite data.sqlite.bak

   # Ersetze die Dateien
   cp /pfad/zum/entpackten/data.sqlite data.sqlite
   cp -r /pfad/zum/entpackten/uploads/* uploads/
   ```
4. Starte den Dienst wieder:
   ```bash
   sudo systemctl start reisotor
   ```

---

## Backend-Umgebungsvariablen

| Variable                         | Zweck                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Default                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `PORT`                           | Port des Fastify-Servers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `3000`                                                     |
| `SESSION_SECRET`                 | Secret zum Signieren der Session-Cookies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | unsicherer Dev-Default – **in Produktion zwingend setzen** |
| `NODE_ENV`                       | `production` aktiviert `secure`-Cookies und schärfere CORS-Regel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | –                                                          |
| `DB_PATH`                        | Pfad zur SQLite-Datei                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `backend/data.sqlite`                                      |
| `GITHUB_TOKEN`                   | Fine-grained GitHub Personal Access Token für das In-App-Feedback-Formular (Bug/Feature-Meldungen landen darüber als echtes Issue im Repo, mitgesendete Screenshots werden per Contents API in den Branch `feedback-screenshots` committet, siehe `backend/src/utils/githubIssue.ts`). **Nur mit „Issues: Read and write" UND „Contents: Read and write" auf genau diesem Repo anlegen, sonst nichts** – selbst bei Kompromittierung bleibt der Schaden dann auf Issues und den Screenshot-Branch beschränkt. Ist kein Token konfiguriert, leitet die Instanz Feedback-Meldungen standardmäßig transparent an den zentralen Relay-Dienst weiter (Zero-Config, siehe `FEEDBACK_RELAY_FORWARDING`). | – (Weiterleitung an Relay aktiv)                           |
| `GITHUB_REPO`                    | `owner/repo`, in dem das Feedback-Formular Issues anlegt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `dmstern/reisotor`                                         |
| `FEEDBACK_RELAY_ENABLED`         | Aktiviert den öffentlichen Relay-Endpunkt `POST /api/feedback/relay` auf dieser Instanz (empfängt Feedback von Dritt-Instanzen, erfordert `GITHUB_TOKEN`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `false`                                                    |
| `FEEDBACK_RELAY_URL`             | Ziel-URL für die Feedback-Weiterleitung von Self-Hosted-Instanzen ohne lokales `GITHUB_TOKEN`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `https://reise.ruebenherz.de/api/feedback/relay`           |
| `FEEDBACK_RELAY_FORWARDING`      | Steuert, ob Feedback ohne lokales `GITHUB_TOKEN` an den Relay weitergeleitet wird (`true` oder `false`). Bei `false` wird keine externe Anfrage gesendet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `true`                                                     |
| `REGISTRATION_MODE`              | Steuert die offene Selbstregistrierung (`POST /auth/register`, siehe `backend/src/registrationConfig.ts`): `off` deaktiviert sie komplett, `full` erlaubt sie uneingeschränkt, `restricted` erlaubt sie, markiert neu registrierte Accounts aber dauerhaft als eingeschränkt (kein Datei-/Bild-Upload, max. 1 selbst angelegter Urlaub, max. 3 Mitglieder in einem selbst angelegten Urlaub – spart Ressourcen auf dem Pi-Host). Ein unbekannter Wert fällt auf `full` zurück.                                                                                                                                                                                                                    | `full`                                                     |
| `REGISTRATION_FULL_ACCESS_USERS` | Kommagetrennte Reisotor-Benutzernamen, die von den `restricted`-Einschränkungen ausgenommen sind (dynamisch geprüft, wirkt auch nachträglich auf bereits als eingeschränkt registrierte Accounts). Bewusst nur per Server-Env-Var pflegbar: Registrierung ist offen, ein Self-Service-Toggle würde jeder registrierten Person erlauben, sich selbst freizuschalten.                                                                                                                                                                                                                                                                                                                               | – (niemand ausgenommen)                                    |
| `ORS_API_KEY`                    | API-Key für [OpenRouteService](https://openrouteservice.org/) zur Routenberechnung (Fahrzeiten, Distanzen, Zwischenpunkte/Polylines für Auto, Fahrrad, Fußweg etc. in Touren und Etappen). Kostenlos erhältlich unter [account.heigit.org](https://account.heigit.org). Ohne gesetzten Key bleibt die App voll funktionsfähig und fällt auf Luftlinie bzw. manuelle Eingabe zurück.                                                                                                                                                                                                                                                                                                               | – (Routing deaktiviert)                                    |
| `PHOTON_API_URL`                 | Basis-URL für die Adress- und POI-Suche via [Komoot Photon](https://photon.komoot.io/) (z. B. `https://mein-eigener-photon-server/api/`). Erlaubt es Self-Hostern, eine eigene lokale Photon-Instanz statt des öffentlichen Endpunkts anzubinden.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `https://photon.komoot.io/api/`                            |
| `NOMINATIM_API_URL`              | Basis-URL für den OSM Nominatim-Geocoder (z. B. `https://nominatim.openstreetmap.org/search`), der bei Phrasen- und Kategoriesuchen als duale Ergänzung herangezogen wird.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `https://nominatim.openstreetmap.org/search`               |
| `NOMINATIM_ENABLED`              | Steuert, ob Nominatim als Ergänzung und Fallback aktiv ist (`true` oder `false`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `true`                                                     |
| `VAPID_PUBLIC_KEY`               | Öffentlicher VAPID-Schlüssel für W3C Web Push Benachrichtigungen (Abreise-Erinnerungen etc.).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | – (Push deaktiviert)                                       |
| `VAPID_PRIVATE_KEY`              | Privater VAPID-Schlüssel für Web Push.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | –                                                          |
| `VAPID_SUBJECT`                  | Kontakt-E-Mail oder URL für den VAPID-Push-Dienst (`mailto:admin@example.com`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `mailto:admin@example.com`                                 |
| `HOSTING_LOCATION`               | Ort, der im "Über"-Bereich der Einstellungen im Hosting-/Copyright-Hinweis genannt wird (`GET /build-info`, siehe `routes/buildInfo.ts`) – für Betreiber:innen, die die App an einem anderen Ort als Berlin hosten.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `Berlin`                                                   |
| `APP_ENV`                        | Umgebungskennung dieser Instanz (`GET /build-info`, siehe `routes/buildInfo.ts`), z. B. `production`/`staging` – das Frontend wird für alle Instanzen identisch gebaut und fragt die Umgebung deshalb zur Laufzeit hier ab (z. B. für den DEV-Badge im Header), statt sie aus der Domain zu raten. Auf der Staging-Instanz auf einen von `production` abweichenden Wert setzen.                                                                                                                                                                                                                                                                                                                   | `production`                                               |
