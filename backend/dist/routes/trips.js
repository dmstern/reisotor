import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { uploadsDir } from '../uploads.js';
import { resolveCountry, fetchRegionInfo } from '../utils/regionInfo.js';
export const tripsRoutes = async (app) => {
    // Nur Urlaube zeigen, denen die eingeloggte Person als Mitglied angehört (trip_members, siehe
    // tripAccess.ts) – vorher implizit für alle Nutzer:innen sichtbar (siehe CLAUDE.md-Kommentar in
    // db/index.ts zum Backfill).
    app.get('/trips', async (req) => {
        return db
            .prepare(`SELECT trips.* FROM trips
         JOIN trip_members ON trip_members.trip_id = trips.id
         WHERE trip_members.user_id = ?
         ORDER BY trips.id`)
            .all(req.session.userId);
    });
    app.get('/trips/:id', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
        if (!trip)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        return trip;
    });
    app.post('/trips', async (req, reply) => {
        const { name, destination, start_date, end_date, maps_link } = req.body;
        let { lat, lng, image_url } = req.body;
        if ((lat == null || lng == null) && maps_link) {
            const resolved = await resolveLatLng(maps_link);
            lat = resolved?.lat;
            lng = resolved?.lng;
        }
        if (!image_url && lat != null && lng != null) {
            image_url = tilePreviewUrl(lat, lng);
        }
        const packingCategoryRequired = req.body.packing_category_required !== false ? 1 : 0;
        const result = db
            .prepare('INSERT INTO trips (name, destination, start_date, end_date, maps_link, lat, lng, image_url, packing_category_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(name, destination ?? null, start_date, end_date, maps_link ?? null, lat ?? null, lng ?? null, image_url ?? null, packingCategoryRequired);
        const tripId = result.lastInsertRowid;
        // Neu angelegter Urlaub ist zunächst nur für die anlegende Person sichtbar – weitere
        // Mitglieder kommen nur per Einladung dazu (routes/trips.ts's POST /trips/:id/members).
        db.prepare('INSERT INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)').run(tripId, req.session.userId, new Date().toISOString());
        ensureDefaultSharedBudget(tripId);
        reply.code(201);
        return db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
    });
    app.put('/trips/:id', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        const existing = db.prepare('SELECT lat, lng FROM trips WHERE id = ?').get(req.params.id);
        if (!existing)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        const { name, destination, start_date, end_date, maps_link } = req.body;
        let { lat, lng, image_url } = req.body;
        if ((lat == null || lng == null) && maps_link) {
            const resolved = await resolveLatLng(maps_link);
            lat = resolved?.lat;
            lng = resolved?.lng;
        }
        // Schlägt die (erneute) Auflösung fehl, obwohl weiterhin ein Maps-Link hinterlegt ist (z. B.
        // transienter Netzwerkfehler beim Bearbeiten eines unabhängigen Felds), bisherige Koordinaten
        // behalten statt sie zu löschen. Wird der Maps-Link dagegen bewusst geleert, bleibt lat/lng wie
        // bisher null (Ort wurde absichtlich entfernt).
        if ((lat == null || lng == null) && maps_link) {
            lat = lat ?? existing.lat ?? undefined;
            lng = lng ?? existing.lng ?? undefined;
        }
        if (!image_url && lat != null && lng != null) {
            image_url = tilePreviewUrl(lat, lng);
        }
        const packingCategoryRequired = req.body.packing_category_required !== false ? 1 : 0;
        const result = db
            .prepare('UPDATE trips SET name = ?, destination = ?, start_date = ?, end_date = ?, maps_link = ?, lat = ?, lng = ?, image_url = ?, packing_category_required = ? WHERE id = ?')
            .run(name, destination ?? null, start_date, end_date, maps_link ?? null, lat ?? null, lng ?? null, image_url ?? null, packingCategoryRequired, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        return db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
    });
    app.delete('/trips/:id', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        // Datei-Anhänge (attachments.trip_id) werden per ON DELETE CASCADE zwar automatisch als
        // DB-Zeile mitgelöscht, die eigentlichen Dateien auf der Platte bleiben davon aber unberührt –
        // hier vorab einsammeln und danach entfernen, sonst blieben sie dauerhaft verwaist liegen.
        const attachmentFiles = db.prepare('SELECT filename FROM attachments WHERE trip_id = ?').all(req.params.id);
        const result = db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        for (const { filename } of attachmentFiles) {
            await unlink(path.join(uploadsDir, filename)).catch(() => { });
        }
        return reply.code(204).send();
    });
    // Reiseregion-Infos fürs Dashboard (Sprache/Währung/Wechselkurs/Reisewarnung, siehe
    // utils/regionInfo.ts). country_code/country_name werden einmalig per Reverse-Geocoding aus
    // lat/lng ermittelt und dauerhaft in trips persistiert – nur neu aufgelöst, wenn diese noch
    // fehlen (ändert sich der Urlaubsort später, wird PUT /trips/:id NICHT rückwirkend erneut
    // auflösen; das wäre ein seltener Fall und der Nutzer kann den Urlaub bei Bedarf neu anlegen).
    app.get('/trips/:id/region-info', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
        if (!trip)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        let countryCode = trip.country_code;
        let countryName = trip.country_name;
        if (!countryCode && trip.lat != null && trip.lng != null) {
            const resolved = await resolveCountry(trip.lat, trip.lng);
            if (resolved) {
                countryCode = resolved.code;
                countryName = resolved.name;
                db.prepare('UPDATE trips SET country_code = ?, country_name = ? WHERE id = ?').run(countryCode, countryName, req.params.id);
            }
        }
        if (!countryCode) {
            return { countryName: null, languages: [], currency: null, exchangeRate: null, advisory: null };
        }
        const info = await fetchRegionInfo(countryCode, req.query.home_currency ?? null);
        return { countryName, ...info };
    });
    // --- Mitgliedschaft/Einladung (Batch: Registrierung + Einladung) ---
    app.get('/trips/:id/members', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        return db
            .prepare(`SELECT users.id, users.username, users.avatar FROM users
         JOIN trip_members ON trip_members.user_id = users.id
         WHERE trip_members.trip_id = ?
         ORDER BY users.id`)
            .all(req.params.id);
    });
    // Einladen kann nur, wer selbst schon Mitglied ist – die einzuladende Person wird per
    // Autocomplete-Suche gefunden (GET /users/search, routes/users.ts), damit hier keine
    // Rollenprüfung über die reine Mitgliedschaft hinaus nötig ist (kein Owner-/Admin-Konzept,
    // jedes Mitglied kann weitere Mitglieder einladen).
    app.post('/trips/:id/members', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        const { user_id } = req.body ?? {};
        if (!user_id)
            return reply.code(400).send({ error: 'user_id erforderlich' });
        const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(user_id);
        if (!user)
            return reply.code(404).send({ error: 'Nutzer:in nicht gefunden' });
        db.prepare('INSERT OR IGNORE INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)').run(req.params.id, user_id, new Date().toISOString());
        recordActivity(Number(req.params.id), 'members', user_id, 'member_added', req.session.userId);
        reply.code(201);
        return user;
    });
    // Mitgliedschaft wieder entfernen – bewusst ohne Sonderregel für die letzte verbleibende Person
    // oder die anlegende Person (kein Owner-Konzept, siehe oben): würde das den Urlaub komplett ohne
    // Mitglieder zurücklassen, bleibt er weiterhin über die trip_id direkt erreichbar für niemanden
    // mehr – ein bewusst einfaches Verhalten statt zusätzlicher Sonderfälle.
    app.delete('/trips/:id/members/:userId', async (req, reply) => {
        if (!requireTripMember(reply, req.params.id, req.session.userId))
            return;
        db.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
        recordActivity(Number(req.params.id), 'members', Number(req.params.userId), 'member_removed', req.session.userId);
        return reply.code(204).send();
    });
};
