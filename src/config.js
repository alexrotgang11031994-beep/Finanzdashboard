/**
 * Zentrale Konfiguration.
 * Für White-Label-Auslieferung reicht es, diese Datei und die Farbvariablen
 * in styles.css anzupassen. Sonst muss nichts angefasst werden.
 */

export const BRAND = {
  name: 'Investmentstratege',
  tagline: 'Bestand, Sparpläne, Signale',
  operator: 'Hier Betreibername eintragen',
  contact: 'kontakt@example.com',
};

/**
 * WICHTIG — rechtlicher Schalter. Siehe docs/RECHTLICHES.md.
 *
 * false: Signale werden als fremde, klar zugeordnete Daten angezeigt.
 *        Es findet KEINE Verknüpfung mit dem Depot des Nutzers statt.
 * true:  Signale würden auf das konkrete Depot bezogen ("weil du X hältst …").
 *        Das kann in Deutschland als Anlageberatung gelten und ist dann nach
 *        § 32 KWG bzw. § 15 WpIG erlaubnispflichtig. Nicht ohne anwaltliche
 *        Prüfung und BaFin-Erlaubnis einschalten.
 */
export const PERSONALIZED_ADVICE = false;

/** Sprache der Zahlenformatierung. */
export const LOCALE = 'de-DE';
export const BASE_CURRENCY = 'EUR';

/** Cluster-Definitionen. Reihenfolge bestimmt die Darstellung. */
export const CLUSTERS = {
  SEMI:  { label: 'Halbleiter & KI-Chips',  color: '#A8391F', target: 24 },
  PHYS:  { label: 'Physical AI & Robotik',  color: '#C9752B', target: 12 },
  INFRA: { label: 'KI-Infrastruktur',       color: '#6E8C2F', target: 12 },
  SOFT:  { label: 'Software & Plattformen', color: '#2C4A6E', target: 12 },
  KERN:  { label: 'Breiter Markt',          color: '#0E7A6E', target: 20 },
  ROHS:  { label: 'Edelmetalle & Rohstoffe',color: '#8C7628', target:  9 },
  INDU:  { label: 'Industrie & Rüstung',    color: '#3D5A4C', target:  7 },
  DEFE:  { label: 'Defensiv',               color: '#6E6A62', target:  3 },
  SPEK:  { label: 'Spekulativ',             color: '#7A4E77', target:  1 },
};

/** Risikoregeln, gegen die das Depot geprüft wird. */
export const RULES = {
  maxSinglePosition: 8,   // Prozent des Depotwerts
  maxCluster:        25,
  minCore:           20,
  maxPositions:      25,
  minPositionSize:   1,
};

/**
 * Kursdaten. Ohne Schlüssel läuft das Dashboard auf den Snapshot-Werten
 * aus portfolio.json weiter — es bricht nichts, es ist nur nicht live.
 *
 * Anbietervergleich siehe docs/QUELLEN.md. Kurz:
 *   marketstack – beste Abdeckung außeramerikanischer Börsen, EOD, ab ~10 $/M
 *   eodhd       – gute globale Historie
 *   twelvedata  – 800 Anfragen/Tag frei, aber US-lastig
 *   finnhub     – 60 Anfragen/Minute frei, Deutsche Börse nur im Bezahltarif
 *
 * Der Schlüssel gehört NICHT hierher, wenn die Seite öffentlich ist.
 * Für den Produktivbetrieb: Kurse im GitHub-Workflow ziehen und als
 * prices.json committen, genau wie bei den Signalen.
 */
export const PRICES = {
  provider: 'none',          // 'none' | 'marketstack' | 'twelvedata' | 'static'
  apiKey: '',
  staticFile: 'src/data/prices.json',
};

/**
 * Signalquellen. Die Daten selbst holt scripts/fetch-signals.mjs
 * täglich per GitHub Action und legt sie in src/data/signals.json ab.
 *
 * tier: 'public'     – amtlich/gemeinfrei, kommerziell unbedenklich
 *       'licensed'   – kostenpflichtige API mit Nutzungsvertrag
 *       'linkout'    – urheberrechtlich geschützt, nur Überschrift + Link
 */
export const SOURCES = [
  {
    id: 'sec-form4',
    label: 'SEC Form 4 — US-Insider',
    tier: 'public',
    enabled: true,
    endpoint: 'https://data.sec.gov/submissions/',
    note: 'Vorstände und Großaktionäre müssen Käufe binnen zwei Handelstagen melden. '
        + 'Amtlich, gemeinfrei, deutlich frischer als Kongressdaten.',
  },
  {
    id: 'congress',
    label: 'US-Kongress — STOCK Act (Pelosi-Ticker)',
    tier: 'licensed',
    enabled: false,
    endpoint: 'https://api.quiverquant.com/beta/live/congresstrading',
    envKey: 'QUIVER_API_KEY',
    note: 'Meldefrist 45 Tage — die Information ist beim Erscheinen alt. '
        + 'Rohquelle disclosures.house.gov und efdsearch.senate.gov sind gemeinfrei, '
        + 'aber PDF-Chaos. House Stock Watcher ist seit Anfang 2026 tot (HTTP 403).',
  },
  {
    id: 'directors-dealings',
    label: 'Directors’ Dealings EU — Art. 19 MAR',
    tier: 'public',
    enabled: true,
    endpoint: '',
    note: 'Europäisches Gegenstück zu Form 4. Relevant für Rheinmetall, Siemens, '
        + 'SAP, Allianz, Telekom. Veröffentlichung über EQS/DGAP und Bundesanzeiger.',
  },
  {
    id: 'form-13f',
    label: '13F — institutionelle Positionierung',
    tier: 'public',
    enabled: true,
    endpoint: 'https://data.sec.gov/api/xbrl/',
    note: 'Quartalsweise, 45 Tage Nachlauf. Zeigt, was große Fonds getan haben, '
        + 'nicht was sie sagen. Als Bestätigung brauchbar, als Auslöser zu langsam.',
  },
  {
    id: 'haus-research',
    label: 'Marktkommentare großer Häuser',
    tier: 'linkout',
    enabled: true,
    feeds: [
      'https://www.blackrock.com/corporate/insights/blackrock-investment-institute',
      'https://www.goldmansachs.com/insights',
      'https://www.morganstanley.com/ideas',
    ],
    note: 'Öffentliche Marktkommentare sind verlinkbar. Die eigentlichen '
        + 'Analystenreports sind lizenzpflichtig und dürfen nicht weiterverbreitet werden.',
  },
  {
    id: 'aktionaer',
    label: 'Der Aktionär',
    tier: 'linkout',
    enabled: true,
    feeds: ['https://www.deraktionaer.de/rss'],
    note: 'Urheberrechtlich geschützt. Im kommerziellen Produkt ausschließlich '
        + 'Überschrift plus Link, niemals Volltext. Für mehr braucht es eine Lizenz.',
  },
];
