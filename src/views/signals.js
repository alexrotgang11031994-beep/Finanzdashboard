import { h, date } from '../lib/format.js';
import { SOURCES, PERSONALIZED_ADVICE } from '../config.js';

const TIER = {
  public:   { label: 'amtlich', cls: 'tp' },
  licensed: { label: 'lizenzpflichtig', cls: 'tl' },
  linkout:  { label: 'nur Verlinkung', cls: 'to' },
};

export function renderSignals(ctx) {
  const feed = ctx.signals?.items || [];
  const generated = ctx.signals?.generatedAt;

  return h('div', {},
    h('h2', {}, 'Signale'),

    h('div', { class: 'notice' },
      h('b', {}, 'Fremde Daten, nicht meine Meinung. '),
      'Was hier steht, stammt von den unten genannten Dritten und wird unverändert '
      + 'mit Quelle und Datum angezeigt. Es findet keine Verknüpfung mit deinem Depot '
      + 'statt und es wird nichts daraus abgeleitet. '
      + (PERSONALIZED_ADVICE
          ? 'Achtung: PERSONALIZED_ADVICE steht auf true. Siehe docs/RECHTLICHES.md.'
          : 'Warum diese Trennung wichtig ist, steht in docs/RECHTLICHES.md.')),

    generated
      ? h('p', { class: 'sm' }, `Zuletzt abgerufen: ${date(generated)}. `
          + 'Aktualisierung läuft werktäglich über GitHub Actions.')
      : h('div', { class: 'empty' },
          h('b', {}, 'Noch keine Signale abgerufen.'),
          h('p', {}, 'Der Workflow .github/workflows/signals.yml füllt src/data/signals.json. '
            + 'Bis dahin bleibt diese Ansicht leer — es werden keine Beispieldaten '
            + 'vorgetäuscht, weil das in einem Finanzprodukt der gefährlichste Platzhalter wäre.')),

    feed.length ? h('div', { class: 'feed' }, feed.map(item)) : null,

    h('h2', { style: 'margin-top:42px' }, 'Quellen'),
    h('p', { class: 'sm' }, 'Jede Quelle mit ihrem rechtlichen Status. '
      + 'Ausführlich in docs/QUELLEN.md.'),
    h('div', { class: 'srclist' }, SOURCES.map(source)));
}

function item(it) {
  return h('article', { class: 'sig' },
    h('div', { class: 'sig-meta' },
      h('span', { class: 'sig-src' }, it.source || 'unbekannt'),
      it.date ? h('span', {}, date(it.date)) : null,
      it.ticker ? h('span', { class: 'sig-tick' }, it.ticker) : null),
    h('div', { class: 'sig-title' },
      it.url
        ? h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer' }, it.title)
        : it.title),
    it.summary ? h('p', { class: 'sig-sum' }, it.summary) : null);
}

function source(s) {
  const t = TIER[s.tier] || TIER.public;
  return h('div', { class: 'src' },
    h('div', { class: 'src-h' },
      h('b', {}, s.label),
      h('span', { class: 'tier ' + t.cls }, t.label),
      h('span', { class: 'state' }, s.enabled ? 'aktiv' : 'aus')),
    h('p', { class: 'sm' }, s.note));
}
