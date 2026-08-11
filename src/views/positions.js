import { h, eur, num } from '../lib/format.js';
import { CLUSTERS } from '../config.js';

let activeFilter = null;

export function renderPositions(ctx) {
  const { positions, total } = ctx;
  const max = Math.max(...positions.map((p) => p.value));
  const wrap = h('div', {});

  const chips = h('div', { class: 'filterchips' },
    h('button', { class: 'fc' + (activeFilter ? '' : ' on'), type: 'button',
      onclick: () => { activeFilter = null; redraw(); } }, 'Alle'),
    Object.entries(CLUSTERS).map(([k, c]) =>
      h('button', { class: 'fc' + (activeFilter === k ? ' on' : ''), type: 'button',
        onclick: () => { activeFilter = activeFilter === k ? null : k; redraw(); } },
        h('i', { style: `background:${c.color}` }), c.label)));

  const body = h('div', {});

  function redraw() {
    chips.querySelectorAll('.fc').forEach((b, i) => {
      const key = i === 0 ? null : Object.keys(CLUSTERS)[i - 1];
      b.classList.toggle('on', key === activeFilter);
    });
    body.replaceChildren(table());
  }

  function table() {
    const rows = positions
      .filter((p) => !activeFilter || p.cluster === activeFilter)
      .sort((a, b) => b.value - a.value);
    const sum = rows.reduce((s, p) => s + p.value, 0);
    return h('div', {},
      h('p', { class: 'sm' }, `${rows.length} Positionen · ${eur(sum)} · `
        + `${num((sum / total) * 100, 1)} % des Depots`),
      h('div', { class: 'tblwrap' },
        h('table', {},
          h('thead', {}, h('tr', {},
            h('th', { class: 'l' }, 'Position'),
            h('th', { class: 'l' }, 'Cluster'),
            h('th', { class: 'l' }, 'Typ'),
            h('th', {}, 'Wert'),
            h('th', {}, 'Anteil'),
            h('th', { class: 'l', style: 'width:20%' }, ''))),
          h('tbody', {}, rows.map((p) => {
            const c = CLUSTERS[p.cluster] || { label: '–', color: '#999' };
            const share = (p.value / total) * 100;
            return h('tr', {},
              h('td', { class: 'l' },
                h('i', { class: 'chip', style: `background:${c.color}` }), p.name,
                p.isin ? h('small', {}, p.isin) : null),
              h('td', { class: 'l mono-s' }, c.label),
              h('td', { class: 'l mono-s' }, p.type),
              h('td', { class: 'n' }, eur(p.value, p.value < 1000 ? 2 : 0)),
              h('td', { class: 'n' }, num(share, 2) + ' %'),
              h('td', { class: 'l' },
                h('div', { class: 'dbar' },
                  h('i', { style: `background:${c.color};width:${(p.value / max) * 100}%` }))));
          })))));
  }

  redraw();
  wrap.append(h('h2', {}, 'Alle Positionen'), chips, body);
  return wrap;
}
