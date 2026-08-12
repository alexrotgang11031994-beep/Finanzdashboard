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

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/data/signals.json');

/** Tickers, für die überhaupt gefiltert wird. Aus portfolio.json ableitbar. */
const WATCH = ['NVDA', 'TSM', 'AMZN', 'GOOGL', 'MSFT', 'AVGO', 'INTC', 'AMD', 'MU',
               'MRVL', 'ASML', 'TSLA', 'ISRG', 'CAT', 'D', 'PLTR', 'KO', 'AAPL'];

/**
 * Technologiebegriffe für die EDGAR-Volltextsuche.
 *
 * Hier anpassen, wenn sich der Beobachtungsschwerpunkt ändert — das ist der
 * einzige Ort dafür. Die Liste ist bewusst kurz gehalten: jeder Begriff kostet
 * eine Anfrage pro Lauf, und die SEC begrenzt auf rund zehn pro Sekunde.
 *
 * Auswahlkriterium ist Vorlauf, nicht Trefferzahl. Gesucht wird nach Begriffen,
 * die in einer Pflichtmitteilung auftauchen, *bevor* sie im Umsatz stehen —
 * ein 8-K, das erstmals von einer Technologie spricht, ist früher dran als
 * jede Quartalszahl. Zu allgemeine Begriffe ("technology", "innovation")
 * liefern nur Rauschen und gehören nicht in diese Liste.
 */
const TECH_TERMS = [
  'quantum computing',
  'humanoid robot',
  'solid-state battery',
  'small modular reactor',
  'gene editing',
  'photonic',
  'rare earth',
  'autonomous vehicle',
];

/** Nur Meldungen der letzten N Tage — ältere sind für Vorlaufsignale wertlos. */
const LOOKBACK_DAYS = 14;

/** Formulararten mit Neuigkeitswert. 8-K = meldepflichtiges Ereignis, S-1 = Börsengang. */
const FTS_FORMS = ['8-K', 'S-1'];

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
/* 3. EDGAR-Volltextsuche — Technologiebegriffe in Pflichtmitteilungen */
/* ------------------------------------------------------------------ */
/**
 * Durchsucht den kompletten Fließtext aller SEC-Einreichungen, nicht nur die
 * Metadaten. Damit findet man ein Unternehmen, das eine Technologie zum ersten
 * Mal in einer Pflichtmitteilung erwähnt — deutlich früher, als es in
 * Umsatzzahlen sichtbar wird.
 *
 * Der Endpunkt efts.sec.gov ist amtlich, gemeinfrei und ohne Schlüssel
 * nutzbar; er verlangt denselben aussagekräftigen User-Agent wie EDGAR selbst.
 */
