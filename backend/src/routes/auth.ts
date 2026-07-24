import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { username: string; password: string } }>('/login', async (req, reply) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Ungültige Anmeldedaten' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    return { id: user.id, username: user.username };
  });

  app.post('/logout', async (req, reply) => {
    await req.session.destroy();
    return reply.code(204).send();
  });

  app.get('/me', async (req, reply) => {
    if (!req.session.userId) {
      return reply.code(401).send({ error: 'Nicht eingeloggt' });
    }
    return { id: req.session.userId, username: req.session.username };
  });
};
