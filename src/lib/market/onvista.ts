/**
 * Kontofreier Kurs-Fallback für Positionen, die FMP nicht abdeckt (v. a. Xetra
 * und andere Nicht-US-Börsen, siehe fmp.ts).
 *
 * Direktes fetch() auf onvista.de scheitert im Browser an CORS (geprüft: wie
 * Yahoo, Stooq, Börse Frankfurt — keine Access-Control-Allow-Origin-Freigabe).
 * r.jina.ai ist ein kostenloser, öffentlicher „URL zu Text"-Dienst ohne
 * Registrierung, der serverseitig abruft und mit offenem CORS zurückgibt.
 *
 * Das ist kein API-Vertrag — onvista.de kann die Seitenstruktur jederzeit
 * ändern, r.jina.ai kann Limits einführen oder abgeschaltet werden. Beides
 * bricht dann mit einer klaren Fehlermeldung ab statt einen falschen Kurs
 * vorzutäuschen. Für den seltenen, manuellen „Kurse aktualisieren"-Klick
 * einer Einzelperson ist das ein vertretbarer Kompromiss — für einen Dienst
 * mit vielen Nutzern wäre es das nicht.
 */

const READER_BASE = 'https://r.jina.ai/';

export class ScrapeError extends Error {}

export interface ScrapedQuote {
  price: number;
  /** Name der Kursquelle laut onvista-Tabelle, z. B. "Stuttgart Echtzeit". */
  exchange: string;
}

function parseGermanNumber(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOnce(isin: string): Promise<ScrapedQuote> {
  const targetUrl = `https://www.onvista.de/aktien/snapshot.html?ISIN=${encodeURIComponent(isin)}`;

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
  const tableStart = text.indexOf('Aktuelle Aktienkurse');
  if (tableStart < 0) {
    throw new ScrapeError('Keine Kurstabelle gefunden — ISIN unbekannt oder Seite hat sich geändert.');
  }
  const section = text.slice(tableStart);

  // Zeile in der Kurstabelle: "<Börse> [...] | <Preis> EUR <Änderung> EUR · <Änderung> %"
  const rowMatch = /\|\s*([A-Za-zÄÖÜäöüß.\- ]{3,40}?)\s*\[/.exec(section);
  const priceMatch = /(\d{1,3}(?:\.\d{3})*,\d{2,3})\s*EUR\s*[+-]/.exec(section);

  if (!priceMatch?.[1]) {
    throw new ScrapeError('Kein Kurs gefunden — Seitenstruktur hat sich vermutlich geändert.');
  }

  const price = parseGermanNumber(priceMatch[1]);
  if (!Number.isFinite(price) || price <= 0) {
    throw new ScrapeError('Erkannter Kurs ist keine gültige Zahl.');
  }

  return { price, exchange: rowMatch?.[1]?.trim() || 'onvista.de' };
}

/**
 * Holt den ersten in der onvista-Kurstabelle gelisteten Preis zu einer ISIN.
 *
 * Bei einem Depot mit vielen Xetra-Positionen treffen kurz hintereinander
 * mehrere Anfragen über denselben Lesedienst auf onvista.de — das kann
 * vereinzelt zu einer unvollständigen Antwort führen (kein technischer
 * Fehler, nur eine fehlende Kurstabelle), beobachtet bei >10 Abrufen
 * innerhalb weniger Sekunden. Ein einzelner verzögerter Wiederholungsversuch
 * behebt das zuverlässig, ohne bei einem echten, dauerhaften Problem (z. B.
 * geänderte Seitenstruktur) endlos zu wiederholen.
 */
export async function fetchOnvistaPrice(isin: string): Promise<ScrapedQuote> {
  try {
    return await fetchOnce(isin);
  } catch (err) {
    if (!(err instanceof ScrapeError)) throw err;
    await sleep(2500);
    return fetchOnce(isin);
  }
}
