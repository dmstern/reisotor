import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import './db/index.js';
import { uploadsDir } from './uploads.js';
import { authRoutes } from './routes/auth.js';
import { requireAuth } from './auth.js';
import { tripsRoutes } from './routes/trips.js';
import { scheduleRoutes } from './routes/schedule.js';
import { packingRoutes } from './routes/packing.js';
import { ideasRoutes } from './routes/ideas.js';
import { accommodationRoutes } from './routes/accommodation.js';
import { budgetRoutes } from './routes/budget.js';
import { usersRoutes } from './routes/users.js';
import { backupRoutes } from './routes/backup.js';
import { shoppingRoutes } from './routes/shopping.js';
import { todosRoutes } from './routes/todos.js';
import { notesRoutes } from './routes/notes.js';
import { diaryRoutes } from './routes/diary.js';
import { travelRoutes } from './routes/travel.js';

const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const sessionSecret = process.env.SESSION_SECRET ?? 'dev-secret-please-change-me-32chars';

// trustProxy: hinter Caddy (TLS-Terminierung) sieht Fastify sonst nur die interne
// Klartext-Verbindung und hält request.protocol für 'http' – die Session-Cookie-Logik
// von @fastify/session verweigert dann bei cookie.secure=true (Produktion) das Setzen
// des Set-Cookie-Headers komplett (siehe isInsecureConnection-Check dort). Mit
// trustProxy wertet Fastify den von Caddy gesetzten X-Forwarded-Proto-Header aus.
const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024, trustProxy: true });

await app.register(cors, {
  origin: isProd ? false : ['http://localhost:5173'],
  credentials: true,
});

// Hochgeladene (bereits client-seitig komprimierte) Tagebuch-Bilder werden unter /api/uploads/
// ausgeliefert, damit der bestehende Caddy-Proxy (nur /api/* -> Backend) ohne Anpassung reicht.
// Bewusst ohne Auth-Check auf Auslieferung: nur Upload erfordert eine Session, das Betrachten
// eines Bildlinks (wie bei jedem anderen <img src>) nicht.
await app.register(fastifyStatic, { root: uploadsDir, prefix: '/api/uploads/' });

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

    await api.register(async (protectedApi) => {
      protectedApi.addHook('preHandler', requireAuth);
      await protectedApi.register(tripsRoutes);
      await protectedApi.register(scheduleRoutes);
      await protectedApi.register(packingRoutes);
      await protectedApi.register(ideasRoutes);
      await protectedApi.register(accommodationRoutes);
      await protectedApi.register(budgetRoutes);
      await protectedApi.register(usersRoutes);
      await protectedApi.register(backupRoutes);
      await protectedApi.register(shoppingRoutes);
      await protectedApi.register(todosRoutes);
      await protectedApi.register(notesRoutes);
      await protectedApi.register(diaryRoutes);
      await protectedApi.register(travelRoutes);
    });
  },
  { prefix: '/api' },
);

app
  // Nur auf localhost lauschen: Caddy läuft auf demselben Host und proxied
  // /api/* auf localhost:3000 – ein Binding auf 0.0.0.0 würde das Backend
  // direkt aus dem Internet erreichbar machen und Caddys HTTPS umgehen.
  .listen({ port, host: '127.0.0.1' })
  .then((addr) => app.log.info(`Reisotor backend läuft auf ${addr}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
