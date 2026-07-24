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
- **`trip` und `accommodation`:** Als Singleton behandelt (feste `id = 1`), passend zum "kein Multi-Trip-Support"-Constraint. `PUT` macht ein Upsert.
- **Kalenderwoche:** Wochen beginnen Montag; die erste/letzte Woche wird auf volle 7 Tage aufgefüllt, auch wenn sie über den Reisezeitraum hinausragt (rein UI-seitig, ohne Datenänderung).
- **Icons in der Navigation:** Emoji statt Icon-Font/SVG-Set, um Bundle-Größe und Abhängigkeiten gering zu halten.
