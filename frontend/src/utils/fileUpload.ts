/** Liest eine Datei roh als Base64-Data-URL ein (für PDFs, die sich nicht wie Bilder per Canvas-API
 *  verkleinern lassen, siehe compressImage() in imageCompression.ts – Bilddateien werden weiterhin
 *  vorher über compressImage() geschickt, nur PDFs laufen direkt durch diese Funktion). */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
