/**
 * Kryptokurse über CoinGecko — anders als die Aktien-Fallbacks (onvista.ts,
 * stockanalysis.ts) kein Scraping, sondern eine echte öffentliche API mit
 * offenem CORS, kostenlos, ohne Schlüssel. Geprüft: Access-Control-Allow-Origin
 * ist gesetzt, direktes fetch() aus dem Browser funktioniert.
 *
 * Deckt nur eine kleine, feste Liste bekannter Ticker ab — CoinGecko
 * identifiziert Coins über eigene IDs statt Tickersymbole, eine vollständige
 * Zuordnung bräuchte einen eigenen Suchaufruf. Für ein Privatdepot mit
 * überschaubarer Kryptoauswahl reicht die feste Liste.
 */

export class MarketDataError extends Error {}

const TICKER_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  XRP: 'ripple',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  LTC: 'litecoin',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  BNB: 'binancecoin',
};

export function isKnownCryptoTicker(ticker: string): boolean {
  return ticker.toUpperCase() in TICKER_TO_ID;
}

export async function fetchCryptoPrice(ticker: string, currency: string): Promise<number> {
  const id = TICKER_TO_ID[ticker.toUpperCase()];
  if (!id) throw new MarketDataError(`„${ticker}" ist keinem bekannten Coin zugeordnet.`);

  const vs = currency.toLowerCase();
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=${vs}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new MarketDataError('Abruf fehlgeschlagen — keine Verbindung zu CoinGecko.');
  }
  if (res.status === 429) throw new MarketDataError('CoinGecko-Limit erreicht — bitte später erneut versuchen.');
  if (!res.ok) throw new MarketDataError(`CoinGecko antwortete mit HTTP ${res.status}.`);

  const data = (await res.json()) as Record<string, Record<string, number>>;
  const price = data[id]?.[vs];
  if (typeof price !== 'number') {
    throw new MarketDataError(`Kein Kurs für „${ticker}" in ${currency} verfügbar.`);
  }
  return price;
}
