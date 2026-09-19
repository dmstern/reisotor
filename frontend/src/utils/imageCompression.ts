import piexif from 'piexifjs';
import { readAsDataUrl } from './fileUpload';

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

export interface ImageExifMetadata {
  dateTime?: Date;
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

/**
 * Filtert ein EXIF-Objekt auf Tags, die piexifjs fehlerfrei serialisieren ('packen') kann,
 * und entfernt herstellerspezifische oder unbekannte Binär-Tags (z. B. MakerNote),
 * die bei der Wiederherstellung zu Exceptions führen könnten.
 */
function sanitizeExifObj(rawObj: piexif.ExifDict): piexif.ExifDict {
  const sanitized: piexif.ExifDict = {
    '0th': {},
    Exif: {},
    GPS: {},
    Interop: {},
    '1st': {},
  };

  const ifds = ['0th', 'Exif', 'GPS', 'Interop'] as const;
  for (const ifd of ifds) {
    const sourceIfd = rawObj[ifd] as Record<string, unknown> | undefined;
    if (!sourceIfd) continue;

    const validTags = (piexif.TAGS as Record<string, Record<string, unknown>>)[ifd] || {};
    const targetIfd = sanitized[ifd] as Record<number, unknown>;

    for (const [tagStr, val] of Object.entries(sourceIfd)) {
      const tag = Number(tagStr);
      // MakerNote (37500) ist herstellerspezifisch und führt bei Fremdkameras oft zu Pack-Fehlern;
      // für Datums- und Geoinformationen ist es nicht erforderlich.
      if (ifd === 'Exif' && tag === piexif.ExifIFD.MakerNote) {
        continue;
      }
      if (tag in validTags) {
        targetIfd[tag] = val;
      }
    }
  }

  return sanitized;
}

/**
 * Überträgt vorhandene EXIF-Metadaten (insb. Geo- und Datums-Informationen sowie Kamera-Infos)
 * aus dem Originalbild in die komprimierte JPEG-Data-URL.
 *
 * Wichtig: Da das Canvas das Bild bereits gemäß Ausrichtung (EXIF Orientation) aufrecht
 * gerendert hat, wird die Orientierung im übertragenen EXIF auf 1 (normal) gesetzt, um
 * doppelte Drehungen in Bildbetrachtern zu verhindern.
 */
export function transferExif(
  originalDataUrl: string,
  compressedDataUrl: string,
  dimensions?: { width: number; height: number }
): string {
  // Nicht-JPEG-Bilder (z. B. PNG) enthalten kein Standard-EXIF für piexifjs
  if (!/^data:image\/jpe?g/i.test(originalDataUrl)) {
    return compressedDataUrl;
  }

  try {
    const rawExif = piexif.load(originalDataUrl);

    const has0th = Boolean(rawExif['0th'] && Object.keys(rawExif['0th']).length > 0);
    const hasExif = Boolean(rawExif.Exif && Object.keys(rawExif.Exif).length > 0);
    const hasGps = Boolean(rawExif.GPS && Object.keys(rawExif.GPS).length > 0);

    if (!has0th && !hasExif && !hasGps) {
      return compressedDataUrl;
    }

    const cleanExif = sanitizeExifObj(rawExif);

    // Orientierung auf 1 setzen, da Canvas das Bild bereits korrekt orientiert gezeichnet hat
    if (cleanExif['0th']) {
      cleanExif['0th'][piexif.ImageIFD.Orientation] = 1;
      // Veraltete TIFF-Dimensionen entfernen
      delete cleanExif['0th'][piexif.ImageIFD.ImageWidth];
      delete cleanExif['0th'][piexif.ImageIFD.ImageLength];
    }

    // Bei Vorhandensein von PixelX/Y-Dimensionen auf neue Canvas-Maße anpassen
    if (cleanExif.Exif && dimensions) {
      if (cleanExif.Exif[piexif.ExifIFD.PixelXDimension] !== undefined) {
        cleanExif.Exif[piexif.ExifIFD.PixelXDimension] = dimensions.width;
      }
      if (cleanExif.Exif[piexif.ExifIFD.PixelYDimension] !== undefined) {
        cleanExif.Exif[piexif.ExifIFD.PixelYDimension] = dimensions.height;
      }
    }

    // Altes/inkonsistentes Thumbnail und 1st IFD entfernen, um Dateigröße klein zu halten
    delete cleanExif.thumbnail;
    cleanExif['1st'] = {};

    const exifBytes = piexif.dump(cleanExif);
    return piexif.insert(exifBytes, compressedDataUrl);
  } catch (err) {
    // Bei Parsing-/Packing-Fehlern auf das unveränderte komprimierte Bild zurückfallen
    console.warn('Metadaten konnten nicht in das komprimierte Bild übertragen werden:', err);
    return compressedDataUrl;
  }
}

/**
 * Liest Aufnahmedatum und GPS-Koordinaten (als Dezimalgrad) aus einer Bild-Data-URL aus.
 */
export function readExifMetadata(dataUrl: string): ImageExifMetadata | null {
  if (!/^data:image\/jpe?g/i.test(dataUrl)) {
    return null;
  }

  try {
    const rawExif = piexif.load(dataUrl);
    const result: ImageExifMetadata = {};

    // Datum auslesen (DateTimeOriginal oder DateTimeDigitized oder DateTime)
    const dateStr =
      rawExif.Exif?.[piexif.ExifIFD.DateTimeOriginal] ??
      rawExif.Exif?.[piexif.ExifIFD.DateTimeDigitized] ??
      rawExif['0th']?.[piexif.ImageIFD.DateTime];

    if (typeof dateStr === 'string') {
      const parts = dateStr.trim().split(' ');
      if (parts.length === 2) {
        const datePart = parts[0].replace(/:/g, '-');
        const d = new Date(`${datePart}T${parts[1]}`);
        if (!isNaN(d.getTime())) {
          result.dateTime = d;
        }
      }
    }

    // GPS-Koordinaten auslesen
    const gps = rawExif.GPS;
    if (gps) {
      const latDms = gps[piexif.GPSIFD.GPSLatitude];
      const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
      if (Array.isArray(latDms) && typeof latRef === 'string') {
        result.latitude = piexif.GPSHelper.dmsRationalToDeg(latDms, latRef);
      }

      const lngDms = gps[piexif.GPSIFD.GPSLongitude];
      const lngRef = gps[piexif.GPSIFD.GPSLongitudeRef];
      if (Array.isArray(lngDms) && typeof lngRef === 'string') {
        result.longitude = piexif.GPSHelper.dmsRationalToDeg(lngDms, lngRef);
      }

      const alt = gps[piexif.GPSIFD.GPSAltitude];
      const altRef = gps[piexif.GPSIFD.GPSAltitudeRef];
      if (Array.isArray(alt) && alt.length === 2 && alt[1] !== 0) {
        const altVal = alt[0] / alt[1];
        result.altitude = altRef === 1 ? -altVal : altVal;
      }
    }

    if (
      result.dateTime !== undefined ||
      result.latitude !== undefined ||
      result.longitude !== undefined ||
      result.altitude !== undefined
    ) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Formatiert Breiten- und Längengrad in eine lesbare, standardisierte Koordinatenangabe
 * (z. B. "48.1372° N, 11.5755° O").
 */
export function formatGeoCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'O' : 'W';
  const latFormatted = `${Math.abs(lat).toFixed(4)}°\u00A0${latDir}`;
  const lngFormatted = `${Math.abs(lng).toFixed(4)}°\u00A0${lngDir}`;
  return `${latFormatted}, ${lngFormatted}`;
}

const exifCache = new Map<string, Promise<ImageExifMetadata | null>>();

/**
 * Extrahiert EXIF-Metadaten (Aufnahmedatum, Geolocation) aus einer Bild-URL (Data-URL,
 * Blob-URL oder HTTP-URL). Verwendet einen internen Cache, um redundante Netzwerkabrufe
 * beim Durchblättern von Anhängen zu vermeiden.
 */
export async function extractExifFromUrl(url: string): Promise<ImageExifMetadata | null> {
  if (!url) return null;
  if (exifCache.has(url)) {
    return exifCache.get(url)!;
  }

  const promise = (async () => {
    try {
      if (url.startsWith('data:image/jp')) {
        return readExifMetadata(url);
      }
      if (url.startsWith('data:')) {
        return null;
      }
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) return null;
      const blob = await res.blob();
      const contentType = blob.type || res.headers.get('content-type') || '';
      if (
        !contentType.includes('jpeg') &&
        !contentType.includes('jpg') &&
        !/\.jpe?g($|\?)/i.test(url)
      ) {
        return null;
      }
      const dataUrl = await readAsDataUrl(blob);
      return readExifMetadata(dataUrl);
    } catch (err) {
      console.warn('EXIF-Metadaten konnten nicht aus der Bild-URL geladen werden:', err);
      return null;
    }
  })();

  exifCache.set(url, promise);
  return promise;
}

export function clearExifCache(): void {
  exifCache.clear();
}

/** Verkleinert und komprimiert ein Bild client-seitig über die Canvas-API (nie serverseitig,
 *  damit der ressourcenschwache Raspberry Pi 2 im Backend nicht mit Bildverarbeitung belastet
 *  wird). Erhält vorhandene EXIF-Metadaten (insb. Geo- und Datums-Informationen) und gibt eine
 *  JPEG-Data-URL zurück, die direkt hochgeladen werden kann. */
export async function compressImage(file: File): Promise<string> {
  const isJpeg =
    !file.type ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    /\.jpe?g$/i.test(file.name);

  // Originaldatei parallel einlesen, um EXIF-Metadaten zu extrahieren
  const originalDataUrlPromise = isJpeg
    ? readAsDataUrl(file).catch(() => null)
    : Promise.resolve(null);

  const canvasPromise = new Promise<{ dataUrl: string; width: number; height: number }>(
    (resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas-Kontext nicht verfügbar'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
          width: canvas.width,
          height: canvas.height,
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Bild konnte nicht gelesen werden'));
      };
      img.src = objectUrl;
    }
  );

  const [originalDataUrl, canvasResult] = await Promise.all([
    originalDataUrlPromise,
    canvasPromise,
  ]);

  if (originalDataUrl) {
    return transferExif(originalDataUrl, canvasResult.dataUrl, {
      width: canvasResult.width,
      height: canvasResult.height,
    });
  }

  return canvasResult.dataUrl;
}
