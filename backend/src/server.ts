import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import cors from '@fastify/cors';
import './db/index.js';
import { authRoutes } from './routes/auth.js';
import { requireAuth } from './auth.js';
import { tripRoutes } from './routes/trip.js';
import { scheduleRoutes } from './routes/schedule.js';
import { packingRoutes } from './routes/packing.js';
import { ideasRoutes } from './routes/ideas.js';
import { spotsRoutes } from './routes/spots.js';
import { accommodationRoutes } from './routes/accommodation.js';
import { budgetRoutes } from './routes/budget.js';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const sessionSecret = process.env.SESSION_SECRET ?? 'dev-secret-please-change-me-32chars';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: isProd ? false : ['http://localhost:5173'],
  credentials: true,
});

await app.register(cookie);
await app.register(session, {
  secret: sessionSecret,
  cookie: {
    secure: isProd,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 Tage, "eingeloggt bleiben"
  },
});

app.register(
  async (api) => {
    await api.register(authRoutes, { prefix: '/auth' });

    api.addHook('preHandler', requireAuth);
    await api.register(tripRoutes);
    await api.register(scheduleRoutes);
    await api.register(packingRoutes);
    await api.register(ideasRoutes);
    await api.register(spotsRoutes);
    await api.register(accommodationRoutes);
    await api.register(budgetRoutes);
  },
  { prefix: '/api' },
);

app
  .listen({ port, host: '0.0.0.0' })
  .then((addr) => app.log.info(`Reisotor backend läuft auf ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
