import { LOCALE, BASE_CURRENCY } from '../config.js';

export const eur = (v, d = 0) =>
  new Intl.NumberFormat(LOCALE, { style: 'currency', currency: BASE_CURRENCY,
    minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export const num = (v, d = 0) =>
  new Intl.NumberFormat(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

export const pct = (v, d = 1) => num(v, d) + ' %';

export const signed = (v, d = 1) => (v > 0 ? '+' : '') + num(v, d);

export const date = (iso) =>
  new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(iso));

/** Erzeugt einen Textknoten - verhindert versehentliches HTML-Einschleusen. */
export const text = (s) => document.createTextNode(String(s ?? ''));

/** Kleines Hilfsmittel zum Elementbauen ohne innerHTML. */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid instanceof Node ? kid : text(kid));
  }
  return el;
}
