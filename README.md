# Reisotor

Privates Reiseplanungs-Dashboard für 2 Personen. Siehe [`bauanleitung.md`](./bauanleitung.md) für die vollständige Spezifikation.

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

`npm run seed` im Backend legt standardmäßig zwei Nutzer an (`user1`/`changeme1`, `user2`/`changeme2`).
Für echte Zugangsdaten vor dem Seed folgende Umgebungsvariablen setzen:

```bash
SEED_USER1=daniel SEED_PASS1=... SEED_USER2=partner SEED_PASS2=... npm run seed
```

Das Skript ist idempotent (`INSERT OR IGNORE`) – bereits vorhandene Nutzer/Zeilen werden nicht überschrieben.

### Backend-Umgebungsvariablen

| Variable | Zweck | Default |
|---|---|---|
| `PORT` | Port des Fastify-Servers | `3000` |
| `SESSION_SECRET` | Secret zum Signieren der Session-Cookies | unsicherer Dev-Default – **in Produktion zwingend setzen** |
| `NODE_ENV` | `production` aktiviert `secure`-Cookies und schärfere CORS-Regel | – |
| `DB_PATH` | Pfad zur SQLite-Datei | `backend/data.sqlite` |

## Build fürs Deployment

```bash
cd frontend && npm run build     # -> frontend/dist
cd backend  && npm run build     # -> backend/dist (tsc)
```

Der Frontend-Build läuft **lokal**, nicht auf dem Pi (zu langsam/zu wenig RAM).

## Deployment auf dem Raspberry Pi 2

1. Kopiere auf den Pi:
   - `backend/dist`, `backend/package.json`, `backend/package-lock.json`
   - `frontend/dist` (Inhalt nach `/var/www/reisotor`)
2. Auf dem Pi im Backend-Ordner:
   ```bash
   npm ci --omit=dev
   SESSION_SECRET=... SEED_USER1=... SEED_PASS1=... SEED_USER2=... SEED_PASS2=... node dist/db/seed.js
   ```
3. Caddyfile und systemd-Unit wie in [`bauanleitung.md`](./bauanleitung.md#deployment-hinweise-für-claude-code) einrichten, dann:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now reisotor
   sudo systemctl reload caddy
   ```

Das Backend lauscht nur auf `localhost:3000`; nur Caddy ist öffentlich erreichbar.

## Getroffene Annahmen

- **Login-Persistenz:** Session-Cookie mit 30 Tagen Laufzeit (`maxAge`) erfüllt "eingeloggt bleiben" ohne separate Checkbox/Option.
- **Seed statt Registrierung:** Da kein Passwort-Reset/Registrierungs-Flow vorgesehen ist, werden die 2 Nutzer über `npm run seed` (idempotent) angelegt/gepflegt.
- **`trip`:** Als Singleton behandelt (feste `id = 1`), passend zum "kein Multi-Trip-Support"-Constraint. `PUT` macht ein Upsert. `accommodation` ist seit dem Mehrfach-Unterkunft-Feature eine normale Liste (wie `spots`), kein Singleton mehr.
- **Kalenderwoche:** Wochen beginnen Montag; die erste/letzte Woche wird auf volle 7 Tage aufgefüllt, auch wenn sie über den Reisezeitraum hinausragt (rein UI-seitig, ohne Datenänderung).
- **Icons in der Navigation:** Emoji statt Icon-Font/SVG-Set, um Bundle-Größe und Abhängigkeiten gering zu halten.
- **Kartenmarker:** Eigene Emoji-`divIcon`s (📍 Spots, 💡 Ideen, 🛏️ Unterkunft) statt Leaflets Standard-Icon-Bilder – dadurch keine Asset-Pfad-Probleme mit Bundlern (siehe Fix unten) und auf einen Blick erkennbar, welcher Marker was ist.
- **Packlisten-Rechte:** "Public" wurde als *für alle sichtbar UND bearbeitbar* interpretiert (jeder eingeloggte Nutzer kann jede Liste inkl. der des anderen Nutzers abhaken/ändern) – passend zum "keine Overkill-Berechtigungen"-Prinzip für 2 private, vertrauenswürdige Nutzer.
- **Google-Maps-Links → Koordinaten:** Es gibt kein Places-/Geocoding-API (bewusst kein API-Key/Kosten laut Bauanleitung). Koordinaten werden per Regex aus dem Link selbst extrahiert (`@lat,lng`, `?q=`, `?ll=`, `!3d!4d`-Embed-Parameter). Kurzlinks (`goo.gl/maps/...`, `maps.app.goo.gl/...`) lassen sich so nicht auflösen – der Link bleibt trotzdem klickbar, erscheint aber nicht automatisch auf der Karte.
- **Nutzerverwaltung:** Kein Admin-Konzept – jeder eingeloggte Nutzer kann neue Nutzer anlegen (Passwort min. 6 Zeichen) und nur das eigene Passwort/Avatar ändern. Keine Nutzerlöschung über die UI (passend zur "keine Overkill"-Devise; bei Bedarf direkt in der SQLite-Datei).
- **Ideen-Kalender-Verknüpfung:** Ein eingeplanter Kalendereintrag speichert `idea_id`; die Idee gilt dann als "verplant" und verschwindet aus dem Drag&Drop-Pool. Löscht man den Kalendereintrag, taucht die Idee automatisch wieder im Pool auf (kein zusätzlicher Status nötig).
- **Backup Export/Import:** Export liefert einen vollständigen 1:1-Dump aller Tabellen (inkl. `users` mit `password_hash` – ist ein Hash, kein Klartext, aber die Datei ist trotzdem sensibel und sollte nicht offen herumliegen) als JSON-Download. Import ersetzt **alle** aktuellen Daten unwiderruflich (Löschen + Neueinfügen in einer Transaktion; bei Fehlern automatischer Rollback, es wird nichts verändert). Da beim Import per Spaltenliste inserted wird, funktioniert das Wiedereinspielen eines älteren Backups auch nach additiven Schema-Migrationen (neue Spalten bekommen einfach ihren Default/`NULL`) – nur bei entfernten/umbenannten Spalten schlägt der Import kontrolliert fehl.

### Bugfix: kaputte Kartenmarker ("leeres Quadrat mit 'mark'")

Leaflets `Icon.Default._getIconUrl` versucht automatisch, den Bildpfad aus einer CSS-Regel (`.leaflet-default-icon-path`) zu erkennen und stellt diesen den eigentlichen Icon-URLs voran – auch wenn man über `mergeOptions` bereits vollständige, von Vite aufgelöste URLs gesetzt hat. Das Ergebnis war eine doppelt verschachtelte, 404-URL, wodurch der Browser nur das `alt`-Attribut ("marker icon", abgeschnitten zu "mark") anzeigte. Gelöst durch eigene Emoji-`divIcon`s statt der Standard-Icons (siehe oben).
