import type { FastifyPluginAsync } from 'fastify';
import { requireTripMember } from '../tripAccess.js';
import { getDirections } from '../services/routingService.js';

interface DirectionsBody {
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  transport_type?: string;
  profile?: string;
  preference?: 'fastest' | 'shortest';
}

export const routingRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { tripId: string }; Body: DirectionsBody }>(
    '/trips/:tripId/routes/directions',
    async (req, reply) => {
      const tripId = Number(req.params.tripId);
      if (!Number.isFinite(tripId)) {
        return reply.code(400).send({ error: 'Ungültige trip_id' });
      }

      if (!requireTripMember(reply, tripId, req.session.userId)) return;

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
};
