<p align="center">
  <img src="./reisotor_logo.svg" alt="Reisotor Logo" width="120" />
</p>

# Reisotor

Web-App zur gemeinsamen Reiseplanung – ein zentraler Ort für alles rund um eine Reise.

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
- 👤 **Profil & Nutzerverwaltung**: Emoji-Avatar, Passwort ändern, weitere Nutzer:innen anlegen
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

`npm run seed` im Backend legt standardmäßig zwei Nutzer an (`user1`/`changeme1`, `user2`/`changeme2`) – das ist nur ein Startpunkt, weitere Nutzer:innen lassen sich danach jederzeit über die Profil-Seite in der App anlegen. Für echte Zugangsdaten beim Seed folgende Umgebungsvariablen setzen:

```bash
SEED_USER1=daniel SEED_PASS1=... SEED_USER2=partner SEED_PASS2=... npm run seed
```

Das Skript ist idempotent (`INSERT OR IGNORE`) – bereits vorhandene Nutzer/Zeilen werden nicht überschrieben.

### Demo-Daten für Sandbox/Testing

`npm run seed:demo` im Backend legt zusätzlich zu den 2 Nutzern einen kompletten Beispiel-Urlaub mit Daten in allen Bereichen an (Unterkunft, Hin-/Rückflug, Kalendertermine, Pack- und Einkaufsliste, Ausflug mit Spots auf der Karte, Budget mit Ausgaben und Überweisung, Tagebucheintrag, Notiz) – praktisch, um Änderungen in einer frischen Sandbox zu sehen, ohne erst alles von Hand anzulegen. Bricht ab, falls schon ein Urlaub existiert (kein Duplizieren). Nicht für Produktionsdaten gedacht.

### Backend-Umgebungsvariablen

| Variable | Zweck | Default |
|---|---|---|
| `PORT` | Port des Fastify-Servers | `3000` |
| `SESSION_SECRET` | Secret zum Signieren der Session-Cookies | unsicherer Dev-Default – **in Produktion zwingend setzen** |
| `NODE_ENV` | `production` aktiviert `secure`-Cookies und schärfere CORS-Regel | – |
| `DB_PATH` | Pfad zur SQLite-Datei | `backend/data.sqlite` |

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

   [Install]
   WantedBy=multi-user.target
   ```
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

Push auf `main` löst `.github/workflows/build-deploy.yml` aus: Frontend und Backend werden dort gebaut (inkl. Typecheck, der Build schlägt bei Fehlern fehl) und das Ergebnis als einzelner Commit auf den Branch `deploy` veröffentlicht. Der Server selbst pollt diesen Branch per Cronjob (`~/reisotor-deploy.sh`, alle 5 Minuten) und deployt automatisch, sobald ein neuer Build bereitsteht – kein Laptop/Client muss dafür online sein oder selbst Zugangsdaten zum Server halten. Das Skript ist auch manuell auf dem Server ausführbar, falls man nicht auf den nächsten Cron-Tick warten will.

Voraussetzung auf dem Server: ein read-only Deploy Key fürs Repo (unter GitHub → Settings → Deploy keys hinterlegt) sowie ein separater flacher Checkout des `deploy`-Branches unter `~/reisotor-deploy-src`.

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
- **`FOREIGN KEY constraint failed` beim Löschen von Reise-/Unterkunft-Kosten:** Die Budget-Sync-Logik hat beim Entfernen eines Betrags zuerst die verknüpfte `budget_items`-Zeile gelöscht, während `travel_items.budget_expense_id`/`accommodation.budget_expense_id` noch darauf verwiesen – SQLite verweigert das per Foreign-Key-Constraint. Reihenfolge umgekehrt: erst die referenzierende Zeile aktualisieren/löschen, danach die verwaiste `budget_items`-Zeile entfernen.
- **Karte plötzlich leer, ohne erkennbaren Code-Fehler:** meist ein verwaister, alter Vite-Dev-Server-Prozess mit veraltetem Modul-Cache (z. B. nach größeren lokalen Git-Historie-Operationen). Hilft: alte Prozesse beenden, `frontend/node_modules/.vite` löschen, Dev-Server neu starten.
