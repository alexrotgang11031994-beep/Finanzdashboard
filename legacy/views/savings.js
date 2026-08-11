import { h, eur, num, signed } from '../lib/format.js';
import { byCluster, flowByCluster } from '../lib/metrics.js';
import { CLUSTERS } from '../config.js';

const INTERVAL = { weekly: 'wöchentlich', semimonthly: 'zweimal im Monat', monthly: 'monatlich' };

export function renderSavings(ctx) {
  const { positions, plans, total } = ctx;
  const clusters = byCluster(positions, total);
  const { flow, total: flowTotal } = flowByCluster(plans);

  const sorted = [...plans].sort((a, b) => b.monthly - a.monthly);
  const maxPlan = sorted[0]?.monthly || 1;

  const clusterRows = Object.keys(CLUSTERS).map((k) => {
    const c = CLUSTERS[k];
    const stockPct = clusters[k].pct;
    const flowPct = ((flow[k] || 0) / flowTotal) * 100;
    const delta = flowPct - stockPct;
    return h('tr', {},
      h('td', { class: 'l' }, h('i', { class: 'chip', style: `background:${c.color}` }), c.label),
      h('td', { class: 'n' }, num(stockPct, 1) + ' %'),
      h('td', { class: 'n' }, num(flowPct, 1) + ' %'),
      h('td', { class: 'n ' + (Math.abs(delta) < 1 ? 'flat' : delta > 0 ? 'up' : 'dn') },
        signed(delta, 1)),
      h('td', { class: 'n' }, num(c.target, 0) + ' %'));
  });

  return h('div', {},
    h('h2', {}, 'Sparpläne'),
    h('p', {}, `${plans.length} aktive Pläne, zusammen ${eur(flowTotal)} im Monat `
      + `und ${eur(flowTotal * 12)} im Jahr. Wochenpläne sind mit 4,333 Ausführungen `
      + 'pro Monat gerechnet.'),

    h('h3', {}, 'Verstärkt oder gleicht der Zufluss aus?'),
    h('p', { class: 'sm' }, 'Die Spalte Δ zeigt, ob ein Cluster mehr oder weniger frisches '
      + 'Geld bekommt, als er ohnehin schon Gewicht hat. Werte nahe null bedeuten: '
      + 'Der Sparplan schreibt den Ist-Zustand fort.'),
    h('div', { class: 'tblwrap' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', { class: 'l' }, 'Cluster'),
          h('th', {}, 'Bestand'),
          h('th', {}, 'Zufluss'),
          h('th', {}, 'Δ'),
          h('th', {}, 'Ziel'))),
        h('tbody', {}, clusterRows))),

    h('h3', {}, 'Einzelne Pläne'),
    h('div', { class: 'tblwrap' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', { class: 'l' }, 'Plan'),
          h('th', { class: 'l' }, 'Cluster'),
          h('th', { class: 'l' }, 'Rhythmus'),
          h('th', {}, 'Rate'),
          h('th', {}, 'je Monat'),
          h('th', { class: 'l', style: 'width:18%' }, ''))),
        h('tbody', {}, sorted.map((p) => {
          const c = CLUSTERS[p.cluster] || { label: '–', color: '#999' };
          return h('tr', {},
            h('td', { class: 'l' },
              h('i', { class: 'chip', style: `background:${c.color}` }), p.name),
            h('td', { class: 'l mono-s' }, c.label),
            h('td', { class: 'l mono-s' }, INTERVAL[p.interval] || p.interval),
            h('td', { class: 'n' }, eur(p.amount)),
            h('td', { class: 'n' }, eur(p.monthly, 0)),
            h('td', { class: 'l' },
              h('div', { class: 'dbar' },
                h('i', { style: `background:${c.color};width:${(p.monthly / maxPlan) * 100}%` }))));
        })))));
}
