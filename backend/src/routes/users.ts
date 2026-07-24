import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  avatar: string;
}

interface CreateUserBody {
  username: string;
  password: string;
  avatar?: string;
}

interface AvatarBody {
  avatar: string;
}

interface PasswordBody {
  currentPassword: string;
  newPassword: string;
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users', async () => {
    return db.prepare('SELECT id, username, avatar FROM users ORDER BY id').all();
  });

  app.post<{ Body: CreateUserBody }>('/users', async (req, reply) => {
    const { username, password, avatar } = req.body ?? {};
    if (!username?.trim() || !password) {
      return reply.code(400).send({ error: 'Benutzername und Passwort erforderlich' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return reply.code(409).send({ error: 'Benutzername bereits vergeben' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run(username.trim(), hash, avatar ?? '🙂');
    reply.code(201);
    return db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Body: AvatarBody }>('/users/me/avatar', async (req, reply) => {
    const { avatar } = req.body ?? {};
    if (!avatar) return reply.code(400).send({ error: 'Avatar erforderlich' });

    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.session.userId);
    return db
      .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
      .get(req.session.userId);
  });

  app.put<{ Body: PasswordBody }>('/users/me/password', async (req, reply) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Aktuelles und neues Passwort erforderlich' });
    }
    if (newPassword.length < 6) {
      return reply.code(400).send({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' });
    }

    const user = db
      .prepare('SELECT id, password_hash FROM users WHERE id = ?')
      .get(req.session.userId) as Pick<UserRow, 'id' | 'password_hash'> | undefined;

    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return reply.code(401).send({ error: 'Aktuelles Passwort ist falsch' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    return reply.code(204).send();
  });
};
