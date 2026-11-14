import type { FastifyPluginAsync } from 'fastify';
import { requireTripMember } from '../tripAccess.js';
import {
  getDirections,
  getBatchRouteSummaries,
  type BatchRouteRequestItem,
} from '../services/routingService.js';

interface DirectionsBody {
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  transport_type?: string;
  profile?: string;
  preference?: 'fastest' | 'shortest';
}

interface BatchSummaryItemInput {
  key: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  profile?: 'foot-walking' | 'cycling-regular' | 'driving-car';
}

const MAX_BATCH_ITEMS = 100;

export const routingRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { tripId: string }; Body: DirectionsBody }>(
    '/trips/:tripId/routes/directions',
    async (req, reply) => {
      const tripId = Number(req.params.tripId);

      if (!Number.isFinite(tripId)) {
        return reply.code(400).send({ error: 'Ungültige trip_id' });
      }

      if (!requireTripMember(reply, tripId, req.session.userId)) {
        return;
      }

      const { from_lat, from_lng, to_lat, to_lng, transport_type, profile, preference } =
        req.body ?? {};

      if (
        typeof from_lat !== 'number' ||
        typeof from_lng !== 'number' ||
        typeof to_lat !== 'number' ||
        typeof to_lng !== 'number' ||
        !Number.isFinite(from_lat) ||
        !Number.isFinite(from_lng) ||
        !Number.isFinite(to_lat) ||
        !Number.isFinite(to_lng)
      ) {
        return reply
          .code(400)
          .send({ error: 'Start- und Zielkoordinaten müssen gültige Zahlen sein' });
      }

      const result = await getDirections({
        from: { lat: from_lat, lng: from_lng },
        to: { lat: to_lat, lng: to_lng },
        transportType: transport_type,
        profile,
        preference,
      });

      return reply.send(result);
    }
  );

  app.post<{ Params: { tripId: string }; Body: { items?: BatchSummaryItemInput[] } }>(
    '/trips/:tripId/routes/batch-summary',
    async (req, reply) => {
      const tripId = Number(req.params.tripId);

      if (!Number.isFinite(tripId)) {
        return reply.code(400).send({ error: 'Ungültige trip_id' });
      }

      if (!requireTripMember(reply, tripId, req.session.userId)) {
        return;
      }

      const rawItems = req.body?.items;

      if (!Array.isArray(rawItems)) {
        return reply.code(400).send({ error: 'items muss ein Array sein' });
      }

      if (rawItems.length > MAX_BATCH_ITEMS) {
        return reply
          .code(400)
          .send({ error: `Maximal ${MAX_BATCH_ITEMS} Einträge pro Batch-Anfrage erlaubt` });
      }

      const validItems: BatchRouteRequestItem[] = [];

      for (const item of rawItems) {
        if (
          typeof item?.key !== 'string' ||
          !item.key ||
          typeof item.from_lat !== 'number' ||
          typeof item.from_lng !== 'number' ||
          typeof item.to_lat !== 'number' ||
          typeof item.to_lng !== 'number' ||
          !Number.isFinite(item.from_lat) ||
          !Number.isFinite(item.from_lng) ||
          !Number.isFinite(item.to_lat) ||
          !Number.isFinite(item.to_lng)
        ) {
          continue;
        }

        const validProfile =
          item.profile === 'foot-walking' ||
          item.profile === 'cycling-regular' ||
          item.profile === 'driving-car'
            ? item.profile
            : 'driving-car';

        validItems.push({
          key: item.key,
          from: { lat: item.from_lat, lng: item.from_lng },
          to: { lat: item.to_lat, lng: item.to_lng },
          profile: validProfile,
        });
      }

      const results = await getBatchRouteSummaries(validItems);
      return reply.send({ results });
    }
  );
};
