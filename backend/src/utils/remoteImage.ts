import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { uploadsDir } from '../uploads.js';
import { isPrivateIp, isSafeUrl } from './mapsLink.js';

export const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECT_HOPS = 5;
const FETCH_TIMEOUT_MS = 8000;
const UPLOAD_URL_PREFIX = '/api/uploads/';
// Standard-Kartenvorschau (siehe tilePreviewUrl): bleibt bewusst extern, Thema von #540.
const OSM_TILE_HOST = 'tile.openstreetmap.org';

const FETCH_HEADERS = {
  'User-Agent': 'Reisotor/1.0 (https://github.com/dmstern/reisotor; travel planning app)',
  Accept: 'image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1',
};

export interface RemoteImage {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

/** Erkennt den Bildtyp an den Magic Bytes (Content-Type des Fremdservers wird nicht vertraut). */
export function sniffImageType(buf: Buffer): { mimeType: string; extension: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}

/** Schützt vor DNS-Rebinding/Hostnamen, die auf interne Adressen zeigen. */
async function resolvesToPublicAddress(urlString: string): Promise<boolean> {
  const hostname = new URL(urlString).hostname.replace(/^\[|\]$/g, '');
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateIp(a.address));
  } catch {
    return false;
  }
}

async function readBodyWithLimit(res: Response, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!res.body) return null;

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    total += chunk.byteLength;
    if (total > maxBytes) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Lädt ein externes Bild serverseitig herunter. Redirects werden manuell verfolgt und auf jedem
 *  Hop gegen SSRF geprüft (Schema, private Hosts, aufgelöste IPs). Gibt null zurück, wenn die URL
 *  unsicher ist, das Limit überschritten wird oder der Inhalt kein JPEG/PNG/WebP ist. */
export async function downloadRemoteImage(url: string): Promise<RemoteImage | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeUrl(current) || !(await resolvesToPublicAddress(current))) return null;

    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      try {
        current = new URL(location, current).toString();
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('image/')) return null;

    let buffer: Buffer | null;
    try {
      buffer = await readBodyWithLimit(res, MAX_REMOTE_IMAGE_BYTES);
    } catch {
      return null;
    }
    if (!buffer) return null;

    const type = sniffImageType(buffer);
    return type ? { buffer, ...type } : null;
  }
  return null;
}

function isExternalImageUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    return new URL(value).hostname.toLowerCase() !== OSM_TILE_HOST;
  } catch {
    return false;
  }
}

/** Speichert ein externes Bild als Upload und liefert die lokale URL (/api/uploads/…). */
export async function importRemoteImage(url: string): Promise<string | null> {
  const image = await downloadRemoteImage(url);
  if (!image) return null;
  const filename = `${randomUUID()}.${image.extension}`;
  await writeFile(path.join(uploadsDir, filename), image.buffer);
  return `${UPLOAD_URL_PREFIX}${filename}`;
}

/** Wandelt eine externe image_url (Hotlinking) in eine lokale Upload-URL um, damit Browser keine
 *  IP-Adresse mehr an Fremdhosts senden. Lokale/leere URLs und die OSM-Kartenvorschau bleiben
 *  unverändert. Schlägt der Download fehl, bleibt die ursprüngliche URL erhalten (kein
 *  Datenverlust bei temporären Fehlern). */
export async function localizeImageUrl<T extends string | null | undefined>(
  value: T
): Promise<T | string> {
  if (!value || !isExternalImageUrl(value)) return value;
  return (await importRemoteImage(value)) ?? value;
}
