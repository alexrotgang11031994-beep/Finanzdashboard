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

/**
 * Reine Prozentzahl — z. B. die Tagesperformance neben einer Position.
 *
 * Viele Broker-Apps zeigen pro Zeile Name, Betrag und eine Prozentzahl in
 * getrennten Textblöcken. Ohne diese Erkennung liest der Parser "1,86 %" als
 * eigenständigen Betrag von 1,86 und baut daraus eine Phantomposition mit dem
 * Namen "%".
 */
function isPercentOnly(text: string): boolean {
  return /^[+-]?[\d.,\s]+\s*%$/.test(text.trim());
}

const TRAILING_PERCENT_RE = /[+-]?[\d.,\s]+\s*%\s*$/;

/**
 * Entfernt eine angehängte Prozentzahl am Zeilenende, auch wenn davor noch
 * Name oder Betrag stehen.
 *
 * Tesseract gruppiert Zeilen nach vertikaler Position, nicht nach Spalte.
 * Steht die Tagesperformance in der Bildmitte zwischen Name und Betrag,
 * landet sie oft auf derselben erkannten Zeile wie der Name — "SAP 1,86 %"
 * statt zwei getrennter Zeilen. Ohne diesen Schritt liest parseAmount() die
 * Prozentzahl als Geldbetrag und der eigentliche Wert in der nächsten Zeile
 * wird nie zugeordnet.
 */
function stripTrailingPercent(text: string): string {
  return text.replace(TRAILING_PERCENT_RE, '').trim();
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
    if (isPercentOnly(raw)) continue;
    // Für die Erkennung selbst wird eine angehängte Prozentzahl entfernt;
    // "raw" bleibt der Originaltext für die Anzeige im Prüfdialog.
    const withoutPercent = stripTrailingPercent(raw);
    if (isNoiseLine(withoutPercent) || isAmountOnly(withoutPercent)) continue;

    const { isin, rest: withoutIsin } = extractIsin(withoutPercent);
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

    // Zweizeilig: diese Zeile ist nur ein Name, die nächste nur ein Betrag —
    // auch wenn an den Betrag noch eine Prozentzahl angehängt ist
    // ("1.406 € 1,86 %" statt zweier getrennter Zeilen).
    const next = lines[i + 1];
    const nextWithoutPercent = next ? stripTrailingPercent(next.text) : null;
    if (next && nextWithoutPercent && isAmountOnly(nextWithoutPercent) && !isNoiseLine(nextWithoutPercent)) {
      const nextValue = parseAmount(nextWithoutPercent);
      if (nextValue != null) {
        const name = cleanName(withoutIsin);
        if (name && !/^\d+$/.test(name)) {
          rows.push({
            name,
            value: nextValue,
            currency: parseCurrency(nextWithoutPercent),
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
