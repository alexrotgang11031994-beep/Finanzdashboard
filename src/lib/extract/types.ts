/**
 * Schnittstelle für die Erkennung von Depotangaben aus einem Bild.
 *
 * Es gibt bewusst eine Abstraktion, obwohl es zunächst nur eine
 * Implementierung gibt: Tesseract läuft gratis im Browser, liest aber nur
 * Text und versteht kein Layout. Ein Sprachmodell mit Bildeingabe versteht
 * Tabellen, braucht aber einen Server für den Schlüssel und kostet Geld.
 * Alles hinter dieser Schnittstelle — Prüfdialog, ISIN-Validierung,
 * Übernahme — ist für beide identisch.
 */

export interface ExtractedRow {
  name: string;
  value: number | null;
  currency: string | null;
  isin: string | null;
  ticker: string | null;
  quantity: number | null;
  /** 0 bis 1. Alles unter 0,8 wird im Prüfdialog hervorgehoben. */
  confidence: number;
  /** Die Rohzeile, aus der die Werte stammen — im Zweifel die Referenz. */
  raw: string;
}

export interface ExtractionResult {
  rows: ExtractedRow[];
  warnings: string[];
  /** Welches Verfahren gelaufen ist — steht im Prüfdialog. */
  engine: string;
  /** Vollständiger erkannter Text, für den Fall dass die Heuristik danebenliegt. */
  rawText: string;
}

export interface Extractor {
  readonly id: string;
  readonly label: string;
  extract(image: Blob, onProgress?: (fraction: number) => void): Promise<ExtractionResult>;
}