async function edgarFullText() {
  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS * 86400 * 1000);
  const iso = (d) => d.toISOString().slice(0, 10);

  // Ein Treffer pro Einreichung reicht: dasselbe 8-K taucht sonst einmal je
  // Anlagedatei auf und verstopft die Liste mit Dubletten.
  const seen = new Set();

  for (const term of TECH_TERMS) {
    const url = 'https://efts.sec.gov/LATEST/search-index'
      + `?q=${encodeURIComponent(`"${term}"`)}`
      + `&forms=${FTS_FORMS.join(',')}`
      + `&dateRange=custom&startdt=${iso(from)}&enddt=${iso(to)}`;

    // efts.sec.gov antwortet sporadisch mit HTTP 500, auch auf Anfragen, die
    // Sekunden später einwandfrei durchlaufen — beobachtet bei zwei Läufen
    // hintereinander, jeweils bei einem anderen Begriff. Ein verzögerter
    // zweiter Versuch fängt das ab. Fehler bleiben zudem auf den einzelnen
    // Begriff begrenzt: vorher riss ein 500 die gesamte restliche Liste mit,
    // sodass ein Ausfall wie ein leeres Suchergebnis aussah.
    let data = null;
    for (let attempt = 0; attempt < 2 && data === null; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
      } catch (e) {
        if (attempt === 1) errors.push(`edgar-volltext "${term}": ${e.message}`);
      }
    }
    if (data === null) continue;

    for (const hit of data?.hits?.hits ?? []) {
      const s = hit._source ?? {};
      const adsh = s.adsh;
      if (!adsh || seen.has(adsh)) continue;
      seen.add(adsh);

      const cik = (s.ciks ?? [])[0];
      // display_names sieht aus wie "D-Wave Quantum Inc.  (QBTS)  (CIK 0001907982)"
      const display = (s.display_names ?? [])[0] ?? 'Unbekannter Einreicher';
      const company = display.split('  (')[0].trim();
      const ticker = /\(([A-Z.\-]{1,6})\)\s+\(CIK/.exec(display)?.[1] ?? null;

      items.push({
        source: 'SEC Volltextsuche',
        tier: 'public',
        ticker,
        title: `${s.form ?? 'Filing'} — ${company}: „${term}" erwähnt`,
        date: s.file_date ?? null,
        url: cik
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh.replace(/-/g, '')}/${adsh}-index.htm`
          : null,
        summary: `Der Begriff „${term}" kommt im Volltext dieser Pflichtmitteilung vor. `
               + 'Die Erwähnung sagt nichts über Umfang oder Bedeutung — sie ist ein '
               + 'Anlass zum Nachlesen, kein Befund.',
      });
    }

    // SEC-Vorgabe: höchstens rund zehn Anfragen pro Sekunde.
    await new Promise((r) => setTimeout(r, 200));
  }
}

/* ------------------------------------------------------------------ */
/* 4. arXiv — Forschung, die früheste Stufe mit dem meisten Rauschen    */
/* ------------------------------------------------------------------ */
/**
 * Sucht dieselben TECH_TERMS wie die EDGAR-Volltextsuche, nur eine Stufe
 * früher: hier steht die Forschung, dort die Pflichtmitteilung. Derselbe
 * Begriff in beiden Quellen ergibt zwei Zeitpunkte auf einer Kette —
 * Veröffentlichung der Idee und erste Erwähnung durch ein Unternehmen.
 *
 * Der Preis für diesen Vorlauf ist die Trefferquote: allein "quantum
 * computing" liefert über hundert Arbeiten in vierzehn Tagen, und die
 * allermeisten werden nie ein Produkt. Deshalb eine harte Obergrenze je
 * Begriff — diese Quelle soll anstoßen, nicht die Liste fluten.
 *
 * arXiv bittet in seinen Nutzungsbedingungen um drei Sekunden Abstand
 * zwischen Anfragen. Das wird hier eingehalten.
 */
const ARXIV_PER_TERM = 4;

