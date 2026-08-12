/**
 * Signalquellen und der Rechts-Schalter.
 *
 * Übernommen aus legacy/config.js. Die Notizen sind bewusst mitgewandert —
 * sie halten fest, warum eine Quelle aktiv oder aus ist.
 */

/**
 * WICHTIG — Rechts-Schalter. Siehe docs/RECHTLICHES.md.
 *
 * false: Signale werden als fremde, klar zugeordnete Daten angezeigt.
 *        Es findet KEINE Verknüpfung mit dem Depot des Nutzers statt.
 * true:  Signale würden auf das konkrete Depot bezogen ("weil du X hältst …").
 *        Das kann in Deutschland als Anlageberatung gelten und ist dann nach
 *        § 32 KWG bzw. § 15 WpIG erlaubnispflichtig. Nicht ohne anwaltliche
 *        Prüfung und BaFin-Erlaubnis einschalten.
 *
 * Aus demselben Grund lädt die Signalansicht ihre Daten selbst und teilt
 * keinen Zustand mit den Depotansichten. Das ist kein Zufall der Architektur,
 * sondern ihr Zweck.
 */
export const PERSONALIZED_ADVICE = false;

export type SourceTier = 'public' | 'licensed' | 'linkout';

export interface SourceDef {
  id: string;
  label: string;
  tier: SourceTier;
  enabled: boolean;
  note: string;
}

export const TIER_LABELS: Record<SourceTier, string> = {
  public: 'amtlich',
  licensed: 'lizenzpflichtig',
  linkout: 'nur Verlinkung',
};

export const SOURCES: SourceDef[] = [
  {
    id: 'sec-form4',
    label: 'SEC Form 4 — US-Insider',
    tier: 'public',
    enabled: true,
    note:
      'Vorstände und Großaktionäre müssen Käufe binnen zwei Handelstagen melden. ' +
      'Amtlich, gemeinfrei, deutlich frischer als Kongressdaten.',
  },
  {
    id: 'edgar-volltext',
    label: 'SEC Volltextsuche — Technologiebegriffe',
    tier: 'public',
    enabled: true,
    note:
      'Durchsucht den kompletten Fließtext aller Pflichtmitteilungen (8-K, S-1), nicht nur die ' +
      'Metadaten. Findet Unternehmen, die eine Technologie erstmals erwähnen — früher, als sie in ' +
      'Umsatzzahlen sichtbar wird. Beobachtete Begriffe stehen in scripts/fetch-signals.mjs. ' +
      'Eine Erwähnung sagt nichts über Umfang oder Bedeutung: sie ist ein Anlass zum Nachlesen.',
  },
  {
    id: 'arxiv',
    label: 'arXiv — Forschungs-Preprints',
    tier: 'public',
    enabled: true,
    note:
      'Dieselben Technologiebegriffe wie die Volltextsuche, nur eine Stufe früher: hier steht die ' +
      'Forschung, dort die Pflichtmitteilung. Preprints sind nicht begutachtet und haben keinen ' +
      'Bezug zu einem börsennotierten Unternehmen. Größter Vorlauf, höchste Fehlerquote — die ' +
      'allermeisten Arbeiten werden nie ein Produkt. Anstoß zum Lesen, kein Signal.',
  },
  {
    id: 'usaspending',
    label: 'USAspending — US-Staatsaufträge',
    tier: 'public',
    enabled: true,
    note:
      'Schließt die Lücke zwischen Forschung und Pflichtmitteilung: Ein Regierungsauftrag ist Geld, ' +
      'das fließt, bevor es in einer Quartalszahl steht — und die Leistungsbeschreibung nennt oft ' +
      'präzise, woran gearbeitet wird. Angezeigt wird der Vertragsbeginn, der weiter zurückliegen ' +
      'kann als die Änderung, über die der Auftrag in die Auswahl kam. Aufträge unter 25.000 USD ' +
      'werden ausgefiltert, sonst dominiert Verbrauchsmaterial die Liste. Auftragnehmer sind häufig ' +
      'nicht börsennotiert oder Tochtergesellschaften.',
  },
  {
    id: 'congress',
    label: 'US-Kongress — STOCK Act',
    tier: 'licensed',
    enabled: false,
    note:
      'Meldefrist 45 Tage — die Information ist beim Erscheinen alt. Rohquelle ' +
      'disclosures.house.gov und efdsearch.senate.gov sind gemeinfrei, aber PDF-Chaos. ' +
      'Ohne QUIVER_API_KEY wird der Abruf sauber übersprungen.',
  },
  {
    id: 'directors-dealings',
    label: 'Directors’ Dealings EU — Art. 19 MAR',
    tier: 'public',
    enabled: false,
    note:
      'Europäisches Gegenstück zu Form 4. Veröffentlichung über EQS/DGAP und ' +
      'Bundesanzeiger. Noch nicht angebunden.',
  },
  {
    id: 'form-13f',
    label: '13F — institutionelle Positionierung',
    tier: 'public',
    enabled: false,
    note:
      'Quartalsweise, 45 Tage Nachlauf. Zeigt, was große Fonds getan haben, nicht was ' +
      'sie sagen. Als Bestätigung brauchbar, als Auslöser zu langsam. Noch nicht angebunden.',
  },
  {
    id: 'aktionaer',
    label: 'Der Aktionär',
    tier: 'linkout',
    enabled: false,
    note:
      'RSS-Feed abgeschaltet — /rss, /feed und Varianten antworten mit 404, die Startseite ' +
      'nennt keinen Feed mehr. Deshalb deaktiviert. Kein Ersatz per Scraping: die Inhalte sind ' +
      'urheberrechtlich geschützt, und ohne Feed gibt es keine erkennbare Freigabe zur ' +
      'Weiterverbreitung.',
  },
];
