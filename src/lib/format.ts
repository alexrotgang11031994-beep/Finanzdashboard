/**
 * Zahlen-, Währungs- und Datumsformatierung.
 *
 * Portiert aus legacy/lib/format.js. Die DOM-Helfer h() und text() sind
 * entfallen — die übernimmt React. Die Intl-Formatter werden jetzt
 * zwischengespeichert; vorher entstand bei jedem Aufruf ein neues Objekt,
 * was in virtualisierten Tabellen mit hunderten Zellen spürbar wird.
 */

export const LOCALE = 'de-DE';
export const BASE_CURRENCY = 'EUR';

const numberCache = new Map<string, Intl.NumberFormat>();

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let fmt = numberCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(LOCALE, options);
    numberCache.set(key, fmt);
  }
  return fmt;
}

export const eur = (v: number, d = 0): string =>
  numberFormat({
    style: 'currency',
    currency: BASE_CURRENCY,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);

export const num = (v: number, d = 0): string =>
  numberFormat({ minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export const pct = (v: number, d = 1): string => `${num(v, d)} %`;

export const signed = (v: number, d = 1): string => (v > 0 ? '+' : '') + num(v, d);

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const date = (iso: string): string => dateFormat.format(new Date(iso));

/** Betrag einer beliebigen Währung — für Positionen, die nicht in Euro notieren. */
export const money = (v: number, currency: string, d = 0): string =>
  numberFormat({
    style: 'currency',
    currency,
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
