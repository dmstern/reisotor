// Erzeugt PNG-Home-Bildschirm-/Manifest-Icons aus der bestehenden reisotor_logo.svg (300×304,
// enthält bereits einen randnahen Kreis-Hintergrund #EAF6F4 als Icon-Variante, siehe deren eigene
// <title>/<desc>). Manuell auszuführen (node scripts/generate-icons.mjs), NICHT Teil von
// `npm run build` – das Logo ändert sich praktisch nie (gleiche Konvention wie
// backend/scripts/generate-vapid-keys.mjs/generate-build-info.mjs).
//
// "any"-Icons (apple-touch-icon/icon-192/icon-512): volle Darstellung auf quadratischem Canvas,
// Hintergrund #EAF6F4 statt transparent/schwarz (der Kreis der SVG reicht nicht ganz bis in alle
// vier Ecken/Kanten des 300×304-viewBox). iOS legt selbst eine Squircle-Maske über jedes Icon,
// daher hier bewusst kein eigener abgerundeter Rand.
//
// "maskable"-Icons (Android adaptive Icons, beliebige Maskenform je Launcher/OEM): Grafik auf eine
// Sicherheitszone von ca. 72% verkleinert und zentriert, Canvas-Hintergrund vollflächig #EAF6F4 –
// sonst könnten Antenne/Füße der Robotergrafik je nach Maske abgeschnitten werden.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', 'public', 'reisotor_logo.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const BACKGROUND = '#EAF6F4';
const svgBuffer = fs.readFileSync(svgPath);
// Hohe Dichte, damit auch das größte Ziel (512px) aus einem hochaufgelösten Ausgangsraster
// herunterskaliert statt aus einem kleinen hochskaliert wird (bessere Schärfe).
const DENSITY = 800;

async function renderFullBleed(size, filename) {
  await sharp(svgBuffer, { density: DENSITY })
    .resize(size, size, { fit: 'contain', background: BACKGROUND })
    .png()
    .toFile(path.join(outDir, filename));
}

async function renderMaskable(size, filename) {
  const safeSize = Math.round(size * 0.72);
  const icon = await sharp(svgBuffer, { density: DENSITY })
    .resize(safeSize, safeSize, { fit: 'contain', background: BACKGROUND })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, filename));
}

await renderFullBleed(180, 'apple-touch-icon.png');
await renderFullBleed(192, 'icon-192.png');
await renderFullBleed(512, 'icon-512.png');
await renderMaskable(192, 'maskable-192.png');
await renderMaskable(512, 'maskable-512.png');

console.log('Icons generated in', outDir);
