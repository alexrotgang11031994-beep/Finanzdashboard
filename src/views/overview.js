import { h, eur, num, pct } from '../lib/format.js';
import { byCluster, concentration, checkRules, flowByCluster } from '../lib/metrics.js';
import { CLUSTERS } from '../config.js';

export function renderOverview(ctx) {
  const { positions, plans, total } = ctx;
  const clusters = byCluster(positions, total);
  const conc = concentration(positions, total);
  const findings = checkRules(positions, clusters, total);
  const { flow, total: flowTotal } = flowByCluster(plans);

  const kpi = (v, l, color) =>
    h('div', { class: 'kpi' },
      h('div', { class: 'kpi-v', style: color ? `color:${color}` : null }, v),
      h('div', { class: 'kpi-l' }, l));

  const order = Object.keys(CLUSTERS);
  const bar = (getPct, min) =>
    h('div', { class: 'band' },
      order.map((k) => {
        const p = getPct(k);
        if (p <= 0.01) return null;
        const seg = h('div', { class: 'seg',
          style: `width:${p}%;background:${CLUSTERS[k].color}`,
          title: `${CLUSTERS[k].label} · ${num(p, 1)} %` });
        if (p >= min) seg.appendChild(h('span', {}, num(p, 0) + '%'));
        return seg;
      }));

  return h('div', {},
    h('div', { class: 'kpis' },
      kpi(eur(total), 'Depotwert'),
      kpi(String(positions.length), 'Positionen'),
      kpi(num(conc.effective, 1), 'davon effektiv'),
      kpi(pct(conc.top2), 'Top 2'),
      kpi(eur(flowTotal), 'Zufluss je Monat')),

    h('h2', {}, 'Bestand gegen Zufluss'),
    h('p', {}, 'Oben liegt das Depot, unten die monatlichen Sparraten. '
      + 'Wo beide Streifen gleich aussehen, verstärkt der Sparplan die bestehende Verteilung, '
      + 'statt sie auszugleichen.'),

    h('div', { class: 'band-head' }, h('b', {}, 'Bestand'), h('span', { class: 'num' }, eur(total))),
    bar((k) => clusters[k].pct, 7),
    h('div', { style: 'height:16px' }),
    h('div', { class: 'band-head' }, h('b', {}, 'Zufluss je Monat'),
      h('span', { class: 'num' }, eur(flowTotal))),
    bar((k) => ((flow[k] || 0) / flowTotal) * 100, 7),

    h('div', { class: 'legend' }, order.map((k) =>
      h('div', { class: 'lgi' },
        h('i', { style: `background:${CLUSTERS[k].color}` }),
        CLUSTERS[k].label,
        h('u', {}, `${num(clusters[k].pct, 1)} → Ziel ${CLUSTERS[k].target} %`)))),

    h('h2', { style: 'margin-top:38px' }, 'Regelprüfung'),
    h('p', { class: 'sm' }, 'Abgleich gegen die Grenzwerte in config.js. '
      + 'Das ist eine Messung des Ist-Zustands, keine Empfehlung.'),
    findings.length
      ? h('ul', { class: 'findings' }, findings.map((f) =>
          h('li', { class: 'f-' + f.level },
            h('em', {}, f.level), h('b', {}, f.rule), h('span', {}, f.text))))
      : h('p', {}, 'Alle Grenzwerte eingehalten.'));
}
