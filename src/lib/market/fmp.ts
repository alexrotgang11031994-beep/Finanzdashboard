/**
 * Anbindung an Financial Modeling Prep für die Wertpapiersuche und Kurse.
 *
 * Läuft direkt aus dem Browser — es gibt im lokalen Modus keinen Server, der
 * einen Schlüssel verstecken könnte. FMP setzt auf allen hier genutzten
 * Endpunkten Access-Control-Allow-Origin, ein direkter fetch() klappt also
 * (anders als bei den meisten Kursanbietern, siehe legacy/lib/prices.js).
 * Der Schlüssel ist der des Nutzers, liegt nur in seinem localStorage und
 * geht ausschließlich an financialmodelingprep.com.
 *
 * Kostenloser Plan: 250 Anfragen/Tag, Kurse mit Verzögerung (kein Realtime),
 * internationale Börsen (u. a. XETRA) nicht auf jedem Symbol verfügbar —
 * dieselbe Lücke, die schon in docs für die Kursanbindung vermerkt ist.
 */

const KEY_STORAGE = 'finanzdashboard:fmp-key';
const BASE = 'https://financialmodelingprep.com/api/v3';

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? '';
}

export function setApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(KEY_STORAGE, trimmed);
  else localStorage.removeItem(KEY_STORAGE);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export class MarketDataError extends Error {}

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = getApiKey();
  if (!key) throw new MarketDataError('Kein API-Schlüssel hinterlegt.');
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', key);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new MarketDataError('Anfrage fehlgeschlagen — keine Verbindung.');
  }
  if (res.status === 401) throw new MarketDataError('API-Schlüssel ungültig.');
  if (res.status === 403) throw new MarketDataError('Für diese Abfrage reicht der kostenlose Plan nicht.');
  if (res.status === 429) throw new MarketDataError('Tageslimit erreicht — bitte später erneut versuchen.');
  if (!res.ok) throw new MarketDataError(`Abfrage fehlgeschlagen (${res.status}).`);

  const data = (await res.json()) as unknown;
  if (data && typeof data === 'object' && !Array.isArray(data) && 'Error Message' in data) {
    throw new MarketDataError(String((data as Record<string, unknown>)['Error Message']));
  }
  return data as T;
}

export interface SymbolResult {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
}

interface RawSearchRow {
  symbol?: string;
  name?: string;
  currency?: string;
  exchangeShortName?: string;
  stockExchange?: string;
}

export async function searchSymbols(query: string): Promise<SymbolResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const raw = await call<RawSearchRow[]>('/search', { query: q, limit: '8' });
  return (raw ?? [])
    .filter((r) => r.symbol && r.name)
    .map((r) => ({
      symbol: r.symbol!,
      name: r.name!,
      currency: r.currency ?? '',
      exchange: r.exchangeShortName ?? r.stockExchange ?? '',
    }));
}

export interface SymbolProfile {
  symbol: string;
  isin: string | null;
  sector: string | null;
  industry: string | null;
  price: number | null;
  currency: string | null;
}

interface RawProfileRow {
  symbol?: string;
  isin?: string;
  sector?: string;
  industry?: string;
  price?: number;
  currency?: string;
}

export async function getProfile(symbol: string): Promise<SymbolProfile | null> {
  const raw = await call<RawProfileRow[]>(`/profile/${encodeURIComponent(symbol)}`);
  const p = raw?.[0];
  if (!p) return null;
  return {
    symbol: p.symbol ?? symbol,
    isin: p.isin || null,
    sector: p.sector || null,
    industry: p.industry || null,
    price: typeof p.price === 'number' ? p.price : null,
    currency: p.currency || null,
  };
}

export interface Quote {
  symbol: string;
  price: number;
}

interface RawQuoteRow {
  symbol?: string;
  price?: number;
}

/** Ein Aufruf für beliebig viele Symbole — schont das Tageslimit. */
export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const uniq = Array.from(new Set(symbols.map((s) => s.trim()).filter(Boolean)));
  const result = new Map<string, Quote>();
  if (uniq.length === 0) return result;
  const raw = await call<RawQuoteRow[]>(`/quote/${uniq.map(encodeURIComponent).join(',')}`);
  for (const q of raw ?? []) {
    if (q.symbol && typeof q.price === 'number') {
      result.set(q.symbol, { symbol: q.symbol, price: q.price });
    }
  }
  return result;
}

/**
 * Grobe Zuordnung Branche → Depot-Cluster. Die Cluster hier sind thematisch
 * (KI-Infrastruktur, Physical AI & Robotik …), keine Standard-GICS-Sektoren —
 * eine API kann das nicht zuverlässig treffen. Deshalb nur ein Vorschlag bei
 * eindeutigen Stichworten, sonst nichts. Das Formular übernimmt ihn nie
 * automatisch über eine bereits gesetzte Auswahl.
 */
const CLUSTER_HINTS: Array<[RegExp, string]> = [
  [/semiconductor/i, 'SEMI'],
  [/(robot|surgical instruments|autonomous|drone)/i, 'PHYS'],
  [/(data center|cloud|networking equipment)/i, 'INFRA'],
  [/software/i, 'SOFT'],
  [/(gold|silver|precious metal|mining|other precious metals)/i, 'ROHS'],
  [/(aerospace|defense|industrial)/i, 'INDU'],
  [/(utilities|consumer defensive|pharmaceutical|household|beverage)/i, 'DEFE'],
];

export function suggestCluster(industry: string | null, sector: string | null): string | null {
  const text = `${industry ?? ''} ${sector ?? ''}`.trim();
  if (!text) return null;
  for (const [re, key] of CLUSTER_HINTS) {
    if (re.test(text)) return key;
  }
  return null;
}
