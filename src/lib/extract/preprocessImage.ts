/**
 * Bereitet ein Foto für die Texterkennung vor: verkleinert übergroße Bilder,
 * wandelt in Graustufen, spreizt den Kontrast robust und dreht überwiegend
 * dunkle Bilder um.
 *
 * Handyfotos von Bildschirmen sind oft zu groß (verlangsamt Tesseract ohne
 * Genauigkeitsgewinn) und haben durch Spiegelungen einen flachen
 * Kontrastbereich. Beides kostet Erkennungsqualität, bevor die Texterkennung
 * überhaupt beginnt.
 *
 * Die Umkehrung dunkler Bilder ist kein Kosmetikschritt: Tesseract ist auf
 * dunklen Text auf hellem Grund trainiert. Ein Depot-Screenshot im
 * Dunkelmodus einer Broker-App — heller Text auf schwarzem Grund — liefert
 * unbehandelt spürbar schlechtere Trefferquoten als dieselbe Aufnahme nach
 * der Umkehrung.
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
  const histogram = new Uint32Array(256);

  let sum = 0;
  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p++) {
    const r = imageData.data[i] ?? 0;
    const g = imageData.data[i + 1] ?? 0;
    const b = imageData.data[i + 2] ?? 0;
    // Standard-Luminanzgewichtung, keine Bibliothek nötig für drei Zeilen Mathematik.
    const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    gray[p] = v;
    sum += v;
    histogram[v] = (histogram[v] ?? 0) + 1;
  }

  // Perzentile statt absolutem Minimum/Maximum: ein App-Screenshot hat oft
  // knallweiße Statusleisten-Icons (Uhrzeit, Akku, WLAN) am oberen Rand, die
  // als Ausreißer das Maximum dominieren. Gegen das so bestimmte Maximum
  // gespreizt, landet der eigentliche — bereits gedämpfte graue — Betrags-
  // text (in vielen Apps bewusst dezenter als der Name, für die visuelle
  // Hierarchie) in einem so schmalen Bereich, dass Tesseract ihn nach der
  // Spreizung nicht mehr als Zeichen erkennt. Das Depot verschwindet dann
  // nicht mit einem Fehler, sondern lautlos: die Namenzeilen werden erkannt,
  // die Wertzeilen bleiben komplett leer. Perzentile ignorieren die
  // Ausreißer und behalten den Kontrast, der für den eigentlichen Text zählt.
  const total = width * height;
  const lowCut = total * 0.005;
  const highCut = total * 0.995;
  let acc = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v] ?? 0;
    if (acc >= lowCut) {
      low = v;
      break;
    }
  }
  acc = 0;
  for (let v = 255; v >= 0; v--) {
    acc += histogram[v] ?? 0;
    if (acc >= total - highCut) {
      high = v;
      break;
    }
  }

  // Mittelwert unter der Bildmitte heißt: überwiegend dunkler Hintergrund,
  // wie bei den meisten Dunkelmodus-Oberflächen von Broker-Apps.
  const invert = sum / gray.length < 128;

  const range = Math.max(high - low, 1);
  for (let i = 0, p = 0; i < imageData.data.length; i += 4, p++) {
    let stretched = (((gray[p] ?? 0) - low) / range) * 255;
    stretched = Math.max(0, Math.min(255, stretched));
    if (invert) stretched = 255 - stretched;
    imageData.data[i] = stretched;
    imageData.data[i + 1] = stretched;
    imageData.data[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
