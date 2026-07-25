const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

/** Verkleinert und komprimiert ein Bild client-seitig über die Canvas-API (nie serverseitig,
 *  damit der ressourcenschwache Raspberry Pi 2 im Backend nicht mit Bildverarbeitung belastet
 *  wird). Gibt eine JPEG-Data-URL zurück, die direkt hochgeladen werden kann. */
export function compressImage(file: File): Promise<string> {
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
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Bild konnte nicht gelesen werden'));
    };
    img.src = objectUrl;
  });
}
