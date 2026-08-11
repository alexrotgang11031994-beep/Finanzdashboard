/**
 * Geldbeträge aus erkanntem Text lesen.
 *
 * Das ist die heikelste Stelle des Foto-Imports: ein falsch gedeutetes
 * Trennzeichen verschiebt den Wert um drei Größenordnungen. Deshalb steht die
 * Logik hier isoliert und ausdrücklich beschrieben, statt irgendwo in einer
 * Zeilenschleife zu verschwinden.
 *
 *   "11.826,00 €"  -> 11826.00   deutsch, Punkt gruppiert
 *   "11,826.00"    -> 11826.00   englisch, Komma gruppiert
 *   "1.234"        -> 1234       deutsch, drei Stellen nach dem Punkt
 *   "1.23"         -> 1.23       zwei Stellen nach dem Punkt: Dezimaltrennung
 *   "11 826,00"    -> 11826.00   schmales Leerzeichen als Gruppierung
 */

/** Erkennt Zeichenketten, die überhaupt als Betrag in Frage kommen. */
const AMOUNT_RE = /-?\d[\d.,\s  ']*\d|-?\d/;

const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  '₣': 'CHF',
  '¥': 'JPY',
};

const CURRENCY_CODES = ['EUR', 'USD', 'CHF', 'GBP', 'DKK', 'CAD', 'SEK', 'NOK', 'JPY'];

export function parseAmount(input: string): number | null {
  const match = AMOUNT_RE.exec(input);
  if (!match) return null;

  // Gruppierungszeichen entfernen: normale, schmale und geschützte Leerzeichen
  // sowie der im Schweizer Satz übliche Apostroph.
  let s = match[0].replace(/[\s  ']/g, '');

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    // Beide vorhanden: das hintere Zeichen trennt die Dezimalstellen.
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const groupSep = decimalSep === '.' ? ',' : '.';
    s = s.split(groupSep).join('');
    s = s.replace(decimalSep, '.');
  } else if (lastComma >= 0) {
    const after = s.length - lastComma - 1;
    // Ein Komma mit ein oder zwei Nachkommastellen trennt Dezimalstellen,
    // mit drei Stellen gruppiert es. "1,5" ist 1,5 — "1,500" ist 1500.
    s = after > 0 && after <= 2 ? s.replace(',', '.') : s.split(',').join('');
  } else if (lastDot >= 0) {
    const after = s.length - lastDot - 1;
    const dots = s.split('.').length - 1;
    // Mehrere Punkte gruppieren immer. Ein Punkt mit genau drei Stellen
    // dahinter ebenfalls — im deutschen Satz ist "1.234" eintausend­zweihundert.
    s = dots > 1 || after === 3 ? s.split('.').join('') : s;
  }

  const value = Number(s);
  return Number.isFinite(value) ? value : null;
}

/** Liest den Währungshinweis aus einer Zeile — Symbol oder Code. */
export function parseCurrency(input: string): string | null {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (input.includes(symbol)) return code;
  }
  const upper = input.toUpperCase();
  for (const code of CURRENCY_CODES) {
    // Wortgrenze, damit "USD" nicht in einem Namen zufällig trifft.
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  return null;
}
