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
        if (isHeicFile({ type: contentType, name: url } as File) || (await isHeicBlob(blob))) {
          return extractMetadataFromHeic(blob);
        }
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

/**
 * Prüft synchron anhand von MIME-Type oder Dateiendung, ob es sich um eine HEIC/HEIF-Datei handelt.
 */
export function isHeicFile(file: File | Blob): boolean {
  if (file.type && /image\/(heic|heif)/i.test(file.type)) {
    return true;
  }
  if ('name' in file && typeof file.name === 'string') {
    return /\.(heic|heif)$/i.test(file.name);
  }
  return false;
}

/**
 * Prüft asynchron auch anhand der Magic Bytes ('ftypheic', 'ftypmif1', etc.) im Datei-Header,
 * ob ein Blob eine HEIC/HEIF-Datei ist (auch wenn MIME-Type oder Dateiendung fehlen).
 */
export async function isHeicBlob(blob: Blob): Promise<boolean> {
  if (isHeicFile(blob)) return true;
  try {
    const slice = blob.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    if (buffer.byteLength < 12) return false;
    const view = new DataView(buffer);
    // Box-Typ 'ftyp' bei Offset 4: 0x66 0x74 0x79 0x70
    if (
      view.getUint8(4) === 0x66 &&
      view.getUint8(5) === 0x74 &&
      view.getUint8(6) === 0x79 &&
      view.getUint8(7) === 0x70
    ) {
      const brand = String.fromCharCode(
        view.getUint8(8),
        view.getUint8(9),
        view.getUint8(10),
        view.getUint8(11)
      ).toLowerCase();
      return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
    }
  } catch {
    return false;
  }
  return false;
}

