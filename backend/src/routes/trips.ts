import type { FastifyPluginAsync } from 'fastify';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { uploadsDir } from '../uploads.js';
import { resolveCountry, fetchRegionInfo } from '../utils/regionInfo.js';
import {
  isUserRestricted,
  isTripOwnerRestricted,
  countTripsCreatedBy,
  RESTRICTED_MAX_TRIPS,
  RESTRICTED_MAX_MEMBERS,
} from '../registrationConfig.js';
import { refreshTripWeatherSnapshots } from '../weatherSnapshots.js';

interface TripBody {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
  packing_category_required?: boolean;
}

export const tripsRoutes: FastifyPluginAsync = async (app) => {
  // Nur Urlaube zeigen, denen die eingeloggte Person als Mitglied angehört (trip_members, siehe
  // tripAccess.ts) – vorher implizit für alle Nutzer:innen sichtbar (siehe CLAUDE.md-Kommentar in
  // db/index.ts zum Backfill).
  app.get('/trips', async (req) => {
    const trips = db
      .prepare(
        `SELECT trips.* FROM trips
         JOIN trip_members ON trip_members.trip_id = trips.id
         WHERE trip_members.user_id = ?
         ORDER BY trips.id`,
      )
      .all(req.session.userId) as { id: number }[];
    // owner_restricted steuert im Frontend (TripMembersDialog.vue), ob der 3-Mitglieder-Deckel
    // aus Issue #96 für diesen Urlaub greift – am Urlaub selbst hängend statt nur am eigenen
    // restricted-Status, da der Deckel von der anlegenden Person abhängt, nicht von der
    // gerade einladenden.
    return trips.map((trip) => ({ ...trip, owner_restricted: isTripOwnerRestricted(trip.id) }));
  });

  app.get<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
    if (!trip) return reply.code(404).send({ error: 'Nicht gefunden' });
    return { ...trip, owner_restricted: isTripOwnerRestricted(req.params.id) };
  });

  app.post<{ Body: TripBody }>('/trips', async (req, reply) => {
    if (isUserRestricted(req.session.userId) && countTripsCreatedBy(req.session.userId!) >= RESTRICTED_MAX_TRIPS) {
      return reply.code(403).send({ error: 'Eingeschränkter Modus - Nur ein Urlaub pro Nutzer' });
    }
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
      .prepare(
        'INSERT INTO trips (name, destination, start_date, end_date, maps_link, lat, lng, image_url, packing_category_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        name,
        destination ?? null,
        start_date,
        end_date,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        image_url ?? null,
        packingCategoryRequired,
      );
    const tripId = result.lastInsertRowid as number;
    // Neu angelegter Urlaub ist zunächst nur für die anlegende Person sichtbar – weitere
    // Mitglieder kommen nur per Einladung dazu (routes/trips.ts's POST /trips/:id/members).
    db.prepare('INSERT INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)').run(
      tripId,
      req.session.userId,
      new Date().toISOString(),
    );
    ensureDefaultSharedBudget(tripId);
    reply.code(201);
    return db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  });

  app.put<{ Params: { id: string }; Body: TripBody }>('/trips/:id', async (req, reply) => {
    if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
    const existing = db.prepare('SELECT lat, lng FROM trips WHERE id = ?').get(req.params.id) as
      | { lat: number | null; lng: number | null }
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

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
    // Rundung statt exaktem Vergleich, damit ein unveränderter Ort (z.B. maps_link bleibt gleich,
    // resolveLatLng liefert aber minimal abweichende Nachkommastellen) nicht fälschlich als
    // Orts-Änderung gilt und unnötig einen Weather-Refresh auslöst.
    const roundCoord = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10000) / 10000);
    const locationChanged =
      roundCoord(lat) !== roundCoord(existing.lat) || roundCoord(lng) !== roundCoord(existing.lng);

    const packingCategoryRequired = req.body.packing_category_required !== false ? 1 : 0;
    const result = db
      .prepare(
        'UPDATE trips SET name = ?, destination = ?, start_date = ?, end_date = ?, maps_link = ?, lat = ?, lng = ?, image_url = ?, packing_category_required = ? WHERE id = ?',
      )
      .run(
        name,
        destination ?? null,
        start_date,
        end_date,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        image_url ?? null,
        packingCategoryRequired,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });

    // Ändert sich der Ort, sind zuvor gespeicherte Wetter-Ist-Werte vergangener Tage
    // (trip_weather_snapshots, siehe weatherSnapshots.ts) noch zum alten Ort gehörig und damit
    // falsch - sie werden gelöscht und asynchron (nicht blockierend für diese Response) neu geholt.
    if (locationChanged) {
      db.prepare('DELETE FROM trip_weather_snapshots WHERE trip_id = ?').run(req.params.id);
      refreshTripWeatherSnapshots(Number(req.params.id)).catch((err) =>
        app.log.error(err, `weatherSnapshots: refresh after location change failed for trip ${req.params.id}`),
      );
    }

    return db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
    // Datei-Anhänge (attachments.trip_id) werden per ON DELETE CASCADE zwar automatisch als
    // DB-Zeile mitgelöscht, die eigentlichen Dateien auf der Platte bleiben davon aber unberührt –
    // hier vorab einsammeln und danach entfernen, sonst blieben sie dauerhaft verwaist liegen.
    const attachmentFiles = db.prepare('SELECT filename FROM attachments WHERE trip_id = ?').all(req.params.id) as {
      filename: string;
    }[];
    const result = db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    for (const { filename } of attachmentFiles) {
      await unlink(path.join(uploadsDir, filename)).catch(() => {});
    }
    return reply.code(204).send();
  });

  // Reiseregion-Infos fürs Dashboard (Sprache/Währung/Wechselkurs/Reisewarnung, siehe
  // utils/regionInfo.ts). country_code/country_name werden einmalig per Reverse-Geocoding aus
  // lat/lng ermittelt und dauerhaft in trips persistiert – nur neu aufgelöst, wenn diese noch
  // fehlen (ändert sich der Urlaubsort später, wird PUT /trips/:id NICHT rückwirkend erneut
  // auflösen; das wäre ein seltener Fall und der Nutzer kann den Urlaub bei Bedarf neu anlegen).
  app.get<{ Params: { id: string }; Querystring: { home_currency?: string } }>(
    '/trips/:id/region-info',
    async (req, reply) => {
      if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
      const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id) as
        | { lat: number | null; lng: number | null; country_code: string | null; country_name: string | null }
        | undefined;
      if (!trip) return reply.code(404).send({ error: 'Nicht gefunden' });

      let countryCode = trip.country_code;
      let countryName = trip.country_name;
      if (!countryCode && trip.lat != null && trip.lng != null) {
        const resolved = await resolveCountry(trip.lat, trip.lng);
        if (resolved) {
          countryCode = resolved.code;
          countryName = resolved.name;
          db.prepare('UPDATE trips SET country_code = ?, country_name = ? WHERE id = ?').run(
            countryCode,
            countryName,
            req.params.id,
          );
        }
      }
      if (!countryCode) {
        return { countryName: null, languages: [], currency: null, exchangeRate: null, advisory: null };
      }

      const info = await fetchRegionInfo(countryCode, req.query.home_currency ?? null);
      return { countryName, ...info };
    },
  );

  // Dauerhaft gespeicherte Wetter-Ist-Werte vergangener Urlaubstage (weatherSnapshots.ts, siehe
  // db/index.ts's trip_weather_snapshots) - ergänzt im Frontend die live von Open-Meteo geholte
  // Vorhersage (die selbst nur ~16 Tage im Voraus/1 Tag rückwirkend abdeckt) um beliebig weit
  // zurückliegende Tage, damit das Wetter eines Urlaubs auch lange nach dessen Ende noch anzeigbar
  // bleibt (Dashboard-Rückblick, Tagebuch).
  app.get<{ Params: { id: string }; Querystring: { lat?: string; lng?: string } }>(
    '/trips/:id/weather-history',
    async (req, reply) => {
      if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
      const { lat, lng } = req.query;
      type SnapshotRow = {
        date: string;
        weathercode: number;
        temp_max: number;
        temp_min: number;
        precipitation_probability: number | null;
      };

      if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
        const numLat = Number(lat);
        const numLng = Number(lng);
        const specific = db
          .prepare(
            `SELECT date, weathercode, temp_max, temp_min, precipitation_probability
             FROM trip_weather_snapshots
             WHERE trip_id = ? AND ROUND(lat, 3) = ROUND(?, 3) AND ROUND(lng, 3) = ROUND(?, 3)
             ORDER BY date`,
          )
          .all(req.params.id, numLat, numLng) as SnapshotRow[];

        const fallback = db
          .prepare(
            `SELECT date, weathercode, temp_max, temp_min, precipitation_probability
             FROM trip_weather_snapshots
             WHERE trip_id = ? AND lat IS NULL
             ORDER BY date`,
          )
          .all(req.params.id) as SnapshotRow[];

        const map = new Map<string, SnapshotRow>();
        for (const item of fallback) map.set(item.date, item);
        for (const item of specific) map.set(item.date, item);
        return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      }

      return db
        .prepare(
          `SELECT date, weathercode, temp_max, temp_min, precipitation_probability
           FROM trip_weather_snapshots
           WHERE trip_id = ?
           GROUP BY date
           ORDER BY date`,
        )
        .all(req.params.id);
    },
  );

  // --- Mitgliedschaft/Einladung (Batch: Registrierung + Einladung) ---

  app.get<{ Params: { id: string } }>('/trips/:id/members', async (req, reply) => {
    if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT users.id, users.username, users.avatar FROM users
         JOIN trip_members ON trip_members.user_id = users.id
         WHERE trip_members.trip_id = ?
         ORDER BY users.id`,
      )
      .all(req.params.id);
  });

  // Einladen kann nur, wer selbst schon Mitglied ist – die einzuladende Person wird per
  // Autocomplete-Suche gefunden (GET /users/search, routes/users.ts), damit hier keine
  // Rollenprüfung über die reine Mitgliedschaft hinaus nötig ist (kein Owner-/Admin-Konzept,
  // jedes Mitglied kann weitere Mitglieder einladen).
  app.post<{ Params: { id: string }; Body: { user_id: number } }>('/trips/:id/members', async (req, reply) => {
    if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
    const { user_id } = req.body ?? {};
    if (!user_id) return reply.code(400).send({ error: 'user_id erforderlich' });

    if (isTripOwnerRestricted(req.params.id)) {
      const memberCount = (
        db.prepare('SELECT COUNT(*) as count FROM trip_members WHERE trip_id = ?').get(req.params.id) as {
          count: number;
        }
      ).count;
      if (memberCount >= RESTRICTED_MAX_MEMBERS) {
        return reply.code(403).send({ error: 'Eingeschränkter Modus - Maximal drei Nutzer pro Urlaub' });
      }
    }

    const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(user_id);
    if (!user) return reply.code(404).send({ error: 'Nutzer:in nicht gefunden' });

    db.prepare('INSERT OR IGNORE INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)').run(
      req.params.id,
      user_id,
      new Date().toISOString(),
    );
    recordActivity(Number(req.params.id), 'members', user_id, 'member_added', req.session.userId!);
    reply.code(201);
    return user;
  });

  // Mitgliedschaft wieder entfernen – bewusst ohne Sonderregel für die letzte verbleibende Person
  // oder die anlegende Person (kein Owner-Konzept, siehe oben): würde das den Urlaub komplett ohne
  // Mitglieder zurücklassen, bleibt er weiterhin über die trip_id direkt erreichbar für niemanden
  // mehr – ein bewusst einfaches Verhalten statt zusätzlicher Sonderfälle.
  app.delete<{ Params: { id: string; userId: string } }>('/trips/:id/members/:userId', async (req, reply) => {
    if (!requireTripMember(reply, req.params.id, req.session.userId)) return;
    db.prepare('DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
    recordActivity(Number(req.params.id), 'members', Number(req.params.userId), 'member_removed', req.session.userId!);
    return reply.code(204).send();
  });
};
