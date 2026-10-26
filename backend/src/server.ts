import './loadEnv.js';
import { buildApp } from './app.js';
import { startDepartureReminderScheduler } from './departureReminders.js';
import { startWeatherSnapshotScheduler } from './weatherSnapshots.js';
import { getLegalConfig } from './routes/legal.js';

const port = Number(process.env.PORT ?? 3000);
const app = await buildApp();

const legalConfig = getLegalConfig();
if (!legalConfig.hasOperatorInfo) {
  app.log.warn(
    '[Legal] Betreiberangaben unvollständig oder nicht konfiguriert (LEGAL_OPERATOR_NAME, LEGAL_OPERATOR_ADDRESS, LEGAL_CONTACT_EMAIL). Das Impressum wird mit einem Warnhinweis ausgeliefert.'
  );
}

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

// Bewusst hier statt in app.ts registriert: app.ts wird auch von den Unit-Tests importiert (siehe
// test/helpers/buildTestApp.ts) - ein dort gestarteter setInterval würde in jedem Testlauf ohne
// zugehörigen Trip-Kontext unnötig weiterlaufen und Vitest am sauberen Beenden hindern.
startDepartureReminderScheduler();
startWeatherSnapshotScheduler();
