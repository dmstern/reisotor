export async function requireAuth(req, reply) {
    if (!req.session.userId) {
        reply.code(401).send({ error: 'Nicht eingeloggt' });
    }
}
