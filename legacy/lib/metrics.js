import { CLUSTERS, RULES } from '../config.js';

/** Summiert Positionen zu Clustern und rechnet Anteile aus. */
export function byCluster(positions, total) {
  const out = {};
  for (const key of Object.keys(CLUSTERS)) {
    out[key] = { ...CLUSTERS[key], key, value: 0, pct: 0, count: 0 };
  }
  for (const p of positions) {
    const c = out[p.cluster];
    if (!c) continue;
    c.value += p.value;
    c.count += 1;
  }
  for (const c of Object.values(out)) c.pct = total ? (c.value / total) * 100 : 0;
  return out;
}

/** Herfindahl-Index und die daraus abgeleitete effektive Positionszahl. */
export function concentration(positions, total) {
  if (!total) return { hhi: 0, effective: 0, top2: 0, top5: 0, top10: 0 };
  const w = positions.map((p) => p.value / total).sort((a, b) => b - a);
  const hhi = w.reduce((s, x) => s + x * x, 0);
  const topN = (n) => w.slice(0, n).reduce((s, x) => s + x, 0) * 100;
  return { hhi, effective: 1 / hhi, top2: topN(2), top5: topN(5), top10: topN(10) };
}

/**
 * Prüft das Depot gegen das Regelwerk aus config.js.
 * Rein beschreibend - das ist eine Kennzahl, keine Empfehlung.
 */
export function checkRules(positions, clusters, total) {
  const findings = [];
  for (const p of positions) {
    const share = (p.value / total) * 100;
    if (share > RULES.maxSinglePosition) {
      findings.push({ level: 'hoch', rule: 'Positionsgrenze',
        text: `${p.name} liegt bei ${share.toFixed(1)} % (Grenze ${RULES.maxSinglePosition} %).` });
    }
  }
  for (const c of Object.values(clusters)) {
    if (c.pct > RULES.maxCluster) {
      findings.push({ level: 'hoch', rule: 'Clustergrenze',
        text: `${c.label} liegt bei ${c.pct.toFixed(1)} % (Grenze ${RULES.maxCluster} %).` });
    }
  }
  if (clusters.KERN && clusters.KERN.pct < RULES.minCore) {
    findings.push({ level: 'hoch', rule: 'Kernquote',
      text: `Breiter Markt liegt bei ${clusters.KERN.pct.toFixed(1)} % (Mindestwert ${RULES.minCore} %).` });
  }
  if (positions.length > RULES.maxPositions) {
    findings.push({ level: 'mittel', rule: 'Anzahl Positionen',
      text: `${positions.length} Positionen (Obergrenze ${RULES.maxPositions}).` });
  }
  const tiny = positions.filter((p) => (p.value / total) * 100 < 0.3);
  if (tiny.length) {
    findings.push({ level: 'niedrig', rule: 'Mindestgröße',
      text: `${tiny.length} Positionen unter 0,3 % Depotanteil.` });
  }
  return findings;
}

/** Monatlicher Zufluss je Cluster aus den Sparplänen. */
export function flowByCluster(plans) {
  const out = {};
  let total = 0;
  for (const p of plans) {
    out[p.cluster] = (out[p.cluster] || 0) + p.monthly;
    total += p.monthly;
  }
  return { flow: out, total };
}

/**
 * Reine Zuflussprojektion bei unveraenderten Kursen.
 * Zeigt den Effekt der Sparraten, ist ausdruecklich keine Marktprognose.
 */
export function projectFlows(clusters, flow, months) {
  const state = {};
  for (const k of Object.keys(clusters)) state[k] = clusters[k].value;
  const series = [];
  for (let m = 0; m <= months; m++) {
    const total = Object.values(state).reduce((s, x) => s + x, 0);
    const row = { month: m, total };
    for (const k of Object.keys(state)) row[k] = (state[k] / total) * 100;
    series.push(row);
    for (const k of Object.keys(state)) state[k] += flow[k] || 0;
  }
  return series;
}
