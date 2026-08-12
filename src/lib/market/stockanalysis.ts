/**
 * Zweiter kontofreier Kurs-Fallback, über Ticker statt ISIN — für Positionen,
 * die FMP sperrt (siehe fmp.ts) und die keine deutsche Börsennotierung haben,
 * für die onvista.ts zuständig wäre. Deckt in Tests u. a. Broadcom, Micron,
 * Caterpillar, Shell, BP, Novo-Nordisk, Green Thumb Industries, Celestica,
 * Marvell, Xometry, D-Wave Quantum und MP Materials ab — alles Symbole, die
 * FMPs undokumentierte Sperrliste trifft.
 *
 * stockanalysis.com liefert eine schlanke, gut strukturierte Kursseite pro
 * Ticker. Direktes fetch() scheitert im Browser an CORS (ungetestet, aber
 * durchgängiges Muster bei jeder bisher geprüften Finanzseite außer FMP);
 * r.jina.ai übernimmt denselben Lesedienst-Umweg wie bei onvista.ts.
 *
 * Andere geprüfte Quellen für diesen Zweck: Yahoo Finance blockiert den
 * Lesedienst aktiv ("Oops, something went wrong"), Google Finance sperrt die
 * gemeinsame Lesedienst-IP wegen Missbrauchsverdacht (403). MarketWatch
 * lieferte ebenfalls brauchbaren Inhalt, wurde aber nicht als Fallback
 * eingebaut, um nicht unnötig viele Wege parallel zu pflegen.
 */

const READER_BASE = 'https://r.jina.ai/';

export class ScrapeError extends Error {}

export interface ScrapedQuote {
  price: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOnce(ticker: string): Promise<ScrapedQuote> {
  const targetUrl = `https://stockanalysis.com/stocks/${encodeURIComponent(ticker)}/`;

  let res: Response;
  try {
    res = await fetch(READER_BASE + targetUrl);
  } catch {
    throw new ScrapeError('Abruf fehlgeschlagen — keine Verbindung zum Lesedienst.');
  }
  if (!res.ok) {
    throw new ScrapeError(`Lesedienst antwortete mit HTTP ${res.status}.`);
  }

  const text = await res.text();
  const bodyStart = text.indexOf('Markdown Content:');
  const body = bodyStart >= 0 ? text.slice(bodyStart) : text;

  // Die Kopfzeile "Firma (TICKER)" markiert den Anfang des eigentlichen
  // Seiteninhalts — davor steht nur Navigation. Direkt danach folgt
  // "BÖRSE: TICKER · Real-Time Price · USD" und dann der aktuelle Kurs als
  // eigenständige Zahlenzeile.
  const anchorIdx = body.indexOf(`(${ticker})`);
  if (anchorIdx < 0) {
    throw new ScrapeError('Ticker nicht gefunden — unbekanntes Symbol oder Seite hat sich geändert.');
  }
  const after = body.slice(anchorIdx);
  const priceMatch = /\n\n(\d[\d,]*\.\d{2})\n\n/.exec(after);
  if (!priceMatch?.[1]) {
    throw new ScrapeError('Kein Kurs gefunden — Seitenstruktur hat sich vermutlich geändert.');
  }

  const price = Number(priceMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) {
    throw new ScrapeError('Erkannter Kurs ist keine gültige Zahl.');
  }

  return { price };
}

/** Ein verzögerter Wiederholungsversuch — derselbe Lesedienst wie onvista.ts, dieselbe Burst-Anfälligkeit. */
export async function fetchStockAnalysisPrice(ticker: string): Promise<ScrapedQuote> {
  try {
    return await fetchOnce(ticker);
  } catch (err) {
    if (!(err instanceof ScrapeError)) throw err;
    await sleep(2500);
    return fetchOnce(ticker);
  }
}
