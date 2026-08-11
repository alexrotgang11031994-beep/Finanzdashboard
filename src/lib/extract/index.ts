import { TesseractExtractor } from './tesseractExtractor';
import type { Extractor } from './types';

export type { ExtractedRow, ExtractionResult, Extractor } from './types';

let instance: (Extractor & { dispose(): Promise<void> }) | null = null;

/**
 * Liefert den aktiven Erkennungsdienst. Heute immer Tesseract; der Rückgabe­typ
 * ist bewusst die Extractor-Schnittstelle, damit ein Aufrufer nie gegen die
 * konkrete Implementierung programmiert.
 */
export function getExtractor(): Extractor & { dispose(): Promise<void> } {
  instance ??= new TesseractExtractor();
  return instance;
}
