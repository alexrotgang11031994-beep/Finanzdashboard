/**
 * Wechselkurse für die Umrechnung fremder Kurswährungen nach Euro.
 *
 * Der Depotwert einer Position ist immer in Euro (siehe format.ts — `value`
 * wird überall mit `eur()` formatiert, unabhängig vom `currency`-Feld). Der
 * über die Kursquellen (fmp.ts, onvista.ts, stockanalysis.ts, coingecko.ts)
 * abgerufene Kurs steht dagegen in der Handelswährung der jeweiligen Aktie.
 * Ohne Umrechnung würde z. B. ein USD-Kurs direkt mit einem EUR-Depotwert
 * verrechnet — die daraus abgeleitete Stückzahl wäre falsch.
 *
 * exchangerate-api.com liefert einen kostenlosen, kontofreien Endpunkt mit
 * offenem CORS (kein Schlüssel, ein Aufruf für alle Kurse). Kein SLA, kein
 * Vertrag — bricht bei Ausfall mit klarer Fehlermeldung ab.
 */

export class FxError extends Error {}

let cachedRates: Record<string, number> | null = null;
let cachedAt = 0;
const CACHE_MS = 5 * 60 * 1000;

/** 1 EUR = rates[CODE] Einheiten der jeweiligen Währung. */
async function loadRates(): Promise<Record<string, number>> {
  if (cachedRates && Date.now() - cachedAt < CACHE_MS) return cachedRates;

  let res: Response;
  try {
    res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
  } catch {
    throw new FxError('Wechselkurse nicht erreichbar.');
  }
  if (!res.ok) throw new FxError(`Wechselkurs-Abruf fehlgeschlagen (HTTP ${res.status}).`);

  const data = (await res.json()) as { rates?: Record<string, number> };
  if (!data.rates) throw new FxError('Wechselkurs-Antwort ohne Kurse.');

  cachedRates = data.rates;
  cachedAt = Date.now();
  return cachedRates;
}

/** Rechnet einen Betrag von `currency` nach EUR um. EUR selbst geht ohne Netzwerkaufruf durch. */
export async function toEur(amount: number, currency: string): Promise<number> {
  if (currency === 'EUR') return amount;
  const rates = await loadRates();
  const rate = rates[currency];
  if (!rate) throw new FxError(`Kein Wechselkurs für „${currency}" verfügbar.`);
  return amount / rate;
}
