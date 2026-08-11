/** Datentypen, die Datenbank, Kennzahlen und Ansichten teilen. */

export interface Position {
  id: string;
  portfolio_id: string;
  name: string;
  ticker: string | null;
  isin: string | null;
  quantity: number | null;
  value: number;
  currency: string;
  cluster: string | null;
  type: string | null;
  source: 'manual' | 'photo' | 'csv';
}

export type PlanInterval = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export interface SavingsPlan {
  id: string;
  portfolio_id: string;
  name: string;
  amount: number;
  interval: PlanInterval;
  cluster: string | null;
  /** Auf den Monat normierter Betrag. Wird beim Schreiben berechnet, nicht getippt. */
  monthly: number;
}

export interface Snapshot {
  id: string;
  portfolio_id: string;
  date: string;
  value: number;
  note: string | null;
}

export interface Portfolio {
  id: string;
  name: string;
  broker: string | null;
  as_of: string | null;
}

/** Cluster-Definition, pro Nutzer in der Datenbank editierbar. */
export interface ClusterDef {
  key: string;
  label: string;
  color: string;
  /** Zielanteil in Prozent. */
  target: number;
  /** Genau ein Cluster ist der Kern, gegen den die Mindestquote prüft. */
  is_core: boolean;
  sort_order: number;
}

/** Ein Cluster mit den aufsummierten Werten des Depots. */
export interface ClusterBucket extends ClusterDef {
  value: number;
  pct: number;
  count: number;
}

/** Regelwerk, pro Nutzer editierbar. Alle Werte in Prozent, außer maxPositions. */
export interface Rules {
  maxSinglePosition: number;
  maxCluster: number;
  minCore: number;
  maxPositions: number;
  minPositionSize: number;
}

export type FindingLevel = 'hoch' | 'mittel' | 'niedrig';

export interface Finding {
  level: FindingLevel;
  rule: string;
  text: string;
}

export interface Concentration {
  /** Herfindahl-Index über die Wertanteile. */
  hhi: number;
  /** Effektive Positionszahl, 1/hhi. */
  effective: number;
  top2: number;
  top5: number;
  top10: number;
}

/** Ein Punkt der Zuflussprojektion: Monat, Gesamtwert, Anteil je Cluster in Prozent. */
export interface ProjectionRow {
  month: number;
  total: number;
  shares: Record<string, number>;
}
