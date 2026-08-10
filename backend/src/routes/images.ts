import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadsDir } from '../uploads.js';

interface ImageUploadBody {
  data: string;
}

// Generischer Bild-Upload für reine image_url-Felder (Trip-/Spot-/Tour-Titelbild, siehe
// components/ImageUrlInput.vue) – anders als attachments.ts braucht das hier keine
// domain/entity_id-Bindung, das Ergebnis ist am Ende nur ein URL-String im image_url-Feld der
// jeweiligen Zeile, keine eigene verknüpfte Datei-Referenz. Analog zu routes/diary.ts's eigenem
// /diary/images (dort zusätzlich an dessen Galerie-Flow gebunden) – bewusst ein eigener, schlanker
// Endpoint statt beide zusammenzulegen, um diary.ts unangetastet zu lassen.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const imagesRoutes: FastifyPluginAsync = async (app) => {
  // Nimmt ein bereits client-seitig (Canvas-API, siehe utils/imageCompression.ts) verkleinertes/
  // komprimiertes Bild als Data-URL entgegen und legt es als Datei ab – bewusst kein serverseitiges
  // Resizing (z. B. via sharp), das ist auf dem ressourcenschwachen Raspberry Pi 2 zu teuer.
  app.post<{ Body: ImageUploadBody }>('/images', async (req, reply) => {
    const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(req.body?.data ?? '');
    if (!match) return reply.code(400).send({ error: 'Ungültiges Bildformat' });

    const [, mimeType, base64] = match;
    const extension = ALLOWED_IMAGE_TYPES[mimeType];
    if (!extension) return reply.code(400).send({ error: 'Nicht unterstützter Bildtyp' });

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return reply.code(413).send({ error: 'Bild ist zu groß (max. 5 MB nach Komprimierung)' });
    }

    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadsDir, filename), buffer);
    reply.code(201);
    return { url: `/api/uploads/${filename}` };
  });
};
