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
- **Budget-Aufteilung & Schulden:** Jede Bezahlung braucht einen Zahler (Pflichtfeld im Formular). Der Saldo je Nutzer berechnet sich als `bezahlt − fairer Anteil (Gesamtausgaben / Anzahl Nutzer) + gesendete Überweisungen − erhaltene Überweisungen`. Das ist der Standard-"Net Balance"-Ansatz von Splitwise & Co.: bei genau 2 Nutzern ergibt das exakt "wer schuldet wem wieviel"; bei mehr als 2 Nutzern zeigt es nur den Saldo pro Person (kein Debt-Simplification-Algorithmus für minimale Ausgleichs-Transaktionen, da die Bauanleitung explizit von 2 Personen ausgeht).
- **Kategorien-Zielbudgets** gelten fürs Gesamtbudget (nicht separat pro Person), da sonst die UI unübersichtlich würde. Sechs Kategorien sind vorgegeben (Essen & Trinken, Unterkunft, Transport, Aktivitäten & Spaß, Souvenirs, Sonstiges), weitere lassen sich frei hinzufügen.
- **Einkaufsliste** ist eine einzelne gemeinsame Liste (kein Pro-Nutzer-Split wie bei der Packliste) mit optionaler Käufer:in-Zuweisung – passt eher zum Charakter "was muss noch besorgt werden" als zu individuellen Listen.
- **Notizen** sind frei von allen editierbar/löschbar (wie die Packliste) statt nur vom Ersteller, da hierfür keine Ownership-Einschränkung verlangt wurde.
- **Tagebuch-Bilder:** Wie bei Ideen nur Bild-URLs (Textarea, eine URL pro Zeile), kein Datei-Upload – konsistent mit dem "kein Datei-Upload"-Grundsatz der Bauanleitung.
- **Reise-Kosten ↔ Budget:** Ein Reise-Eintrag mit Betrag *und* Zahler:in legt automatisch eine verknüpfte Budget-Ausgabe an (Kategorie „Transport") und hält sie bei Änderungen synchron; wird der Betrag entfernt oder der Eintrag gelöscht, verschwindet die Ausgabe wieder automatisch aus der Budgetplanung. Ohne Zahler:in wird kein Budget-Eintrag erzeugt (die Saldo-Berechnung bräuchte sonst eine willkürliche Zuordnung).
- **Unterkunft-Kosten ↔ Budget:** Gleiches Prinzip wie bei Reise-Kosten, nur mit Kategorie „Unterkunft" statt „Transport".
- **Zentrale Icons/Edit-UX:** `components/DeleteButton.vue` und `EditButton.vue` sind die einzige Stelle, an der die Icons (🗑️/✎) definiert sind – überall sonst wird die Komponente eingebunden. „Bearbeiten" öffnet konsistent ein `Modal.vue`-Popup (eigener Formular-State, getrennt vom Hinzufügen-Formular); nur sehr leichte Inline-Edits (z. B. Käufer:in-Zuweisung per Dropdown, Kategorie-Zielbudget-Betrag) bleiben bewusst inline, da dafür ein Popup unverhältnismäßig wäre.
- **Ideen-Status:** Drei Zustände (💡 Idee, ✅ Geplant, ❌ Verworfen), manuell per Button setzbar. „Geplant" wird zusätzlich automatisch gesetzt, sobald für die Idee ein Kalendereintrag angelegt wird (serverseitig in `POST/PUT /schedule`) – dadurch muss man eine Idee nicht mehr manuell als „geplant" markieren, bevor man sie in den Kalender ziehen kann. Die Ideen-Liste ist nach Status sortiert (Idee → Geplant → Verworfen).

### deploy.sh: zwei Bugs gefunden und behoben

1. **Netzwerk-Erreichbarkeit:** `deine-domain.de` ist von einem Gerät im selben Heimnetz wie der Pi aus nicht erreichbar (NAT-Hairpin – die Fritzbox routet von innen kommende Anfragen an die eigene öffentliche IP nicht zuverlässig zurück). Das Skript prüft jetzt zuerst per SSH, ob der Pi über die lokale Fritzbox-Adresse `dein-pi.fritz.box` erreichbar ist (funktioniert stabil über IPv6, unabhängig von der jeweils per DHCP vergebenen lokalen IP), und nutzt sonst die öffentliche Domain als Fallback. Damit funktioniert `./deploy.sh` unverändert sowohl von zuhause als auch unterwegs.
2. **Pfad-Mismatch Backend:** Der systemd-Service erwartet den kompilierten Code unter `~/reisotor/backend/dist/server.js` (`ExecStart=/usr/bin/node dist/server.js`), das Skript hat den Inhalt von `backend/dist/` bisher aber direkt nach `~/reisotor/backend/` synchronisiert (ohne `dist/`-Unterordner) – der Service fand `dist/server.js` dadurch nicht (`MODULE_NOT_FOUND`) und crashte im Restart-Loop. Jetzt wird `dist/` als eigener Rsync-Zielordner behandelt, getrennt von `package.json`/`package-lock.json`.

**Offene manuelle Schritte** (bewusst nicht von mir automatisiert, da sicherheitsrelevant):
- Auf dem Pi wurde noch nie `npm run seed` ausgeführt – die Produktions-DB hat aktuell keine Nutzer. Siehe Abschnitt „Deployment auf dem Raspberry Pi 2" oben für die Kommandozeile mit echten Zugangsdaten.
- Der systemd-Service setzt kein `SESSION_SECRET` (`/etc/systemd/system/reisotor.service`), läuft also aktuell mit dem unsicheren Dev-Fallback-Wert aus `server.ts`. Vor dem ersten echten Login sollte dort ein zufälliges Secret ergänzt und der Service neu gestartet werden.
- Caddy hatte beim ersten Check noch eine veraltete Konfiguration geladen (Testantwort statt Reverse Proxy) – mit `sudo systemctl reload caddy` behoben. Nach künftigen manuellen Caddyfile-Änderungen immer `reload` nicht vergessen.
- **Profil-Icon:** lebt jetzt im `AppHeader` oben rechts (statt in der Navigationsleiste), auf gleicher Höhe wie das Logo.

### Bugfix: kaputte Kartenmarker ("leeres Quadrat mit 'mark'")

Leaflets `Icon.Default._getIconUrl` versucht automatisch, den Bildpfad aus einer CSS-Regel (`.leaflet-default-icon-path`) zu erkennen und stellt diesen den eigentlichen Icon-URLs voran – auch wenn man über `mergeOptions` bereits vollständige, von Vite aufgelöste URLs gesetzt hat. Das Ergebnis war eine doppelt verschachtelte, 404-URL, wodurch der Browser nur das `alt`-Attribut ("marker icon", abgeschnitten zu "mark") anzeigte. Gelöst durch eigene Emoji-`divIcon`s statt der Standard-Icons (siehe oben).

### Bugfix: Karte zeigte gar nichts mehr an

Ursache war kein Code-Fehler, sondern ein verwaister, alter Vite-Dev-Server-Prozess aus einer früheren Sitzung, der still auf Port 5173 hängen geblieben war (während ein neuerer, im echten Terminal gestarteter Prozess mangels freiem Port gar nicht erst binden konnte) – vermutlich mit einem durch die vorherige Commit-Historie-Bereinigung (`git reset`/`cherry-pick`) verwirrten Modul-Cache. Behoben durch Beenden des alten Prozesses, Löschen von `frontend/node_modules/.vite` und sauberen Neustart.

### Bugfix: `FOREIGN KEY constraint failed` beim Löschen von Reise-Kosten

Die Budget-Sync-Logik hat beim Entfernen eines Betrags/beim Löschen eines Reise-Eintrags zuerst die verknüpfte `budget_items`-Zeile gelöscht, während `travel_items.budget_expense_id` noch darauf verwies – SQLite verweigert das per Foreign-Key-Constraint. Behoben durch Umkehren der Reihenfolge: erst die referenzierende `travel_items`-Zeile aktualisieren/löschen, danach erst die verwaiste `budget_items`-Zeile entfernen.
