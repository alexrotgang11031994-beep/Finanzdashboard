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

/**
 * Vereinzeltes Satzzeichen am Zeilenrand, das Tesseract manchmal zusätzlich
 * zum eigentlichen Text erkennt — ein Kompressionsartefakt am Bildrand, ein
 * verschmiertes Icon-Fragment, ein Anführungszeichen aus einem Nachbar-
 * Element. Trennt es weder Zahl noch Wort, ist es kein Inhalt.
 *
 * Die runden Klammern gehören aus demselben Grund dazu wie das Prozentzeichen
 * oben: bei einem Namen, der mit "(Acc)" oder "(ADR)" endet, hängt Tesseract
 * die schließende Klammer regelmäßig an den Betrag der nächsten Zeile an
 * ("8.202 € )" statt "8.202 €") — vermutlich, weil sie geometrisch näher am
 * Betrag als am Rest des Namens liegt. Ohne diese Toleranz gilt die Zeile
 * nicht mehr als reiner Betrag, die Paarung mit dem Namen schlägt fehl, und
 * die ganze Position verschwindet spurlos statt fehlerhaft aufzufallen.
 */
// Aus numerischen Codepunkten gebaut statt eines Zeichenklassen-Literals:
// links- und rechtsseitige typografische Anführungszeichen sehen sich beim
// Eintippen zum Verwechseln ähnlich, und ein falscher Codepunkt in einem
// Literal läuft still ins Leere, ohne beim Lesen aufzufallen — die ersten
// beiden Versuche dieser Zeile trafen genau das. Zahlen sind eindeutig.
const OCR_NOISE_CODEPOINTS = [
  0x2018, // '  LEFT SINGLE QUOTATION MARK
  0x2019, // '  RIGHT SINGLE QUOTATION MARK
  0x201c, // "  LEFT DOUBLE QUOTATION MARK
  0x201d, // "  RIGHT DOUBLE QUOTATION MARK
  0x0027, // '  APOSTROPHE
  0x0022, // "  QUOTATION MARK
  0x0060, // `  GRAVE ACCENT
  0x00b4, // ´  ACUTE ACCENT
  0x002e, // .  FULL STOP
  0x002c, // ,  COMMA
  0x003b, // ;  SEMICOLON
  0x003a, // :  COLON
  0x0021, // !  EXCLAMATION MARK
  0x003f, // ?  QUESTION MARK
  // Tesseract hängt am Ende einer Betragszeile beobachtbar unterschiedliche
  // Klammer-Glyphen an — mal "(Acc)" als ")", mal als "}" — vermutlich je nach
  // Kantenglättung des jeweiligen Zeichens im Ausgangsbild. Statt einzelne
  // Fälle nachzutragen, sind alle gängigen Klammertypen pauschal toleriert.
  0x0028, // (  LEFT PARENTHESIS
  0x0029, // )  RIGHT PARENTHESIS
  0x005b, // [  LEFT SQUARE BRACKET
  0x005d, // ]  RIGHT SQUARE BRACKET
  0x007b, // {  LEFT CURLY BRACKET
  0x007d, // }  RIGHT CURLY BRACKET
];
// Die Zeichenklasse wird aus \u-Escape-SEQUENZEN im Regex-Quelltext gebaut,
// nicht aus vorab per String.fromCharCode() aufgelösten Zeichen. Grund: der
// Codepunkt für "]" schließt eine bereits per String.fromCharCode()
// aufgelöste Zeichenklasse vorzeitig, weil er dort als Metazeichen ankommt —
// alles danach (einschließlich der geschweiften Klammern) landet als kaputte
// Syntax außerhalb der Klasse, ohne dass new RegExp() einen Fehler wirft.
// \u-Escapes bleiben dagegen für den Regex-Parser erkennbare Escapes, die nie
// als Metazeichen interpretiert werden, unabhängig vom Zielzeichen.
const OCR_NOISE_RE = new RegExp(
  `[${OCR_NOISE_CODEPOINTS.map((cp) => `\\u${cp.toString(16).padStart(4, '0')}`).join('')}]`,
  'g',
);

/**
 * Reine Zahl, evtl. mit Währung — toleriert dabei ein kurzes, unvorhersagbares
 * Fragment am Rand (höchstens zwei Zeichen).
 *
 * Tesseract hängt an den Betrag gelegentlich ein einzelnes Fehlzeichen an,
 * dessen genaue Form sich nicht vorab auflisten lässt — mal ein
 * Anführungszeichen, mal eine Klammer, mal ein Semikolon oder ein einzelnes
 * "i", abhängig vom Kompressionsgrad und Schriftrendering des Originalfotos.
 * Besonders stark komprimierte Bilder (z. B. Fotos, die über WhatsApp
 * verschickt wurden) erzeugen fast immer irgendein kurzes Fragment dieser
 * Art — nur nie dasselbe zweimal. Eine Liste bekannter Störzeichen holt
 * diesen Fall also nie vollständig ein. Ein Rest von höchstens zwei Zeichen
 * um die eigentliche Zahl herum wird deshalb grundsätzlich toleriert: ein
 * echter Name oder eine echte zweite Zahl wäre nie so kurz.
 */
function isAmountOnly(text: string): boolean {
  const stripped = text
    .trim()
    .replace(/[€$£₣¥]/g, '')
    .replace(OCR_NOISE_RE, ' ')
    .trim();
  if (!stripped) return false;
  if (/^-?[\d.,\s']+$/.test(stripped) || /^-?[\d.,\s']+\s*[A-Z]{3}$/.test(stripped)) return true;

  const amountMatch = /-?\d[\d.,\s']*\d|-?\d/.exec(stripped);
  if (!amountMatch) return false;
  const before = stripped.slice(0, amountMatch.index).trim();
  const after = stripped.slice(amountMatch.index + amountMatch[0].length).trim();
  return before.length <= 2 && after.length <= 2;
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

    // Eine Zahl gilt nur als Betrag, wenn ihr in der Zeile nichts außer
    // einem Währungssymbol/-code folgt. Bei einem Namen wie "S&P 500
    // Information Tech" oder "WTI Crude Oil 3x Lev" steht die Zahl mitten im
    // Namen — der echte Betrag steht dann auf der nächsten Zeile. Ohne diese
    // Prüfung würde die eingebettete Zahl fälschlich als Positionswert gelesen
    // und der Name dabei verstümmelt.
    const amountMatch = /-?\d[\d.,\s']*\d|-?\d/.exec(withoutIsin);
    // Wie in isAmountOnly(): ein Rest von höchstens zwei Zeichen nach der
    // Zahl gilt als Störfragment, nicht als Namensanfang — "Information
    // Tech (Acc)" bleibt mit >2 Zeichen zuverlässig ausgeschlossen.
    const amountIsTrailing =
      amountMatch != null &&
      withoutIsin
        .slice(amountMatch.index + amountMatch[0].length)
        .replace(CURRENCY_TOKEN_RE, '')
        .replace(OCR_NOISE_RE, '')
        .trim().length <= 2;
    const value = amountIsTrailing ? parseAmount(withoutIsin) : null;

    if (value != null && amountMatch) {
      // Einzeilig: Betrag steckt in derselben Zeile wie der Name.
      const name = cleanName(
        withoutIsin.slice(0, amountMatch.index) + withoutIsin.slice(amountMatch.index + amountMatch[0].length),
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
