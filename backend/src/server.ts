import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const app = await buildApp();

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
