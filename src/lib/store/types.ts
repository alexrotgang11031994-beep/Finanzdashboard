import type {
  ClusterDef,
  Portfolio,
  Position,
  Rules,
  SavingsPlan,
  Snapshot,
} from '../types';

/** Alles, was eine Ansicht braucht — in einem Rutsch geladen. */
export interface PortfolioData {
  portfolio: Portfolio | null;
  positions: Position[];
  plans: SavingsPlan[];
  snapshots: Snapshot[];
  clusters: ClusterDef[];
  rules: Rules;
  total: number;
}

export type PositionInput = Omit<Position, 'id' | 'portfolio_id'>;
export type PlanInput = Omit<SavingsPlan, 'id' | 'portfolio_id' | 'monthly'>;
export type SnapshotInput = Omit<Snapshot, 'id' | 'portfolio_id'>;

/** Format des JSON-Exports. Version erlaubt spätere Migrationen beim Import. */
export interface ExportBundle {
  version: 1;
  exportedAt: string;
  portfolio: Portfolio | null;
  positions: Position[];
  plans: SavingsPlan[];
  snapshots: Snapshot[];
  clusters: ClusterDef[];
  rules: Rules;
}

/**
 * Die eine Schnittstelle, hinter der beide Speicherarten liegen.
 *
 * 'local'    — IndexedDB im Browser, kein Konto nötig, Daten verlassen das Gerät nicht.
 * 'supabase' — Postgres mit Anmeldung und Mandantentrennung.
 *
 * Alles ist async, auch lokal. Damit ist der Wechsel zwischen beiden
 * Implementierungen für die Ansichten unsichtbar.
 */
export interface Store {
  readonly kind: 'local' | 'supabase';

  load(): Promise<PortfolioData>;

  addPosition(input: PositionInput): Promise<void>;
  updatePosition(id: string, patch: Partial<PositionInput>): Promise<void>;
  deletePosition(id: string): Promise<void>;

  addPlan(input: PlanInput): Promise<void>;
  updatePlan(id: string, patch: Partial<PlanInput>): Promise<void>;
  deletePlan(id: string): Promise<void>;

  addSnapshot(input: SnapshotInput): Promise<void>;

  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle): Promise<void>;

  /** Setzt alles zurück auf den Auslieferungszustand. */
  reset(): Promise<void>;
}
