import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import './db/index.js';
import { SqliteSessionStore } from './sessionStore.js';
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
import { spotsRoutes } from './routes/spots.js';
import { buildInfoRoutes } from './routes/buildInfo.js';
import { trashRoutes } from './routes/trash.js';

// Von server.ts getrennt (das nur noch buildApp() aufruft und .listen()), damit Tests eine fertig
// konfigurierte App-Instanz per Fastify .inject() ansprechen können, ohne einen echten Port zu
// binden (siehe backend/test/helpers/buildTestApp.ts).
export async function buildApp(opts: { logger?: boolean } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET ?? 'dev-secret-please-change-me-32chars';

  // trustProxy: hinter Caddy (TLS-Terminierung) sieht Fastify sonst nur die interne
  // Klartext-Verbindung und hält request.protocol für 'http' – die Session-Cookie-Logik
  // von @fastify/session verweigert dann bei cookie.secure=true (Produktion) das Setzen
  // des Set-Cookie-Headers komplett (siehe isInsecureConnection-Check dort). Mit
  // trustProxy wertet Fastify den von Caddy gesetzten X-Forwarded-Proto-Header aus.
  // logger per Options-Override abschaltbar (Tests) - Default bleibt true, wie bisher.
  const app = Fastify({ logger: opts.logger ?? true, bodyLimit: 10 * 1024 * 1024, trustProxy: true });

  // CORS_ORIGIN erlaubt der e2e-Testsuite (/e2e), Backend+Frontend auf eigenen Ports parallel zum
  // normalen lokalen Dev-Server laufen zu lassen, ohne dessen Origin (Default: Vite auf 5173) zu
  // verändern. Kommagetrennt für mehrere Origins.
  const devOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) ?? ['http://localhost:5173'];
  await app.register(cors, {
    origin: isProd ? false : devOrigins,
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
    // Ohne eigenen store hält @fastify/session Sessions nur im Arbeitsspeicher (laut eigener
    // Dokumentation "should not be used in a production environment") – jeder Prozess-Neustart
    // (Crash, Deploy, OOM auf dem Pi) würde sonst alle Logins killen, ohne dass das Frontend das
    // bemerkt (siehe api/client.ts, das solche 401s jetzt abfängt und zur Login-Seite umleitet;
    // der persistente Store hier verhindert das Problem aber schon an der Wurzel).
    store: new SqliteSessionStore(),
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
        await protectedApi.register(spotsRoutes);
        await protectedApi.register(buildInfoRoutes);
        await protectedApi.register(trashRoutes);
      });
    },
    { prefix: '/api' },
  );

  await app.ready();
  return app;
}
