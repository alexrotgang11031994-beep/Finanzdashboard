#!/usr/bin/env node
/**
 * Holt Signale und schreibt public/data/signals.json.
 *
 * Läuft in GitHub Actions, nicht im Browser. Das löst drei Probleme auf einmal:
 *   1. Kein CORS — der Server darf holen, was der Browser nicht darf.
 *   2. Keine Schlüssel im Frontend — Secrets bleiben in der Action.
 *   3. Kein Backend nötig — die Seite bleibt statisch und kostenlos.
 *
 * Aufruf lokal:  SEC_USER_AGENT="Name mail@example.com" node scripts/fetch-signals.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/data/signals.json');

/** Tickers, für die überhaupt gefiltert wird. Aus portfolio.json ableitbar. */
const WATCH = ['NVDA', 'TSM', 'AMZN', 'GOOGL', 'MSFT', 'AVGO', 'INTC', 'AMD', 'MU',
               'MRVL', 'ASML', 'TSLA', 'ISRG', 'CAT', 'D', 'PLTR', 'KO', 'AAPL'];

const UA = process.env.SEC_USER_AGENT
  || 'Investmentstratege Kontakt bitte-in-env-setzen@example.com';

const items = [];
const errors = [];

/* ------------------------------------------------------------------ */
/* 1. SEC Form 4 — US-Insidergeschäfte, amtlich und gemeinfrei         */
/* ------------------------------------------------------------------ */
async function secForm4() {
  // Die SEC verlangt einen aussagekräftigen User-Agent mit Kontaktadresse
  // und begrenzt auf ~10 Anfragen pro Sekunde. Beides wird hier eingehalten.
  //
  // action=getcurrent liefert die zuletzt eingegangenen Meldungen; getcompany
  // braucht eine konkrete Firma und gab ohne sie stillschweigend null Einträge
  // zurück. owner=only ist ebenfalls nötig: mit owner=include ignoriert EDGAR
  // den type-Filter und liefert querbeet alle Formulararten (424B2 & Co.).
  const url = 'https://www.sec.gov/cgi-bin/browse-edgar'
    + '?action=getcurrent&type=4&owner=only&count=40&output=atom';
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`SEC HTTP ${res.status}`);
  const xml = await res.text();
  for (const entry of xml.split('<entry>').slice(1)) {
    const title = pick(entry, 'title');
    const link = /href="([^"]+)"/.exec(entry)?.[1];
    const updated = pick(entry, 'updated');
    if (!title) continue;
    items.push({
      source: 'SEC Form 4',
      tier: 'public',
      title: decode(title),
      url: link,
      date: (updated || '').slice(0, 10),
      summary: 'Meldepflichtiges Geschäft eines Unternehmensinsiders. '
             + 'Frist: zwei Handelstage.',
    });
  }
}

/* ------------------------------------------------------------------ */
/* 2. US-Kongress — nur wenn ein API-Schlüssel hinterlegt ist          */
/* ------------------------------------------------------------------ */
async function congress() {
  const key = process.env.QUIVER_API_KEY;
  if (!key) { errors.push('congress: kein QUIVER_API_KEY gesetzt, übersprungen'); return; }
  const res = await fetch('https://api.quiverquant.com/beta/live/congresstrading', {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Quiver HTTP ${res.status}`);
  const rows = await res.json();
  for (const r of rows.slice(0, 60)) {
    if (WATCH.length && !WATCH.includes(r.Ticker)) continue;
    items.push({
      source: 'US-Kongress (STOCK Act)',
      tier: 'licensed',
      ticker: r.Ticker,
      title: `${r.Representative}: ${r.Transaction} ${r.Ticker} (${r.Range})`,
      date: r.TransactionDate,
      summary: `Gemeldet am ${r.ReportDate}. Zwischen Geschäft und Meldung liegen `
             + 'bis zu 45 Tage — die Information ist beim Erscheinen bereits alt.',
      url: 'https://www.quiverquant.com/congresstrading/',
    });
  }
}

/* ------------------------------------------------------------------ */
/* 3. Presse-Feeds — ausschließlich Überschrift und Link               */
/* ------------------------------------------------------------------ */
async function rss(sourceLabel, feedUrl, limit = 12) {
  const res = await fetch(feedUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${sourceLabel} HTTP ${res.status}`);
  const xml = await res.text();
  const blocks = xml.split(/<item[\s>]/).slice(1);
  for (const b of blocks.slice(0, limit)) {
    const title = decode(pick(b, 'title'));
    const link = decode(pick(b, 'link'));
    const pub = pick(b, 'pubDate');
    if (!title) continue;
    items.push({
      source: sourceLabel,
      tier: 'linkout',
      title,
      url: link,
      date: pub ? new Date(pub).toISOString().slice(0, 10) : null,
      // Bewusst KEINE Zusammenfassung und KEIN Volltext:
      // fremde redaktionelle Inhalte werden verlinkt, nicht wiedergegeben.
    });
  }
}

/* ------------------------------------------------------------------ */

function pick(block, tag) {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block);
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
}
function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

async function safe(name, fn) {
  try { await fn(); }
  catch (e) { errors.push(`${name}: ${e.message}`); }
}

async function main() {
  await safe('sec-form4', secForm4);
  await safe('congress', congress);
  // Der Aktionär: deraktionaer.de hat den RSS-Feed abgeschaltet — /rss, /feed,
  // /rss.xml und Varianten liefern alle 404, und die Startseite enthält kein
  // <link rel="alternate" type="application/rss+xml"> mehr. Der Abruf ist
  // deshalb deaktiviert statt bei jedem Lauf zu scheitern. Kein Ersatz per
  // Scraping: der Inhalt ist urheberrechtlich geschützt, und ohne Feed gibt es
  // keine erkennbare Freigabe zur Weiterverbreitung (siehe docs/QUELLEN.md).
  errors.push('aktionaer: RSS-Feed von deraktionaer.de abgeschaltet, Quelle deaktiviert');
  // Weitere Feeds hier ergänzen. Vor jedem neuen Feed die Nutzungsbedingungen prüfen.

  items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const payload = {
    generatedAt: new Date().toISOString(),
    disclaimer: 'Fremde Inhalte, unveraendert wiedergegeben mit Quelle und Datum. '
              + 'Keine Anlageberatung, keine eigene Empfehlung des Betreibers.',
    errors,
    items: items.slice(0, 120),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 1), 'utf8');
  console.log(`${payload.items.length} Eintraege geschrieben nach ${OUT}`);
  if (errors.length) console.warn('Warnungen:\n  ' + errors.join('\n  '));
}

main().catch((e) => { console.error(e); process.exit(1); });
