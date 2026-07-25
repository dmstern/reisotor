import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Liegt außerhalb von dist/, damit Uploads ein `npm run build` überleben.
export const uploadsDir = process.env.UPLOADS_DIR ?? path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
