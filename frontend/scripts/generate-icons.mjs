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
const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Hohe Dichte, damit auch das größte Ziel (512px) aus einem hochaufgelösten Ausgangsraster
// herunterskaliert statt aus einem kleinen hochskaliert wird (bessere Schärfe).
const DENSITY = 800;

async function renderIcon(svgFilename, size, outFilename) {
  const svgPath = path.join(__dirname, '..', '..', svgFilename);
  const svgBuffer = fs.readFileSync(svgPath);

  await sharp(svgBuffer, { density: DENSITY })
    .resize(size, size, { fit: 'contain' })
    .png()
    .toFile(path.join(outDir, outFilename));
}

// "full"-Variante für Systeme, die quadratische Icons mit abgerundeten Ecken erzwingen (z. B. iOS)
// oder als maskable für Android (Launcher croppt selbst).
await renderIcon('reisotor-icon-full.svg', 180, 'apple-touch-icon.png');
await renderIcon('reisotor-icon-full.svg', 192, 'maskable-192.png');
await renderIcon('reisotor-icon-full.svg', 512, 'maskable-512.png');

// "circle"-Variante für Systeme (wie Windows Desktop PWA oder altes Android), die
// das Icon nicht automatisch beschneiden.
await renderIcon('reisotor-icon-circle.svg', 192, 'icon-192.png');
await renderIcon('reisotor-icon-circle.svg', 512, 'icon-512.png');

console.log('Icons generated in', outDir);
