import { createWorker, type Worker } from 'tesseract.js';
import { parseLines, type RecognizedLine } from './parseLines';
import { preprocessImage } from './preprocessImage';
import type { Extractor, ExtractionResult } from './types';

/**
 * Texterkennung im Browser über Tesseract.js — kein Server, kein Schlüssel,
 * keine Kosten. Das Sprachmodell (~4 MB) lädt beim ersten Aufruf einmalig von
 * einem CDN und wird danach vom Browser zwischengespeichert.
 *
 * Gegenüber einem Sprachmodell mit Bildeingabe liest das nur Text und
 * versteht kein Tabellenlayout — die Zeilen-Heuristik in parseLines.ts
 * gleicht das so gut es geht aus. Diese Klasse implementiert die Extractor-
 * Schnittstelle aus types.ts, damit ein serverseitiges Verfahren später ohne
 * Änderung am Prüfdialog eintauschbar ist.
 */
export class TesseractExtractor implements Extractor {
  readonly id = 'tesseract-browser';
  readonly label = 'Texterkennung im Browser (Tesseract)';

  private workerPromise: Promise<Worker> | null = null;

  private getWorker(): Promise<Worker> {
    this.workerPromise ??= createWorker('deu');
    return this.workerPromise;
  }

  async extract(image: Blob, onProgress?: (fraction: number) => void): Promise<ExtractionResult> {
    const canvas = await preprocessImage(image);
    onProgress?.(0.1);

    const worker = await this.getWorker();
    onProgress?.(0.2);

    const { data } = await worker.recognize(
      canvas,
      {},
      { blocks: true, text: true },
    );

    onProgress?.(0.9);

    const lines: RecognizedLine[] = [];
    for (const block of data.blocks ?? []) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          lines.push({ text: line.text, confidence: line.confidence });
        }
      }
    }

    const { rows, warnings } = parseLines(lines);
    onProgress?.(1);

    return { rows, warnings, engine: this.label, rawText: data.text };
  }

  /** Beendet den Worker. Im Prüfdialog nach Abschluss aufgerufen, um den Speicher freizugeben. */
  async dispose(): Promise<void> {
    if (!this.workerPromise) return;
    const worker = await this.workerPromise;
    this.workerPromise = null;
    await worker.terminate();
  }
}
