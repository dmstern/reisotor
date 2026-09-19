import { describe, it, expect } from 'vitest';
import piexif from 'piexifjs';
import sharp from 'sharp';
import {
  transferExif,
  readExifMetadata,
  formatGeoCoordinates,
  extractExifFromUrl,
} from './imageCompression';

async function createTestJpeg(options: {
  width?: number;
  height?: number;
  exif?: {
    zeroth?: Record<number, unknown>;
    exif?: Record<number, unknown>;
    gps?: Record<number, unknown>;
  };
}): Promise<string> {
  const width = options.width ?? 100;
  const height = options.height ?? 100;

  const rawBuffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 150, b: 180 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  let dataUrl = `data:image/jpeg;base64,${rawBuffer.toString('base64')}`;

  if (options.exif) {
    const exifObj: piexif.ExifDict = {
      '0th': options.exif.zeroth ?? {},
      Exif: options.exif.exif ?? {},
      GPS: options.exif.gps ?? {},
    };
    const exifBytes = piexif.dump(exifObj);
    dataUrl = piexif.insert(exifBytes, dataUrl);
  }

  return dataUrl;
}

describe('imageCompression EXIF metadata preservation', () => {
  it('überträgt GPS- und Datumsinformationen erfolgreich in das komprimierte Bild', async () => {
    const originalDataUrl = await createTestJpeg({
      width: 4032,
      height: 3024,
      exif: {
        zeroth: {
          [piexif.ImageIFD.Make]: 'Apple',
          [piexif.ImageIFD.Model]: 'iPhone 15 Pro',
          [piexif.ImageIFD.Orientation]: 6, // 90° CW gedreht
          [piexif.ImageIFD.DateTime]: '2024:08:20 18:45:12',
        },
        exif: {
          [piexif.ExifIFD.DateTimeOriginal]: '2024:08:20 18:45:12',
          [piexif.ExifIFD.DateTimeDigitized]: '2024:08:20 18:45:12',
          [piexif.ExifIFD.PixelXDimension]: 4032,
          [piexif.ExifIFD.PixelYDimension]: 3024,
        },
        gps: {
          [piexif.GPSIFD.GPSLatitudeRef]: 'N',
          [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(47.3769),
          [piexif.GPSIFD.GPSLongitudeRef]: 'E',
          [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(8.5417),
          [piexif.GPSIFD.GPSAltitudeRef]: 0,
          [piexif.GPSIFD.GPSAltitude]: [420, 1],
          [piexif.GPSIFD.GPSDateStamp]: '2024:08:20',
          [piexif.GPSIFD.GPSTimeStamp]: [
            [16, 1],
            [45, 1],
            [12, 1],
          ],
        },
      },
    });

    const compressedCanvasDataUrl = await createTestJpeg({ width: 1600, height: 1200 });

    const result = transferExif(originalDataUrl, compressedCanvasDataUrl, {
      width: 1600,
      height: 1200,
    });

    expect(result).toContain('data:image/jpeg;base64,');

    // Mit piexif geladene Daten prüfen
    const parsed = piexif.load(result);

    // Orientierung muss auf 1 normalisiert worden sein
    expect(parsed['0th']?.[piexif.ImageIFD.Orientation]).toBe(1);

    // Kamera-Info erhalten
    expect(parsed['0th']?.[piexif.ImageIFD.Make]).toBe('Apple');
    expect(parsed['0th']?.[piexif.ImageIFD.Model]).toBe('iPhone 15 Pro');

    // Datums-Infos erhalten
    expect(parsed.Exif?.[piexif.ExifIFD.DateTimeOriginal]).toBe('2024:08:20 18:45:12');
    expect(parsed.Exif?.[piexif.ExifIFD.DateTimeDigitized]).toBe('2024:08:20 18:45:12');

    // Dimensionen auf komprimierte Maße angepasst
    expect(parsed.Exif?.[piexif.ExifIFD.PixelXDimension]).toBe(1600);
    expect(parsed.Exif?.[piexif.ExifIFD.PixelYDimension]).toBe(1200);

    // GPS erhalten
    expect(parsed.GPS?.[piexif.GPSIFD.GPSLatitudeRef]).toBe('N');
    expect(parsed.GPS?.[piexif.GPSIFD.GPSLongitudeRef]).toBe('E');
    expect(parsed.GPS?.[piexif.GPSIFD.GPSAltitude]).toEqual([420, 1]);
    expect(parsed.GPS?.[piexif.GPSIFD.GPSDateStamp]).toBe('2024:08:20');

    // Mit Sharp prüfen, ob auch externe Bibliotheken die EXIF-Metadaten korrekt lesen
    const binary = atob(result.replace(/^data:image\/jpeg;base64,/, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const sharpMeta = await sharp(bytes).metadata();
    expect(sharpMeta.format).toBe('jpeg');
    expect(sharpMeta.orientation).toBe(1);
    expect(sharpMeta.exif).toBeDefined();

    // Mit readExifMetadata Hilfsfunktion prüfen
    const meta = readExifMetadata(result);
    expect(meta).not.toBeNull();
    expect(meta?.latitude).toBeCloseTo(47.3769, 4);
    expect(meta?.longitude).toBeCloseTo(8.5417, 4);
    expect(meta?.altitude).toBe(420);
    expect(meta?.dateTime?.toISOString()).toContain('2024-08-20');
  });

  it('belässt Bilder ohne EXIF unverändert', async () => {
    const plainOriginal = await createTestJpeg({ width: 100, height: 100 });
    const plainCompressed = await createTestJpeg({ width: 50, height: 50 });

    const result = transferExif(plainOriginal, plainCompressed);
    expect(result).toBe(plainCompressed);
    expect(readExifMetadata(result)).toBeNull();
  });

  it('fällt bei Nicht-JPEG-Dateien transparent auf das komprimierte Bild zurück', async () => {
    const pngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==';
    const plainCompressed = await createTestJpeg({ width: 50, height: 50 });

    const result = transferExif(pngDataUrl, plainCompressed);
    expect(result).toBe(plainCompressed);
  });

  it('ignoriert unbekannte und MakerNote-Tags, um Pack-Fehler zu verhindern', async () => {
    const originalWithWeirdTags = await createTestJpeg({
      width: 200,
      height: 200,
      exif: {
        zeroth: {
          [piexif.ImageIFD.Make]: 'CustomBrand',
        },
        exif: {
          [piexif.ExifIFD.DateTimeOriginal]: '2025:01:01 10:00:00',
          [piexif.ExifIFD.MakerNote]: 'Some binary vendor data that might break',
        },
      },
    });

    const compressed = await createTestJpeg({ width: 100, height: 100 });
    const result = transferExif(originalWithWeirdTags, compressed);

    const parsed = piexif.load(result);
    expect(parsed['0th']?.[piexif.ImageIFD.Make]).toBe('CustomBrand');
    expect(parsed.Exif?.[piexif.ExifIFD.DateTimeOriginal]).toBe('2025:01:01 10:00:00');
    // MakerNote wurde sicher entfernt
    expect(parsed.Exif?.[piexif.ExifIFD.MakerNote]).toBeUndefined();
  });

  it('readExifMetadata liest südliche und westliche Koordinaten mit negativem Vorzeichen aus', async () => {
    const southWestJpeg = await createTestJpeg({
      exif: {
        gps: {
          [piexif.GPSIFD.GPSLatitudeRef]: 'S',
          [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(-33.8688),
          [piexif.GPSIFD.GPSLongitudeRef]: 'W',
          [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(-70.6693),
          [piexif.GPSIFD.GPSAltitudeRef]: 1, // unter dem Meeresspiegel
          [piexif.GPSIFD.GPSAltitude]: [15, 1],
        },
      },
    });

    const meta = readExifMetadata(southWestJpeg);
    expect(meta).not.toBeNull();
    expect(meta?.latitude).toBeCloseTo(-33.8688, 4);
    expect(meta?.longitude).toBeCloseTo(-70.6693, 4);
    expect(meta?.altitude).toBe(-15);
  });

  it('formatGeoCoordinates formatiert Koordinaten korrekt mit Himmelsrichtungen', () => {
    expect(formatGeoCoordinates(48.1372, 11.5761)).toBe('48.1372°\u00A0N, 11.5761°\u00A0O');
    expect(formatGeoCoordinates(-33.8688, -70.6693)).toBe('33.8688°\u00A0S, 70.6693°\u00A0W');
  });

  it('extractExifFromUrl extrahiert Metadaten direkt aus Data-URLs und nutzt Cache', async () => {
    const testJpeg = await createTestJpeg({
      exif: {
        zeroth: {
          [piexif.ImageIFD.DateTime]: '2026:07:15 14:30:00',
        },
        gps: {
          [piexif.GPSIFD.GPSLatitudeRef]: 'N',
          [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(38.6916),
          [piexif.GPSIFD.GPSLongitudeRef]: 'W',
          [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(-9.216),
        },
      },
    });

    const meta = await extractExifFromUrl(testJpeg);
    expect(meta).not.toBeNull();
    expect(meta?.latitude).toBeCloseTo(38.6916, 4);
    expect(meta?.longitude).toBeCloseTo(-9.216, 4);
    expect(meta?.dateTime).toBeInstanceOf(Date);

    // Aufruf aus Cache
    const cachedMeta = await extractExifFromUrl(testJpeg);
    expect(cachedMeta).toBe(meta);
  });
});
