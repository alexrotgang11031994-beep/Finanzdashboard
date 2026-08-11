import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_CLUSTERS, DEFAULT_RULES } from '../defaults';
import { monthlyAmount } from '../metrics';
import type { ClusterDef, Portfolio, Position, Rules, SavingsPlan, Snapshot } from '../types';
import type {
  ExportBundle,
  PlanInput,
  PortfolioData,
  PositionInput,
  SnapshotInput,
  Store,
} from './types';

const DB_NAME = 'finanzdashboard';
const DB_VERSION = 1;

/** Es gibt im lokalen Modus genau ein Depot. Mehrere kommen erst mit Supabase. */
const PORTFOLIO_ID = 'local';

interface Schema extends DBSchema {
  meta: { key: string; value: unknown };
  positions: { key: string; value: Position };
  plans: { key: string; value: SavingsPlan };
  snapshots: { key: string; value: Snapshot };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('meta');
      database.createObjectStore('positions', { keyPath: 'id' });
      database.createObjectStore('plans', { keyPath: 'id' });
      database.createObjectStore('snapshots', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const value = await (await db()).get('meta', key);
  return (value as T | undefined) ?? fallback;
}

async function ensureSeeded(): Promise<void> {
  const database = await db();
  if (await database.get('meta', 'seeded')) return;

  const tx = database.transaction('meta', 'readwrite');
  await tx.store.put(DEFAULT_CLUSTERS, 'clusters');
  await tx.store.put(DEFAULT_RULES, 'rules');
  await tx.store.put(
    { id: PORTFOLIO_ID, name: 'Mein Depot', broker: null, as_of: null } satisfies Portfolio,
    'portfolio',
  );
  await tx.store.put(true, 'seeded');
  await tx.done;
}

export class LocalStore implements Store {
  readonly kind = 'local' as const;

  async load(): Promise<PortfolioData> {
    await ensureSeeded();
    const database = await db();

    const [portfolio, clusters, rules, positions, plans, snapshots] = await Promise.all([
      readMeta<Portfolio | null>('portfolio', null),
      readMeta<ClusterDef[]>('clusters', DEFAULT_CLUSTERS),
      readMeta<Rules>('rules', DEFAULT_RULES),
      database.getAll('positions'),
      database.getAll('plans'),
      database.getAll('snapshots'),
    ]);

    snapshots.sort((a, b) => a.date.localeCompare(b.date));

    return {
      portfolio,
      positions,
      plans,
      snapshots,
      clusters: [...clusters].sort((a, b) => a.sort_order - b.sort_order),
      rules,
      total: positions.reduce((s, p) => s + p.value, 0),
    };
  }

  async addPosition(input: PositionInput): Promise<void> {
    await ensureSeeded();
    await (await db()).put('positions', {
      ...input,
      id: crypto.randomUUID(),
      portfolio_id: PORTFOLIO_ID,
    });
  }

  async updatePosition(id: string, patch: Partial<PositionInput>): Promise<void> {
    const database = await db();
    const current = await database.get('positions', id);
    if (!current) throw new Error(`Position ${id} existiert nicht.`);
    await database.put('positions', { ...current, ...patch });
  }

  async deletePosition(id: string): Promise<void> {
    await (await db()).delete('positions', id);
  }

  async addPlan(input: PlanInput): Promise<void> {
    await ensureSeeded();
    await (await db()).put('plans', {
      ...input,
      id: crypto.randomUUID(),
      portfolio_id: PORTFOLIO_ID,
      monthly: monthlyAmount(input.amount, input.interval),
    });
  }

  async updatePlan(id: string, patch: Partial<PlanInput>): Promise<void> {
    const database = await db();
    const current = await database.get('plans', id);
    if (!current) throw new Error(`Sparplan ${id} existiert nicht.`);
    const merged = { ...current, ...patch };
    await database.put('plans', {
      ...merged,
      monthly: monthlyAmount(merged.amount, merged.interval),
    });
  }

  async deletePlan(id: string): Promise<void> {
    await (await db()).delete('plans', id);
  }

  async addSnapshot(input: SnapshotInput): Promise<void> {
    await ensureSeeded();
    const database = await db();
    // Ein Stand je Tag — ein zweiter am selben Datum ersetzt den ersten.
    const existing = (await database.getAll('snapshots')).find((s) => s.date === input.date);
    await database.put('snapshots', {
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      portfolio_id: PORTFOLIO_ID,
    });
  }

  async exportAll(): Promise<ExportBundle> {
    const data = await this.load();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      portfolio: data.portfolio,
      positions: data.positions,
      plans: data.plans,
      snapshots: data.snapshots,
      clusters: data.clusters,
      rules: data.rules,
    };
  }

  async importAll(bundle: ExportBundle): Promise<void> {
    const database = await db();
    const tx = database.transaction(
      ['meta', 'positions', 'plans', 'snapshots'],
      'readwrite',
    );

    await Promise.all([
      tx.objectStore('positions').clear(),
      tx.objectStore('plans').clear(),
      tx.objectStore('snapshots').clear(),
    ]);

    const meta = tx.objectStore('meta');
    await meta.put(bundle.clusters ?? DEFAULT_CLUSTERS, 'clusters');
    await meta.put(bundle.rules ?? DEFAULT_RULES, 'rules');
    await meta.put(
      bundle.portfolio ?? { id: PORTFOLIO_ID, name: 'Mein Depot', broker: null, as_of: null },
      'portfolio',
    );
    await meta.put(true, 'seeded');

    // Fremde IDs werden übernommen, aber auf das lokale Depot umgehängt.
    for (const p of bundle.positions ?? []) {
      await tx.objectStore('positions').put({ ...p, portfolio_id: PORTFOLIO_ID });
    }
    for (const p of bundle.plans ?? []) {
      await tx.objectStore('plans').put({ ...p, portfolio_id: PORTFOLIO_ID });
    }
    for (const s of bundle.snapshots ?? []) {
      await tx.objectStore('snapshots').put({ ...s, portfolio_id: PORTFOLIO_ID });
    }

    await tx.done;
  }

  async reset(): Promise<void> {
    const database = await db();
    const tx = database.transaction(
      ['meta', 'positions', 'plans', 'snapshots'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('meta').clear(),
      tx.objectStore('positions').clear(),
      tx.objectStore('plans').clear(),
      tx.objectStore('snapshots').clear(),
    ]);
    await tx.done;
    await ensureSeeded();
  }
}
