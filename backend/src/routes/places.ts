import type { FastifyPluginAsync } from 'fastify';
import { searchPlaces, reverseGeocode } from '../utils/places.js';

export const placesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: {
      q?: string;
      lat?: string | number;
      lng?: string | number;
      limit?: string | number;
      lang?: string;
    };
  }>(
    '/places/search',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            limit: { type: 'number' },
            lang: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const rawQ = req.query.q;
      if (!rawQ || typeof rawQ !== 'string' || !rawQ.trim()) {
        return reply.code(400).send({ error: 'Suchbegriff erforderlich' });
      }

      const q = rawQ.trim();
      const rawLat = req.query.lat != null ? Number(req.query.lat) : undefined;
      const rawLng = req.query.lng != null ? Number(req.query.lng) : undefined;
      let limit = req.query.limit != null ? Number(req.query.limit) : 5;
      if (!Number.isFinite(limit) || limit < 1) limit = 5;
      if (limit > 10) limit = 10;

      const lat = rawLat != null && Number.isFinite(rawLat) ? rawLat : undefined;
      const lng = rawLng != null && Number.isFinite(rawLng) ? rawLng : undefined;

      const results = await searchPlaces({
        q,
        lat,
        lng,
        limit,
        lang: req.query.lang,
      });

      return results;
    }
  );

  app.get<{
    Querystring: {
      lat?: string | number;
      lng?: string | number;
      lang?: string;
    };
  }>('/places/reverse', async (req, reply) => {
    const rawLat = req.query.lat != null ? Number(req.query.lat) : NaN;
    const rawLng = req.query.lng != null ? Number(req.query.lng) : NaN;

    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
      return reply.code(400).send({ error: 'Gültige Koordinaten (lat, lng) erforderlich' });
    }

    const result = await reverseGeocode({
      lat: rawLat,
      lng: rawLng,
      lang: req.query.lang,
    });

    return result;
  });
};
