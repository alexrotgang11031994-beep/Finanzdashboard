import { h, eur, num, date, signed } from '../lib/format.js';
import { byCluster, flowByCluster, projectFlows } from '../lib/metrics.js';
import { CLUSTERS } from '../config.js';
import { loadSnapshots, saveSnapshot, exportSnapshots, storageAvailable } from '../lib/store.js';

export function renderPerformance(ctx) {
  const { positions, plans, total, seedSnapshots } = ctx;
  const clusters = byCluster(positions, total);
  const { flow } = flowByCluster(plans);
  const wrap = h('div', {});

  function history() {
    const snaps = loadSnapshots(seedSnapshots);
    const box = h('div', {});

    if (snaps.length < 2) {
      box.append(
        h('div', { class: 'empty' },
          h('b', {}, 'Noch keine Wertentwicklung vorhanden.'),
          h('p', {}, 'Aus den Screenshots geht genau ein Zeitpunkt hervor: '
            + `${date(snaps[0]?.date || ctx.asOf)}. Eine Kurve daraus zu zeichnen, `
            + 'wäre erfunden. Ab dem zweiten gespeicherten Stand entsteht hier eine '
            + 'echte Reihe aus echten Werten.'),
          storageAvailable ? null
            : h('p', { class: 'sm' }, 'Hinweis: Dieser Browser erlaubt keinen lokalen '
              + 'Speicher. Stände lassen sich nicht sichern.')));
    } else {
      box.append(chart(snaps), tableOf(snaps));
    }
    return box;
  }

  function chart(snaps) {
    const W = 680, H = 240, L = 62, R = 16, T = 16, B = 30;
    const vals = snaps.map((s) => s.value);
    const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
    const t0 = new Date(snaps[0].date).getTime();
    const tN = new Date(snaps[snaps.length - 1].date).getTime();
    const span = Math.max(tN - t0, 1);
    const x = (d) => L + ((new Date(d).getTime() - t0) / span) * (W - L - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Verlauf des Depotwerts über die gespeicherten Stände');

    const mk = (tag, attrs, txt) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (txt != null) e.textContent = txt;
      return e;
    };
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      svg.append(mk('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#C6CAC1' }));
      svg.append(mk('text', { x: 0, y: y(v) + 4, 'font-family': 'IBM Plex Mono, monospace',
        'font-size': 10, fill: '#5C6360' }, eur(v)));
    }
    const d = snaps.map((s, i) => `${i ? 'L' : 'M'}${x(s.date).toFixed(1)} ${y(s.value).toFixed(1)}`).join(' ');
    svg.append(mk('path', { d, fill: 'none', stroke: '#0E7A6E', 'stroke-width': 2.4 }));
    snaps.forEach((s) => svg.append(mk('circle',
      { cx: x(s.date), cy: y(s.value), r: 3.2, fill: '#0E7A6E' })));

    const first = snaps[0], last = snaps[snaps.length - 1];
    const chg = ((last.value / first.value) - 1) * 100;
    return h('div', {},
      h('div', { class: 'chartwrap' }, svg),
      h('p', { class: 'sm' }, `${date(first.date)} bis ${date(last.date)} · `
        + `${signed(chg, 1)} %. Enthält Einzahlungen — das ist Kontostandsentwicklung, `
        + 'nicht Rendite. Für eine echte Renditekennzahl fehlen die Zahlungszeitpunkte.'));
  }

  function tableOf(snaps) {
    return h('div', { class: 'tblwrap' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', { class: 'l' }, 'Datum'), h('th', {}, 'Depotwert'),
          h('th', {}, 'Δ zum Vorstand'), h('th', { class: 'l' }, 'Notiz'))),
        h('tbody', {}, snaps.slice().reverse().map((s, i, arr) => {
          const prev = arr[i + 1];
          const d = prev ? s.value - prev.value : null;
          return h('tr', {},
            h('td', { class: 'l' }, date(s.date)),
            h('td', { class: 'n' }, eur(s.value)),
            h('td', { class: 'n ' + (d == null ? '' : d >= 0 ? 'up' : 'dn') },
              d == null ? '–' : (d > 0 ? '+' : '') + eur(d)),
            h('td', { class: 'l sm' }, s.note || ''));
        }))));
  }

  const histBox = history();

  const addBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
    const today = new Date().toISOString().slice(0, 10);
    const ok = saveSnapshot({ date: today, value: Math.round(total * 100) / 100,
      note: 'manuell gespeichert' });
    if (ok) histBox.replaceChildren(...history().childNodes);
  } }, 'Aktuellen Stand speichern');

  const expBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => {
    const blob = new Blob([exportSnapshots(seedSnapshots)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'snapshots.json' });
    a.click(); URL.revokeObjectURL(a.href);
  } }, 'Verlauf exportieren');

  // Projektion
  const months = 36;
  const series = projectFlows(clusters, flow, months);
  const projSvg = projectionChart(series, months);

  wrap.append(
    h('h2', {}, 'Entwicklung'),
    histBox,
    h('div', { class: 'btnrow' }, addBtn, expBtn),
    h('p', { class: 'sm' }, 'Stände liegen im lokalen Speicher dieses Browsers. '
      + 'Für ein Produkt mit mehreren Nutzern gehört das in eine Datenbank — '
      + 'siehe README, Abschnitt Mehrbenutzerbetrieb.'),

    h('h2', { style: 'margin-top:40px' }, 'Projektion der Sparraten'),
    h('p', { class: 'sm' }, 'Wohin die Clusteranteile allein durch die laufenden Sparpläne '
      + 'laufen, bei unveränderten Kursen. Das isoliert den Effekt der Zuflüsse und ist '
      + 'ausdrücklich keine Kursprognose.'),
    h('div', { class: 'chartwrap' }, projSvg));

  return wrap;
}

function projectionChart(series, months) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = 680, H = 250, L = 40, R = 96, T = 14, B = 28;
  const maxY = 45;
  const x = (m) => L + (m / months) * (W - L - R);
  const y = (v) => T + (1 - v / maxY) * (H - T - B);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Projektion der Clusteranteile über 36 Monate');
  const mk = (tag, attrs, txt) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (txt != null) e.textContent = txt;
    return e;
  };
  [0, 15, 30, 45].forEach((v) => {
    svg.append(mk('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#C6CAC1' }));
    svg.append(mk('text', { x: 0, y: y(v) + 4, 'font-family': 'IBM Plex Mono, monospace',
      'font-size': 10, fill: '#5C6360' }, v + ' %'));
  });
  [0, 12, 24, 36].forEach((m) => svg.append(mk('text', { x: x(m), y: H - 6,
    'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: '#5C6360',
    'text-anchor': m === 0 ? 'start' : m === months ? 'end' : 'middle' },
    m ? '+' + m + ' M' : 'heute')));

  const show = ['SEMI', 'KERN', 'PHYS', 'INFRA'];
  show.forEach((k) => {
    const c = CLUSTERS[k];
    const d = series.map((r, i) => `${i ? 'L' : 'M'}${x(r.month).toFixed(1)} ${y(Math.min(r[k], maxY)).toFixed(1)}`).join(' ');
    svg.append(mk('path', { d, fill: 'none', stroke: c.color, 'stroke-width': 2.2 }));
    const end = series[series.length - 1][k];
    svg.append(mk('text', { x: W - R + 6, y: y(Math.min(end, maxY)) + 4,
      'font-family': 'IBM Plex Mono, monospace', 'font-size': 10, fill: c.color,
      'font-weight': 600 }, `${num(end, 0)} % ${c.label.split(' ')[0]}`));
  });
  return svg;
}
