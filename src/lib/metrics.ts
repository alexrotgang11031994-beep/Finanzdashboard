/**
 * Depot-Kennzahlen. Alle Funktionen sind rein und ohne DOM-Bezug.
 *
 * Portiert aus legacy/lib/metrics.js. Zwei Unterschiede zum Original:
 *
 * 1. Cluster und Regeln kommen als Argument statt per Import aus config.js,
 *    weil beide jetzt pro Nutzer in der Datenbank liegen.
 * 2. Positionen mit unbekanntem Cluster verschwinden nicht mehr still.
 *    Vorher verwarf byCluster() sie mit `if (!c) continue`, während der
 *    Gesamtwert sie mitzählte — die Cluster-Prozente summierten sich dadurch
 *    nicht auf 100 %. Sie landen jetzt sichtbar in `unassigned`.
 */

import type {
  ClusterBucket,
  ClusterDef,
  Concentration,
  Finding,
  Position,
  ProjectionRow,
  Rules,
  SavingsPlan,
} from './types';

export interface ClusterBreakdown {
  buckets: ClusterBucket[];
  /** Positionen ohne gültiges Cluster. Muss im Normalbetrieb leer sein. */
  unassigned: { value: number; count: number; pct: number };
}

/** Summiert Positionen zu Clustern und rechnet Anteile aus. */
export function byCluster(
  positions: Position[],
  total: number,
  defs: ClusterDef[],
): ClusterBreakdown {
  const index = new Map<string, ClusterBucket>();
  for (const def of defs) {
    index.set(def.key, { ...def, value: 0, pct: 0, count: 0 });
  }

  let unassignedValue = 0;
  let unassignedCount = 0;

  for (const p of positions) {
    const bucket = p.cluster ? index.get(p.cluster) : undefined;
    if (!bucket) {
      unassignedValue += p.value;
      unassignedCount += 1;
      continue;
    }
    bucket.value += p.value;
    bucket.count += 1;
  }

  const share = (v: number) => (total ? (v / total) * 100 : 0);
  const buckets = [...index.values()].sort((a, b) => a.sort_order - b.sort_order);
  for (const b of buckets) b.pct = share(b.value);

  return {
    buckets,
    unassigned: {
      value: unassignedValue,
      count: unassignedCount,
      pct: share(unassignedValue),
    },
  };
}

/** Herfindahl-Index und die daraus abgeleitete effektive Positionszahl. */
export function concentration(positions: Position[], total: number): Concentration {
  const empty: Concentration = { hhi: 0, effective: 0, top2: 0, top5: 0, top10: 0 };
  if (!total) return empty;

  const weights = positions.map((p) => p.value / total).sort((a, b) => b - a);
  const hhi = weights.reduce((s, x) => s + x * x, 0);
  if (!hhi) return empty;

  const topN = (n: number) => weights.slice(0, n).reduce((s, x) => s + x, 0) * 100;
  return { hhi, effective: 1 / hhi, top2: topN(2), top5: topN(5), top10: topN(10) };
}

/**
 * Prüft das Depot gegen das Regelwerk.
 * Rein beschreibend — das sind Kennzahlen, keine Empfehlungen.
 */
export function checkRules(
  positions: Position[],
  breakdown: ClusterBreakdown,
  total: number,
  rules: Rules,
): Finding[] {
  const findings: Finding[] = [];
  if (!total) return findings;

  for (const p of positions) {
    const share = (p.value / total) * 100;
    if (share > rules.maxSinglePosition) {
      findings.push({
        level: 'hoch',
        rule: 'Positionsgrenze',
        text: `${p.name} liegt bei ${share.toFixed(1)} % (Grenze ${rules.maxSinglePosition} %).`,
      });
    }
  }

  for (const c of breakdown.buckets) {
    if (c.pct > rules.maxCluster) {
      findings.push({
        level: 'hoch',
        rule: 'Clustergrenze',
        text: `${c.label} liegt bei ${c.pct.toFixed(1)} % (Grenze ${rules.maxCluster} %).`,
      });
    }
  }

  // Der Kern ist das als is_core markierte Cluster, nicht mehr fest "KERN".
  const core = breakdown.buckets.find((c) => c.is_core);
  if (core && core.pct < rules.minCore) {
    findings.push({
      level: 'hoch',
      rule: 'Kernquote',
      text: `${core.label} liegt bei ${core.pct.toFixed(1)} % (Mindestwert ${rules.minCore} %).`,
    });
  }

  if (positions.length > rules.maxPositions) {
    findings.push({
      level: 'mittel',
      rule: 'Anzahl Positionen',
      text: `${positions.length} Positionen (Obergrenze ${rules.maxPositions}).`,
    });
  }

  // Vorher stand hier eine fest verdrahtete 0.3, während rules.minPositionSize
  // nirgends gelesen wurde. Jetzt zählt der konfigurierte Wert.
  const tiny = positions.filter((p) => (p.value / total) * 100 < rules.minPositionSize);
  if (tiny.length) {
    findings.push({
      level: 'niedrig',
      rule: 'Mindestgröße',
      text: `${tiny.length} Positionen unter ${rules.minPositionSize} % Depotanteil.`,
    });
  }

  if (breakdown.unassigned.count) {
    findings.push({
      level: 'mittel',
      rule: 'Ohne Cluster',
      text: `${breakdown.unassigned.count} Positionen ohne Cluster — sie fehlen in der Aufteilung.`,
    });
  }

  return findings;
}

/** Monatlicher Zufluss je Cluster aus den Sparplänen. */
export function flowByCluster(plans: SavingsPlan[]): {
  flow: Record<string, number>;
  total: number;
} {
  const flow: Record<string, number> = {};
  let total = 0;
  for (const p of plans) {
    const key = p.cluster ?? '';
    flow[key] = (flow[key] ?? 0) + p.monthly;
    total += p.monthly;
  }
  return { flow, total };
}

/**
 * Reine Zuflussprojektion bei unveränderten Kursen.
 * Zeigt den Effekt der Sparraten, ist ausdrücklich keine Marktprognose.
 */
export function projectFlows(
  buckets: ClusterBucket[],
  flow: Record<string, number>,
  months: number,
): ProjectionRow[] {
  const state = new Map<string, number>(buckets.map((c) => [c.key, c.value]));
  const series: ProjectionRow[] = [];

  for (let m = 0; m <= months; m++) {
    let total = 0;
    for (const v of state.values()) total += v;

    const shares: Record<string, number> = {};
    for (const [k, v] of state) shares[k] = total ? (v / total) * 100 : 0;
    series.push({ month: m, total, shares });

    for (const [k, v] of state) state.set(k, v + (flow[k] ?? 0));
  }

  return series;
}

/** Ausführungen pro Monat je Intervall — 52/12 Wochen, 26/12 zweiwöchentlich. */
const EXECUTIONS_PER_MONTH = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  semimonthly: 2,
  monthly: 1,
} as const;

/** Rechnet eine Sparrate auf den Monat um. */
export function monthlyAmount(amount: number, interval: keyof typeof EXECUTIONS_PER_MONTH): number {
  return Math.round(amount * EXECUTIONS_PER_MONTH[interval] * 100) / 100;
}