function parseExifDateString(dateStr: string): Date | undefined {
  const parts = dateStr.trim().split(' ');
  if (parts.length === 2) {
    const datePart = parts[0].replace(/:/g, '-');
    const d = new Date(`${datePart}T${parts[1]}`);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  return undefined;
}

function formatDateForExif(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Liest EXIF-Metadaten (Aufnahmedatum, Geokoordinaten, Höhe) aus einer HEIC-Datei aus.
 */
export async function extractMetadataFromHeic(
  file: File | Blob
): Promise<ImageExifMetadata | null> {
  try {
    const ExifReader = (await import('exifreader')).default;
    const arrayBuffer = await file.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer);
    if (!tags) return null;

    const result: ImageExifMetadata = {};

    // 1. Aufnahmedatum
    const dateTag = tags['DateTimeOriginal'] || tags['DateTimeDigitized'] || tags['DateTime'];
    const dateStr = dateTag?.description;
    if (typeof dateStr === 'string') {
      const parsedDate = parseExifDateString(dateStr);
      if (parsedDate) {
        result.dateTime = parsedDate;
      }
    }

    // 2. GPS Latitude
    if (tags['GPSLatitude'] && tags['GPSLatitude'].description !== undefined) {
      const rawLat = tags['GPSLatitude'].description;
      let lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
      if (!isNaN(lat)) {
        const latRefTag = tags['GPSLatitudeRef'];
        const latRef = (
          Array.isArray(latRefTag?.value)
            ? latRefTag.value[0]
            : latRefTag?.value || latRefTag?.description || ''
        )
          .toString()
          .toUpperCase();
        if (latRef.includes('S') && lat > 0) {
          lat = -lat;
        }
        result.latitude = lat;
      }
    }

    // 3. GPS Longitude
    if (tags['GPSLongitude'] && tags['GPSLongitude'].description !== undefined) {
      const rawLng = tags['GPSLongitude'].description;
      let lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));
      if (!isNaN(lng)) {
        const lngRefTag = tags['GPSLongitudeRef'];
        const lngRef = (
          Array.isArray(lngRefTag?.value)
            ? lngRefTag.value[0]
            : lngRefTag?.value || lngRefTag?.description || ''
        )
          .toString()
          .toUpperCase();
        if (lngRef.includes('W') && lng > 0) {
          lng = -lng;
        }
        result.longitude = lng;
      }
    }

    // 4. GPS Altitude
    if (tags['GPSAltitude'] && tags['GPSAltitude'].description !== undefined) {
      const rawAlt = tags['GPSAltitude'].description;
      const altVal = typeof rawAlt === 'number' ? rawAlt : parseFloat(String(rawAlt));
      if (!isNaN(altVal)) {
        const altRefTag = tags['GPSAltitudeRef'];
        const altRef = Array.isArray(altRefTag?.value)
          ? altRefTag.value[0]
          : (altRefTag?.value ?? altRefTag?.description);
        const isBelowSea = altRef === 1 || String(altRef).toLowerCase().includes('below');
        result.altitude = isBelowSea && altVal > 0 ? -altVal : altVal;
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
  } catch (err) {
    console.warn('HEIC EXIF-Metadaten konnten nicht ausgelesen werden:', err);
    return null;
  }
}

/**
 * Bettet extrahierte EXIF-Metadaten (Datum, Geokoordinaten, Höhe) in eine komprimierte JPEG-Data-URL ein.
 */
export function injectMetadataIntoJpeg(
  jpegDataUrl: string,
  metadata: ImageExifMetadata,
  dimensions?: { width: number; height: number }
): string {
  if (!/^data:image\/jpe?g/i.test(jpegDataUrl)) {
    return jpegDataUrl;
  }

  const hasDate = Boolean(metadata.dateTime);
  const hasGps = metadata.latitude !== undefined && metadata.longitude !== undefined;
  const hasAlt = metadata.altitude !== undefined;

  if (!hasDate && !hasGps && !hasAlt && !dimensions) {
    return jpegDataUrl;
  }

  try {
    let rawExif: piexif.ExifDict;
    try {
      rawExif = piexif.load(jpegDataUrl);
    } catch {
      rawExif = { '0th': {}, Exif: {}, GPS: {}, Interop: {}, '1st': {} };
    }

    const cleanExif = sanitizeExifObj(rawExif);

    if (!cleanExif['0th']) cleanExif['0th'] = {};
    if (!cleanExif.Exif) cleanExif.Exif = {};
    if (!cleanExif.GPS) cleanExif.GPS = {};

    cleanExif['0th'][piexif.ImageIFD.Orientation] = 1;
    delete cleanExif['0th'][piexif.ImageIFD.ImageWidth];
    delete cleanExif['0th'][piexif.ImageIFD.ImageLength];

    if (hasDate && metadata.dateTime) {
      const dateExifStr = formatDateForExif(metadata.dateTime);
      cleanExif['0th'][piexif.ImageIFD.DateTime] = dateExifStr;
      cleanExif.Exif[piexif.ExifIFD.DateTimeOriginal] = dateExifStr;
      cleanExif.Exif[piexif.ExifIFD.DateTimeDigitized] = dateExifStr;
    }

    if (hasGps && metadata.latitude !== undefined && metadata.longitude !== undefined) {
      cleanExif.GPS[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(
        Math.abs(metadata.latitude)
      );
      cleanExif.GPS[piexif.GPSIFD.GPSLatitudeRef] = metadata.latitude >= 0 ? 'N' : 'S';

      cleanExif.GPS[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(
        Math.abs(metadata.longitude)
      );
      cleanExif.GPS[piexif.GPSIFD.GPSLongitudeRef] = metadata.longitude >= 0 ? 'E' : 'W';
    }

    if (hasAlt && metadata.altitude !== undefined) {
      cleanExif.GPS[piexif.GPSIFD.GPSAltitude] = [
        Math.round(Math.abs(metadata.altitude) * 100),
        100,
      ];
      cleanExif.GPS[piexif.GPSIFD.GPSAltitudeRef] = metadata.altitude < 0 ? 1 : 0;
    }

    if (dimensions) {
      cleanExif.Exif[piexif.ExifIFD.PixelXDimension] = dimensions.width;
      cleanExif.Exif[piexif.ExifIFD.PixelYDimension] = dimensions.height;
    }

    delete cleanExif.thumbnail;
    cleanExif['1st'] = {};

    const exifBytes = piexif.dump(cleanExif);
    return piexif.insert(exifBytes, jpegDataUrl);
  } catch (err) {
    console.warn('Metadaten konnten nicht in das JPEG eingefügt werden:', err);
    return jpegDataUrl;
  }
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    img.onerror = () => reject(new Error('Bilddimensionen konnten nicht ermittelt werden'));
    img.src = dataUrl;
  });
}

/**
 * Konvertiert eine HEIC/HEIF-Datei clientseitig zu einem komprimierten JPEG.
 */
export async function convertHeicToJpeg(
  file: File | Blob
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { convertHeic, LibheifDecoder } = await import('@keeratita/heic-converter');
  let decoder;
  try {
    const heicWasmUrl = (await import('@keeratita/heic-converter/wasm?url')).default;
    if (heicWasmUrl) {
      decoder = new LibheifDecoder({
        locateFile: () => heicWasmUrl,
      });
    }
  } catch {
    // Fallback: Default-WASM-Loader von libheif
  }

  const jpegBlob = await convertHeic(file, {
    to: 'jpeg',
    quality: JPEG_QUALITY,
    maxWidth: MAX_DIMENSION,
    maxHeight: MAX_DIMENSION,
    decoder,
  });

  const dataUrl = await readAsDataUrl(jpegBlob);
  const dimensions = await getImageDimensions(dataUrl).catch(() => ({ width: 0, height: 0 }));

  return {
    dataUrl,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function convertViaCanvas(
  file: File | Blob
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
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
  });
}

/** Verkleinert und komprimiert ein Bild client-seitig (nie serverseitig, damit der ressourcenschwache
 *  Raspberry Pi 2 im Backend nicht mit Bildverarbeitung belastet wird). Unterstützt Standard-Bilder
 *  (JPEG, PNG, WebP) sowie Apple-iPhone-HEIC/HEIF-Dateien. Erhält vorhandene EXIF-Metadaten (insb.
 *  Geo- und Datums-Informationen) und gibt eine standardisierte JPEG-Data-URL zurück. */
export async function compressImage(file: File): Promise<string> {
  const isHeic = isHeicFile(file) || (await isHeicBlob(file));

  if (isHeic) {
    // 1. Parallel: EXIF Metadaten extrahieren & HEIC nach JPEG konvertieren
    const metadataPromise = extractMetadataFromHeic(file).catch(() => null);
    const convertedPromise = convertHeicToJpeg(file).catch(async (err) => {
      console.warn('WASM HEIC-Konvertierung fehlgeschlagen, versuche Canvas-Fallback:', err);
      return convertViaCanvas(file);
    });

    const [metadata, converted] = await Promise.all([metadataPromise, convertedPromise]);

    if (metadata) {
      return injectMetadataIntoJpeg(converted.dataUrl, metadata, {
        width: converted.width,
        height: converted.height,
      });
    }

    return converted.dataUrl;
  }

  const isJpeg =
    !file.type ||
    file.type === 'image/jpeg' ||
    file.type === 'image/jpg' ||
    /\.jpe?g$/i.test(file.name);

  // Originaldatei parallel einlesen, um EXIF-Metadaten zu extrahieren
  const originalDataUrlPromise = isJpeg
    ? readAsDataUrl(file).catch(() => null)
    : Promise.resolve(null);

  const canvasPromise = convertViaCanvas(file);

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
