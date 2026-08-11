/**
 * Bereitet ein Foto für die Texterkennung vor: verkleinert übergroße Bilder,
 * wandelt in Graustufen und spreizt den Kontrast linear.
 *
 * Handyfotos von Bildschirmen sind oft zu groß (verlangsamt Tesseract ohne
 * Genauigkeitsgewinn) und haben durch Spiegelungen einen flachen
 * Kontrastbereich. Beides kostet Erkennungsqualität, bevor die Texterkennung
 * überhaupt beginnt.
 */
export async function preprocessImage(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);

  const MAX_EDGE = 2200;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar.');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);

  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p++) {
    const r = imageData.data[i] ?? 0;
    const g = imageData.data[i + 1] ?? 0;
    const b = imageData.data[i + 2] ?? 0;
    // Standard-Luminanzgewichtung, keine Bibliothek nötig für drei Zeilen Mathematik.
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[p] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min || 1;
  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p++) {
    const stretched = (((gray[p] ?? 0) - min) / range) * 255;
    imageData.data[i] = stretched;
    imageData.data[i + 1] = stretched;
    imageData.data[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