async function arxiv() {
  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_DAYS * 86400 * 1000);
  const stamp = (d) => d.toISOString().slice(0, 10).replace(/-/g, '') + '0000';

  for (const term of TECH_TERMS) {
    const query = `all:"${term}" AND submittedDate:[${stamp(from)} TO ${stamp(to)}]`;
    const url = 'http://export.arxiv.org/api/query'
      + `?search_query=${encodeURIComponent(query)}`
      + `&sortBy=submittedDate&sortOrder=descending&max_results=${ARXIV_PER_TERM}`;

    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();

      for (const entry of xml.split('<entry>').slice(1)) {
        const title = decode(pick(entry, 'title')).replace(/\s+/g, ' ').trim();
        const link = pick(entry, 'id');
        const published = pick(entry, 'published');
        if (!title) continue;

        const authors = [...entry.matchAll(/<name>(.*?)<\/name>/g)].map((m) => decode(m[1]));
        const shown = authors.slice(0, 3).join(', ')
          + (authors.length > 3 ? ` u. a. (${authors.length})` : '');

        items.push({
          source: 'arXiv',
          tier: 'public',
          title: `${title} — „${term}"`,
          url: link,
          date: (published || '').slice(0, 10),
          summary: `Preprint von ${shown}. Nicht begutachtet und ohne Bezug zu einem `
                 + 'börsennotierten Unternehmen. Früheste Stufe der Kette: die meisten '
                 + 'Arbeiten werden nie ein Produkt.',
        });
      }
    } catch (e) {
      errors.push(`arxiv "${term}": ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 3000));
  }
}

/* ------------------------------------------------------------------ */
/* 5. USAspending — Staatsaufträge, die Stufe zwischen Idee und Bilanz  */
/* ------------------------------------------------------------------ */
/**
 * Schließt die Lücke zwischen arXiv (Forschung) und EDGAR (Pflichtmitteilung):
 * Ein Regierungsauftrag ist Geld, das bereits fließt, aber noch lange nicht in
 * einer Quartalszahl steht. Die Beschreibung nennt dabei oft präzise, woran
 * gearbeitet wird — deutlich konkreter als eine Pressemitteilung.
 *
 * Zwei Eigenheiten, die den Zuschnitt bestimmen:
 *
 * 1. Aufträge zu einem Fachbegriff sind selten. Ein Dreimonatsfenster lieferte
 *    im Test null Treffer, zwölf Monate liefern brauchbar viele. Diese Quelle
 *    ist deshalb bewusst träger eingestellt als die übrigen.
 * 2. Der Zeitfilter greift auf das Änderungsdatum, angezeigt wird aber der
 *    Vertragsbeginn — der liegt regelmäßig weiter zurück. Die Einträge sinken
 *    dadurch ans Ende der nach Datum sortierten Liste. Das ist richtig so:
 *    der Vertrag ist tatsächlich älter, nur die Änderung ist frisch.
 *
 * Nur Aufträge (award_type_codes A–D), keine Fördermittel: Zuwendungen gehen
 * überwiegend an Hochschulen und sagen wenig über Unternehmen.
 */
const USASPENDING_PER_TERM = 3;
const USASPENDING_LOOKBACK_DAYS = 365;

/**
 * Mindestauftragswert in USD.
 *
 * Ohne ihn dominiert Verbrauchsmaterial die Liste: Der Test lieferte für
 * „rare earth" ein Whiteboard für 1.144 USD und einen Hebemagneten für
 * 2.139 USD — die Begriffe stecken im Produktnamen, nicht in einer
 * Technologie. Ein Filter auf das Vorkommen im Beschreibungstext hilft
 * dagegen nicht: Er würde genau diese Fehltreffer durchlassen und
 * umgekehrt echte streichen, bei denen der Begriff im Firmennamen steht
 * (IPG Photonics, AdValue Photonics) statt in der Leistungsbeschreibung.
 * Die Auftragshöhe trennt beides zuverlässig.
 *
 * Die Schwelle ist bewusst niedrig: Sie soll Bürobedarf aussortieren, nicht
 * kleine Aufträge an junge Technologiefirmen — die sind für Vorlaufsignale
 * gerade die interessanten.
 */
const USASPENDING_MIN_USD = 25_000;

async function usaSpending() {
  const to = new Date();
  const from = new Date(to.getTime() - USASPENDING_LOOKBACK_DAYS * 86400 * 1000);
  const iso = (d) => d.toISOString().slice(0, 10);

  for (const term of TECH_TERMS) {
    const body = {
      filters: {
        keywords: [term],
        time_period: [{ start_date: iso(from), end_date: iso(to) }],
        award_type_codes: ['A', 'B', 'C', 'D'],
      },
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date', 'Description'],
      page: 1,
      limit: USASPENDING_PER_TERM,
      sort: 'Start Date',
      order: 'desc',
      subawards: false,
    };

    try {
      const res = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      for (const row of data?.results ?? []) {
        const recipient = row['Recipient Name'] ?? 'Unbekannter Auftragnehmer';
        const amount = Number(row['Award Amount']) || 0;
        if (amount < USASPENDING_MIN_USD) continue;
        const agency = row['Awarding Agency'] ?? 'unbekannte Behörde';
        const euroish = amount.toLocaleString('de-DE', { maximumFractionDigits: 0 });
        // Auftragsbeschreibungen stehen in Großbuchstaben und sind oft sehr lang.
        const desc = String(row['Description'] ?? '').trim();
        const shortDesc = desc.length > 220 ? `${desc.slice(0, 220)}…` : desc;

        items.push({
          source: 'USAspending',
          tier: 'public',
          title: `${recipient}: ${euroish} USD von ${agency} — „${term}"`,
          url: row.generated_internal_id
            ? `https://www.usaspending.gov/award/${encodeURIComponent(row.generated_internal_id)}`
            : 'https://www.usaspending.gov/search',
          date: row['Start Date'] ?? null,
          summary: (shortDesc ? `Leistungsbeschreibung: ${shortDesc} ` : '')
                 + 'Angegeben ist der Vertragsbeginn; in die Auswahl kam der Auftrag über eine '
                 + 'Änderung im letzten Jahr. Auftragnehmer sind häufig nicht börsennotiert '
                 + 'oder Tochtergesellschaften.',
        });
      }
    } catch (e) {
      errors.push(`usaspending "${term}": ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 400));
  }
}

/* ------------------------------------------------------------------ */
/* 6. GitHub — wohin sich Entwickleraufmerksamkeit bewegt              */
/* ------------------------------------------------------------------ */
/**
 * Neue Projekte, die in kurzer Zeit viele Sterne sammeln, zeigen, welche
 * Technologie gerade Entwickler anzieht. Das ist kein Umsatz, aber es geht
 * ihm regelmäßig voraus: Werkzeuge entstehen, bevor Produkte damit gebaut
 * werden.
 *
 * Diese Quelle hat eine eigene, kürzere Begriffsliste — und zwar aus einem
 * inhaltlichen Grund, nicht aus Bequemlichkeit: GitHub kennt nur Software.
 * Der Test mit der vollen TECH_TERMS-Liste ergab für "quantum computing"
 * 1.185 Projekte (Spitzenreiter 65 Sterne) und für "humanoid robot" 451
 * (331 Sterne), aber für "solid-state battery" ganze zehn Projekte mit
 * höchstens zwei Sternen. Physische Technologien hinterlassen hier keine
 * belastbare Spur; sie mitzusuchen erzeugt nur Rauschen und verbraucht
 * Anfragen.
 *
 * Zum Rate-Limit: Ohne Anmeldung erlaubt die Suche rund zehn Anfragen pro
 * Minute, und der Test lief bereits nach vier Anfragen trotz sieben Sekunden
 * Abstand in HTTP 403. In GitHub Actions steht GITHUB_TOKEN automatisch und
 * kostenlos bereit und hebt das Limit auf dreißig — lokal läuft es ohne
 * Token, dann aber mit spürbar größerem Abstand.
 */
const GITHUB_TERMS = ['quantum computing', 'humanoid robot', 'autonomous vehicle'];

/** Unter dieser Sternzahl ist ein junges Projekt statistisch nicht von Zufall zu trennen. */
const GITHUB_MIN_STARS = 25;
const GITHUB_PER_TERM = 3;
const GITHUB_LOOKBACK_DAYS = 90;

async function github() {
  const token = process.env.GITHUB_TOKEN;
  const pause = token ? 2500 : 8000;
  const since = new Date(Date.now() - GITHUB_LOOKBACK_DAYS * 86400 * 1000)
    .toISOString().slice(0, 10);

  const headers = {
    'User-Agent': UA,
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  for (const term of GITHUB_TERMS) {
    const url = 'https://api.github.com/search/repositories'
      + `?q=${encodeURIComponent(`"${term}" created:>${since}`)}`
      + `&sort=stars&order=desc&per_page=${GITHUB_PER_TERM}`;

    try {
      const res = await fetch(url, { headers });
      if (res.status === 403 || res.status === 429) {
        throw new Error(`Rate-Limit (HTTP ${res.status})`
          + (token ? '' : ' — ohne GITHUB_TOKEN nur rund zehn Anfragen pro Minute'));
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      for (const repo of data?.items ?? []) {
        const stars = repo.stargazers_count ?? 0;
        if (stars < GITHUB_MIN_STARS) continue;

        items.push({
          source: 'GitHub',
          tier: 'public',
          title: `${repo.full_name} — ${stars} Sterne seit ${String(repo.created_at).slice(0, 10)} („${term}")`,
          url: repo.html_url,
          date: String(repo.created_at ?? '').slice(0, 10),
          summary: (repo.description ? `${String(repo.description).slice(0, 200)} ` : '')
                 + 'Entwickleraufmerksamkeit, kein Umsatz. Ein Projekt kann von einem '
                 + 'Unternehmen, einer Hochschule oder einer Einzelperson stammen — die '
                 + 'Sternzahl sagt darüber nichts.',
        });
      }
    } catch (e) {
      errors.push(`github "${term}": ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, pause));
  }
}

/* ------------------------------------------------------------------ */
/* 7. Presse-Feeds — ausschließlich Überschrift und Link               */
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

/* ------------------------------------------------------------------ */
/* Monatsarchiv — so klein wie möglich                                  */
/* ------------------------------------------------------------------ */
/**
 * Schreibt je Monat eine Datei mit Datum, Quelle, Titel und Link. Kurze
 * Schlüssel (d/s/t/u) statt sprechender Namen, keine Zusammenfassungen, keine
 * Einrückung: Die Zusammenfassung steht ohnehin in der Hauptdatei und ist der
 * mit Abstand größte Teil eines Eintrags.
 *
 * Grund für die Trennung: signals.json wird bei jedem Lauf neu geschrieben und
 * bleibt dadurch klein. Das Archiv wächst, aber nur um das Nötigste — und weil
 * jeder Lauf committet wird, ist es zugleich der Nachweis, was wann angezeigt
 * wurde (Aufzeichnungspflicht, siehe docs/RECHTLICHES.md).
 */
/**
 * Vom Archiv ausgenommen. Form 4 liefert die zuletzt bei der SEC eingegangenen
 * Meldungen quer über alle US-Unternehmen — bei jedem Lauf vierzig andere.
 * Über einen Monat wären das rund achthundert Einträge ohne thematischen Bezug,
 * die alles Übrige erdrücken würden.
 *
 * Das kostet keinen Nachweis: Der Workflow committet bei jedem Lauf die
 * vollständige signals.json, damit ist die Git-Historie das lückenlose,
 * zeitgestempelte Archiv (siehe docs/RECHTLICHES.md). Diese Dateien hier sind
 * die lesbare Zusammenfassung obendrauf, nicht der Nachweis selbst.
 */
const ARCHIVE_EXCLUDED_SOURCES = new Set(['SEC Form 4']);

async function writeMonthlyArchive() {
  const byMonth = new Map();
  for (const i of items) {
    if (ARCHIVE_EXCLUDED_SOURCES.has(i.source)) continue;
    const month = String(i.date || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push({ d: i.date, s: i.source, t: i.title, u: i.url || null });
  }

  for (const [month, fresh] of byMonth) {
    const file = resolve(HERE, `../public/data/archive/${month}.json`);
    let existing = [];
    try {
      existing = JSON.parse(await readFile(file, 'utf8'));
    } catch { /* Monat noch nicht angelegt */ }

    // Über den Link entdoppeln: derselbe Eintrag taucht bei täglichen Läufen
    // sonst so oft auf, wie er im Rückschaufenster liegt.
    const seen = new Set(existing.map((e) => e.u || e.t));
    const merged = existing.concat(fresh.filter((e) => !seen.has(e.u || e.t)));
    merged.sort((a, b) => String(b.d).localeCompare(String(a.d)));

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(merged), 'utf8');
    console.log(`Archiv ${month}: ${merged.length} Eintraege (${fresh.length} geprueft)`);
  }
}

/* ------------------------------------------------------------------ */
/* Reifegrad je Technologiebegriff                                      */
/* ------------------------------------------------------------------ */
/**
 * Zählt, in wie vielen der fünf Stufen ein Begriff auftaucht, und wie frisch
 * der jüngste Beleg je Stufe ist. Die Stufen sind nach Vorlauf geordnet:
 * Forschung → Entwickler → Staatsauftrag → Pflichtmitteilung → Insider.
 *
 * Was das ist: eine Auszählung. Ein Begriff, der in vier Stufen auftaucht, ist
 * breiter belegt als einer in einer — mehr sagt die Zahl nicht.
 *
 * Was das ausdrücklich nicht ist: eine Kursprognose. Die Literatur zu genau
 * diesen Signalarten ist ernüchternd konkret. Für Ankündigungen von
 * Staatsaufträgen messen Ereignisstudien Überrenditen von 0,4 bis 0,7 Prozent,
 * teils ohne statistische Signifikanz. Patentbasierte Kennzahlen wirken laut
 * mehreren Arbeiten länger, bis etwa zwölf Monate. Beides sind kleine Effekte
 * im Mittel über viele Fälle — daraus lässt sich für einen Einzelwert nichts
 * ableiten. Deshalb liefert diese Funktion Belegdichte, keine Erwartung.
 */
const STAGES = [
  ['arXiv', 'Forschung'],
  ['GitHub', 'Entwickler'],
  ['USAspending', 'Staatsauftrag'],
  ['SEC Volltextsuche', 'Pflichtmitteilung'],
];

function buildTermAnalysis() {
  const out = [];

  for (const term of TECH_TERMS) {
    const needle = term.toLowerCase();
    const stages = [];

    for (const [source, label] of STAGES) {
      const hits = items.filter(
        (i) => i.source === source && String(i.title).toLowerCase().includes(needle),
      );
      if (!hits.length) continue;
      const newest = hits
        .map((h) => h.date)
        .filter(Boolean)
        .sort((a, b) => String(b).localeCompare(String(a)))[0] ?? null;
      stages.push({ stage: label, count: hits.length, newest });
    }

    out.push({
      term,
      stageCount: stages.length,
      totalStages: STAGES.length,
      stages,
    });
  }

  // Nach Belegbreite sortieren, bei Gleichstand nach Trefferzahl.
  out.sort((a, b) => b.stageCount - a.stageCount
    || b.stages.reduce((s, x) => s + x.count, 0) - a.stages.reduce((s, x) => s + x.count, 0));
  return out;
}

async function main() {
  await safe('sec-form4', secForm4);
  await safe('edgar-volltext', edgarFullText);
  await safe('arxiv', arxiv);
  await safe('usaspending', usaSpending);
  await safe('github', github);
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
    analysis: buildTermAnalysis(),
    // Grenze so gewählt, dass keine Quelle eine andere verdrängt: Form 4 (40)
    // plus Volltextsuche (~80) plus arXiv (max. 32) passen zusammen hinein.
    // Bei mehr Begriffen mitwachsen lassen, sonst fällt still die letzte
    // Quelle heraus — sortiert wird nach Datum, nicht nach Wichtigkeit.
    items: items.slice(0, 200),
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 1), 'utf8');
  console.log(`${payload.items.length} Eintraege geschrieben nach ${OUT}`);

  await writeMonthlyArchive();

  if (errors.length) console.warn('Warnungen:\n  ' + errors.join('\n  '));
}

main().catch((e) => { console.error(e); process.exit(1); });
