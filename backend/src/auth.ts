import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface Session {
    userId?: number;
    username?: string;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session.userId) {
    reply.code(401).send({ error: 'Nicht eingeloggt' });
  }
}
