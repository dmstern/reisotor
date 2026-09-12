// Erzeugt PNG-Home-Bildschirm-/Manifest-Icons aus reisotor_icon_abgerundet_edit.svg (500×500,
// enthält den quadratischen Verlaufshintergrund #9141AC -> #35003F für das PWA-Icon).
// Manuell auszuführen (npm run generate:icons bzw. node scripts/generate-icons.mjs),
// NICHT Teil von `npm run build`.
//
// "any"-Icons (apple-touch-icon/icon-192/icon-512): volle Darstellung auf quadratischem Canvas.
// iOS legt selbst eine Squircle-Maske über jedes Icon.
//
// "maskable"-Icons (Android adaptive Icons, beliebige Maskenform je Launcher/OEM):
// Das Ausgangs-SVG reisotor_icon_abgerundet_edit.svg platziert Pin & Roboter bereits mittig
// und vollständig innerhalb der 80%-Sicherheitszone (Safe Zone), während der Verlauf
// bis an alle 4 Ränder (0 0 500 500) reicht. Ein Vollflächen-Rendering stellt sicher, dass
// der Farbverlauf nahtlos bis an die Schnittkanten des Launchers läuft.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, '..', '..', 'reisotor_icon_abgerundet_edit.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const BACKGROUND = '#35003F';
const svgBuffer = fs.readFileSync(svgPath);
// Hohe Dichte, damit auch das größte Ziel (512px) aus einem hochaufgelösten Ausgangsraster
// herunterskaliert statt aus einem kleinen hochskaliert wird (bessere Schärfe).
const DENSITY = 800;

async function renderIcon(size, filename) {
  await sharp(svgBuffer, { density: DENSITY })
    .resize(size, size, { fit: 'contain', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toFile(path.join(outDir, filename));
}

await renderIcon(180, 'apple-touch-icon.png');
await renderIcon(192, 'icon-192.png');
await renderIcon(512, 'icon-512.png');
await renderIcon(192, 'maskable-192.png');
await renderIcon(512, 'maskable-512.png');

console.log('Icons generated in', outDir);
