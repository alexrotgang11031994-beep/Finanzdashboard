import { BRAND, BASE_CURRENCY } from './config.js';
import { h, eur, date } from './lib/format.js';
import { loadPrices, revalue } from './lib/prices.js';
import { renderOverview } from './views/overview.js';
import { renderPositions } from './views/positions.js';
import { renderSavings } from './views/savings.js';
import { renderPerformance } from './views/performance.js';
import { renderSignals } from './views/signals.js';

const TABS = [
  ['uebersicht',  'Übersicht',  renderOverview],
  ['positionen',  'Positionen', renderPositions],
  ['sparplaene',  'Sparpläne',  renderSavings],
  ['entwicklung', 'Entwicklung',renderPerformance],
  ['signale',     'Signale',    renderSignals],
];

async function json(path, fallback) {
  try {
    const res = await fetch(new URL(path, import.meta.url));
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch { return fallback; }
}

async function boot() {
  const root = document.getElementById('app');
  root.replaceChildren(h('div', { class: 'loading' }, 'Daten werden geladen …'));

  const [portfolio, savings, snaps, signals] = await Promise.all([
    json('./data/portfolio.json', { positions: [], asOf: null }),
    json('./data/savingsplans.json', { plans: [] }),
    json('./data/snapshots.json', { snapshots: [] }),
    json('./data/signals.json', null),
  ]);

  const priceInfo = await loadPrices(portfolio.positions);
  const positions = revalue(portfolio.positions, priceInfo.quotes);
  const total = positions.reduce((s, p) => s + p.value, 0);

  const ctx = {
    positions, total,
    plans: savings.plans || [],
    seedSnapshots: snaps.snapshots || [],
    signals,
    asOf: portfolio.asOf,
    priceInfo,
  };

  root.replaceChildren(header(ctx), nav(ctx), h('main', { id: 'view' }), footer(ctx));
  route(ctx);
  window.addEventListener('hashchange', () => route(ctx));
}

function header(ctx) {
  const live = ctx.priceInfo.source === 'static' && !ctx.priceInfo.stale;
  return h('header', {},
    h('div', { class: 'eyebrow' }, BRAND.name.toUpperCase() + ' · ' + BRAND.tagline),
    h('div', { class: 'total' }, eur(ctx.total), h('span', {}, ' ' + BASE_CURRENCY)),
    h('div', { class: 'stamp' },
      h('span', { class: live ? 'dot live' : 'dot stale' }),
      live
        ? `Kurse vom ${date(ctx.priceInfo.asOf)}`
        : `Stand ${date(ctx.asOf)} — Snapshot-Werte, keine Live-Kurse`));
}

function nav(ctx) {
  const el = h('nav', {}, TABS.map(([id, label]) =>
    h('a', { href: '#' + id, 'data-tab': id }, label)));
  return el;
}

function route(ctx) {
  const id = (location.hash || '#uebersicht').slice(1);
  const tab = TABS.find((t) => t[0] === id) || TABS[0];
  document.querySelectorAll('nav a').forEach((a) =>
    a.classList.toggle('on', a.dataset.tab === tab[0]));
  const view = document.getElementById('view');
  view.replaceChildren(tab[2](ctx));
  view.focus?.();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function footer(ctx) {
  return h('footer', {},
    h('p', {}, h('b', {}, 'Keine Anlageberatung. '),
      'Dieses Dashboard stellt Bestandsdaten und fremde, gekennzeichnete Informationen dar. '
      + 'Es gibt keine Empfehlung zum Kauf oder Verkauf ab und berücksichtigt keine '
      + 'persönlichen Verhältnisse. Kapitalanlagen können zum Totalverlust führen. '
      + 'Vergangene Wertentwicklung sagt nichts über künftige Ergebnisse.'),
    h('p', { class: 'sm' }, `Betrieben von ${BRAND.operator} · ${BRAND.contact} · `,
      h('a', { href: 'docs/RECHTLICHES.md' }, 'Rechtliche Hinweise'), ' · ',
      h('a', { href: 'docs/QUELLEN.md' }, 'Quellen und Lizenzen')));
}

boot();
