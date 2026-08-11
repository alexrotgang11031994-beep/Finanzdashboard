import { PRICES } from '../config.js';

/**
 * Kursanbindung mit Adapter.
 *
 * Standardfall ist 'none': das Dashboard rechnet mit den Snapshot-Werten
 * aus portfolio.json. Das ist ehrlich - es steht dann auch so in der Kopfzeile.
 *
 * Für den Produktivbetrieb ist 'static' der richtige Weg: ein GitHub-Workflow
 * holt die Kurse serverseitig und legt prices.json ab. Dann liegt kein
 * API-Schlüssel im Browser und es gibt kein CORS-Problem.
 */
export async function loadPrices(positions) {
  switch (PRICES.provider) {
    case 'static':
      return fetchStatic();
    case 'marketstack':
    case 'twelvedata':
      console.warn(
        'Direktabfrage aus dem Browser legt den API-Schlüssel offen und läuft '
        + 'meist in CORS-Fehler. Empfohlen: provider "static" plus Workflow.'
      );
      return { source: 'none', quotes: {}, stale: true };
    default:
      return { source: 'snapshot', quotes: {}, stale: true };
  }
}

async function fetchStatic() {
  try {
    const res = await fetch(new URL('../data/prices.json', import.meta.url));
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return { source: 'static', quotes: data.quotes || {}, asOf: data.asOf, stale: false };
  } catch {
    return { source: 'snapshot', quotes: {}, stale: true };
  }
}

/** Bewertet Positionen neu, sofern Kurse vorliegen. */
export function revalue(positions, quotes) {
  if (!quotes || !Object.keys(quotes).length) return positions;
  return positions.map((p) => {
    const q = p.isin && quotes[p.isin];
    if (!q || !q.factor) return p;
    return { ...p, value: p.value * q.factor, revalued: true };
  });
}
