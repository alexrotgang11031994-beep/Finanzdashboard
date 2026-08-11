import { isValidIsin } from '../isin';
import { parseAmount, parseCurrency } from './parseAmount';
import type { ExtractedRow } from './types';

/** Eine erkannte Zeile mit ihrem OCR-Vertrauen, unabhängig vom Erkennungsmotor. */
export interface RecognizedLine {
  text: string;
  /** 0 bis 100, wie von Tesseract geliefert. */
  confidence: number;
}

const ISIN_RE = /\b[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]\b/;

/**
 * Kopfzeilen und Beschriftungen, die in Depot-Screenshots auftauchen, aber
 * keine Position sind. Ohne diese Liste würde z. B. eine Spaltenüberschrift
 * "Wert" als Positionsname mit dem Wert "0" durchrutschen.
 */
const NOISE_LINES = new Set([
  'name', 'wert', 'bestand', 'positionen', 'übersicht', 'cluster', 'anteil',
  'art', 'isin', 'ticker', 'depotwert', 'gesamt', 'summe', 'stück', 'stückzahl',
  'kurs', 'datum', 'kaufkurs', 'aktueller kurs', 'gewinn', 'verlust', 'performance',
  'wkn', 'einstand', 'portfolio', 'depot', 'anlage', 'wertpapiere',
]);

function isNoiseLine(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.length < 2 || NOISE_LINES.has(t);
}

/** Reine Zahl mit höchstens Punkt/Komma — vermutlich der Wert einer zweizeiligen Zeile, kein Name. */
function isAmountOnly(text: string): boolean {
  const stripped = text.trim().replace(/[€$£₣¥]/g, '').trim();
  if (!stripped) return false;
  return /^-?[\d.,\s']+$/.test(stripped) || /^-?[\d.,\s']+\s*[A-Z]{3}$/.test(stripped);
}

function extractIsin(text: string): { isin: string | null; rest: string } {
  const match = ISIN_RE.exec(text);
  if (!match) return { isin: null, rest: text };
  const candidate = match[0].toUpperCase();
  if (!isValidIsin(candidate)) return { isin: null, rest: text };
  return { isin: candidate, rest: text.slice(0, match.index) + text.slice(match.index + match[0].length) };
}

const CURRENCY_TOKEN_RE = /[€$£₣¥]|\b(EUR|USD|CHF|GBP|DKK|CAD|SEK|NOK|JPY)\b/gi;

/**
 * Übrig gebliebenen Namen von Währungszeichen, Satzzeichen und doppelten
 * Leerzeichen befreien. Ohne den Währungsschritt bleibt z. B. aus
 * "NVIDIA 11.826,00 €" nach Entfernen des Betrags noch "NVIDIA €" übrig —
 * das Symbol steht ja hinter der Zahl, nicht in ihr.
 */
function cleanName(text: string): string {
  return text
    .replace(CURRENCY_TOKEN_RE, ' ')
    .replace(/[|•·_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, '')
    .trim();
}

/**
 * Liest Positionskandidaten aus erkannten Textzeilen.
 *
 * Zwei Layouts werden erkannt:
 *  - einzeilig: "NVIDIA 11.826,00 € US67066G1040" — Name, Betrag und ISIN in
 *    einer Zeile, wie es Tabellen-Layouts liefern.
 *  - zweizeilig: eine Zeile nur mit dem Namen, die nächste nur mit dem Betrag
 *    — wie es viele Broker-Apps im Listenlayout darstellen.
 *
 * Das ist eine Heuristik, keine Garantie. Deshalb bekommt jede Zeile ein
 * Vertrauensmaß, und nichts wird ohne den Prüfdialog gespeichert.
 */
export function parseLines(lines: RecognizedLine[]): { rows: ExtractedRow[]; warnings: string[] } {
  const rows: ExtractedRow[] = [];
  const warnings: string[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i];
    if (!line) continue;
    const raw = line.text.trim();
    if (isNoiseLine(raw) || isAmountOnly(raw)) continue;

    const { isin, rest: withoutIsin } = extractIsin(raw);
    const currency = parseCurrency(withoutIsin);
    const value = parseAmount(withoutIsin);

    if (value != null) {
      // Einzeilig: Betrag steckt in derselben Zeile wie der Name.
      const amountMatch = /-?\d[\d.,\s']*\d|-?\d/.exec(withoutIsin);
      const name = cleanName(
        amountMatch
          ? withoutIsin.slice(0, amountMatch.index) + withoutIsin.slice(amountMatch.index + amountMatch[0].length)
          : withoutIsin,
      );
      if (!name || /^\d+$/.test(name)) continue;

      rows.push({
        name,
        value,
        currency,
        isin,
        ticker: null,
        quantity: null,
        confidence: line.confidence / 100,
        raw,
      });
      continue;
    }

    // Zweizeilig: diese Zeile ist nur ein Name, die nächste nur ein Betrag.
    const next = lines[i + 1];
    if (next && isAmountOnly(next.text) && !isNoiseLine(next.text)) {
      const nextValue = parseAmount(next.text);
      if (nextValue != null) {
        const name = cleanName(withoutIsin);
        if (name && !/^\d+$/.test(name)) {
          rows.push({
            name,
            value: nextValue,
            currency: parseCurrency(next.text),
            isin,
            ticker: null,
            quantity: null,
            confidence: Math.min(line.confidence, next.confidence) / 100,
            raw: `${raw} / ${next.text.trim()}`,
          });
          consumed.add(i + 1);
        }
      }
    }
  }

  if (rows.length === 0) {
    warnings.push('Keine Positionen erkannt. Liegt das Foto gerade, ist es scharf und gut beleuchtet?');
  }
  const lowConfidence = rows.filter((r) => r.confidence < 0.6).length;
  if (lowConfidence > 0) {
    warnings.push(
      `${lowConfidence} von ${rows.length} Zeilen mit niedrigem Vertrauen — bitte im nächsten Schritt genau prüfen.`,
    );
  }

  return { rows, warnings };
}
