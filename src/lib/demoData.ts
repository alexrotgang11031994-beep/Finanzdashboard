import type { ExportBundle } from './store/types';
import { DEFAULT_CLUSTERS, DEFAULT_RULES } from './defaults';
import { monthlyAmount } from './metrics';

/**
 * Beispieldepot zum Ausprobieren. Frei erfunden, keine echten Bestände.
 *
 * Alle Cluster-Schlüssel stammen aus DEFAULT_CLUSTERS. Die früheren
 * JSON-Demodaten benutzten Schlüssel wie GLOB oder EU50, die in der
 * Konfiguration nie definiert waren — dadurch fielen die Positionen aus der
 * Cluster-Auswertung heraus, ohne dass es jemandem auffiel.
 */

const positions: Array<{
  name: string;
  ticker: string | null;
  isin: string | null;
  value: number;
  currency: string;
  cluster: string;
  type: string;
}> = [
  { name: 'Vanguard FTSE All-World UCITS ETF', ticker: 'VWCE', isin: 'IE00BK5BQT80', value: 28500, currency: 'EUR', cluster: 'KERN', type: 'ETF' },
  { name: 'iShares Core MSCI World UCITS ETF', ticker: 'IWDA', isin: 'IE00B4L5Y983', value: 15200, currency: 'EUR', cluster: 'KERN', type: 'ETF' },
  { name: 'Microsoft', ticker: 'MSFT', isin: 'US5949181045', value: 12800, currency: 'USD', cluster: 'SOFT', type: 'Aktie' },
  { name: 'NVIDIA', ticker: 'NVDA', isin: 'US67066G1040', value: 11400, currency: 'USD', cluster: 'SEMI', type: 'Aktie' },
  { name: 'TSMC (ADR)', ticker: 'TSM', isin: 'US8740391003', value: 9600, currency: 'USD', cluster: 'SEMI', type: 'Aktie' },
  { name: 'ASML', ticker: 'ASML', isin: 'NL0010273215', value: 7300, currency: 'EUR', cluster: 'SEMI', type: 'Aktie' },
  { name: 'Apple', ticker: 'AAPL', isin: 'US0378331005', value: 8900, currency: 'USD', cluster: 'SOFT', type: 'Aktie' },
  { name: 'Alphabet (A)', ticker: 'GOOGL', isin: 'US02079K3059', value: 6800, currency: 'USD', cluster: 'SOFT', type: 'Aktie' },
  { name: 'Physical Gold EUR (Acc)', ticker: null, isin: 'IE00B4ND3602', value: 8200, currency: 'EUR', cluster: 'ROHS', type: 'ETC' },
  { name: 'Siemens Energy', ticker: 'ENR', isin: 'DE000ENER6Y0', value: 4100, currency: 'EUR', cluster: 'INFRA', type: 'Aktie' },
  { name: 'Vertiv Holdings', ticker: 'VRT', isin: 'US92537N1081', value: 3600, currency: 'USD', cluster: 'INFRA', type: 'Aktie' },
  { name: 'Tesla', ticker: 'TSLA', isin: 'US88160R1014', value: 5200, currency: 'USD', cluster: 'PHYS', type: 'Aktie' },
  { name: 'ABB', ticker: 'ABBN', isin: 'CH0012221716', value: 3400, currency: 'CHF', cluster: 'PHYS', type: 'Aktie' },
  { name: 'Rheinmetall', ticker: 'RHM', isin: 'DE0007030009', value: 5351, currency: 'EUR', cluster: 'INDU', type: 'Aktie' },
  { name: 'Nestlé', ticker: 'NESN', isin: 'CH0038863350', value: 4200, currency: 'CHF', cluster: 'DEFE', type: 'Aktie' },
  { name: 'Coca-Cola', ticker: 'KO', isin: 'US1912161007', value: 2600, currency: 'USD', cluster: 'DEFE', type: 'Aktie' },
  { name: 'Shell', ticker: 'SHEL', isin: 'GB00BP6MXD84', value: 1410, currency: 'GBP', cluster: 'SPEK', type: 'Aktie' },
];

const plans: Array<{
  name: string;
  amount: number;
  interval: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  cluster: string;
}> = [
  { name: 'Vanguard FTSE All-World', amount: 500, interval: 'monthly', cluster: 'KERN' },
  { name: 'iShares Core MSCI World', amount: 250, interval: 'monthly', cluster: 'KERN' },
  { name: 'ASML', amount: 50, interval: 'weekly', cluster: 'SEMI' },
  { name: 'NVIDIA', amount: 100, interval: 'biweekly', cluster: 'SEMI' },
  { name: 'Microsoft', amount: 100, interval: 'monthly', cluster: 'SOFT' },
  { name: 'Siemens Energy', amount: 10, interval: 'weekly', cluster: 'INFRA' },
  { name: 'Physical Gold', amount: 200, interval: 'monthly', cluster: 'ROHS' },
  { name: 'Coca-Cola', amount: 10, interval: 'weekly', cluster: 'DEFE' },
];

export function buildDemoBundle(): ExportBundle {
  const portfolioId = 'demo';
  const total = positions.reduce((s, p) => s + p.value, 0);
  const today = new Date().toISOString().slice(0, 10);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    portfolio: { id: portfolioId, name: 'Beispieldepot', broker: 'Demo', as_of: today },
    clusters: DEFAULT_CLUSTERS,
    rules: DEFAULT_RULES,
    positions: positions.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      portfolio_id: portfolioId,
      quantity: null,
      source: 'manual' as const,
    })),
    plans: plans.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      portfolio_id: portfolioId,
      monthly: monthlyAmount(p.amount, p.interval),
    })),
    // Genau ein Startpunkt. Eine Wertreihe entsteht erst im Betrieb — eine
    // erfundene Historie wäre eine Lüge über die Wertentwicklung.
    snapshots: [{ id: crypto.randomUUID(), portfolio_id: portfolioId, date: today, value: total, note: 'Erstaufnahme' }],
  };
}
