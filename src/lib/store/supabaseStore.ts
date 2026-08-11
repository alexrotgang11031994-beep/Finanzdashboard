import { getSupabase } from '../supabase';
import { DEFAULT_RULES } from '../defaults';
import { monthlyAmount } from '../metrics';
import type { Portfolio, Position, Rules, SavingsPlan, Snapshot } from '../types';
import type {
  ExportBundle,
  PlanInput,
  PortfolioData,
  PositionInput,
  SnapshotInput,
  Store,
} from './types';

/** Spaltennamen sind snake_case, das Regelobjekt im Code camelCase. */
interface RulesRow {
  max_single_position: number;
  max_cluster: number;
  min_core: number;
  max_positions: number;
  min_position_size: number;
}

function toRules(row: RulesRow | null): Rules {
  if (!row) return DEFAULT_RULES;
  return {
    maxSinglePosition: Number(row.max_single_position),
    maxCluster: Number(row.max_cluster),
    minCore: Number(row.min_core),
    maxPositions: row.max_positions,
    minPositionSize: Number(row.min_position_size),
  };
}

export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const;

  private async userId(): Promise<string> {
    const { data, error } = await getSupabase().auth.getUser();
    if (error || !data.user) throw new Error('Nicht angemeldet.');
    return data.user.id;
  }

  private async portfolioId(): Promise<string> {
    const { data, error } = await getSupabase()
      .from('portfolios')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Kein Depot vorhanden.');
    return data.id as string;
  }

  async load(): Promise<PortfolioData> {
    const sb = getSupabase();

    const { data: portfolios, error: pErr } = await sb
      .from('portfolios')
      .select('id, name, broker, as_of')
      .order('created_at', { ascending: true })
      .limit(1);
    if (pErr) throw pErr;

    const portfolio = (portfolios?.[0] as Portfolio | undefined) ?? null;

    const [clustersRes, rulesRes] = await Promise.all([
      sb.from('clusters').select('key, label, color, target, is_core, sort_order').order('sort_order'),
      sb
        .from('rules')
        .select('max_single_position, max_cluster, min_core, max_positions, min_position_size')
        .maybeSingle(),
    ]);
    if (clustersRes.error) throw clustersRes.error;
    if (rulesRes.error) throw rulesRes.error;

    let positions: Position[] = [];
    let plans: SavingsPlan[] = [];
    let snapshots: Snapshot[] = [];

    if (portfolio) {
      const [posRes, planRes, snapRes] = await Promise.all([
        sb.from('positions').select('*').eq('portfolio_id', portfolio.id),
        sb.from('savings_plans').select('*').eq('portfolio_id', portfolio.id),
        sb
          .from('snapshots')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('date', { ascending: true }),
      ]);
      if (posRes.error) throw posRes.error;
      if (planRes.error) throw planRes.error;
      if (snapRes.error) throw snapRes.error;

      positions = (posRes.data ?? []).map((p) => ({ ...p, value: Number(p.value) })) as Position[];
      plans = (planRes.data ?? []).map((p) => ({
        ...p,
        amount: Number(p.amount),
        monthly: Number(p.monthly),
      })) as SavingsPlan[];
      snapshots = (snapRes.data ?? []).map((s) => ({
        ...s,
        value: Number(s.value),
      })) as Snapshot[];
    }

    return {
      portfolio,
      positions,
      plans,
      snapshots,
      clusters: (clustersRes.data ?? []).map((c) => ({ ...c, target: Number(c.target) })),
      rules: toRules(rulesRes.data as RulesRow | null),
      total: positions.reduce((s, p) => s + p.value, 0),
    };
  }

  async addPosition(input: PositionInput): Promise<void> {
    const [user_id, portfolio_id] = await Promise.all([this.userId(), this.portfolioId()]);
    const { error } = await getSupabase().from('positions').insert({ ...input, user_id, portfolio_id });
    if (error) throw error;
  }

  async updatePosition(id: string, patch: Partial<PositionInput>): Promise<void> {
    const { error, count } = await getSupabase()
      .from('positions')
      .update(patch, { count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    // RLS liefert bei fremden Zeilen keinen Fehler, sondern null betroffene
    // Zeilen. Ohne diese Prüfung sieht ein blockiertes Update wie Erfolg aus.
    if (count === 0) throw new Error('Position nicht gefunden oder kein Zugriff.');
  }

  async deletePosition(id: string): Promise<void> {
    const { error, count } = await getSupabase()
      .from('positions')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error('Position nicht gefunden oder kein Zugriff.');
  }

  async addPlan(input: PlanInput): Promise<void> {
    const [user_id, portfolio_id] = await Promise.all([this.userId(), this.portfolioId()]);
    const { error } = await getSupabase()
      .from('savings_plans')
      .insert({ ...input, user_id, portfolio_id, monthly: monthlyAmount(input.amount, input.interval) });
    if (error) throw error;
  }

  async updatePlan(id: string, patch: Partial<PlanInput>): Promise<void> {
    const sb = getSupabase();
    const { data: current, error: readErr } = await sb
      .from('savings_plans')
      .select('amount, interval')
      .eq('id', id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!current) throw new Error('Sparplan nicht gefunden oder kein Zugriff.');

    const amount = patch.amount ?? Number(current.amount);
    const interval = patch.interval ?? current.interval;

    const { error, count } = await sb
      .from('savings_plans')
      .update({ ...patch, monthly: monthlyAmount(amount, interval) }, { count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error('Sparplan nicht gefunden oder kein Zugriff.');
  }

  async deletePlan(id: string): Promise<void> {
    const { error, count } = await getSupabase()
      .from('savings_plans')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    if (count === 0) throw new Error('Sparplan nicht gefunden oder kein Zugriff.');
  }

  async addSnapshot(input: SnapshotInput): Promise<void> {
    const [user_id, portfolio_id] = await Promise.all([this.userId(), this.portfolioId()]);
    const { error } = await getSupabase()
      .from('snapshots')
      .upsert({ ...input, user_id, portfolio_id }, { onConflict: 'portfolio_id,date' });
    if (error) throw error;
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
    const [user_id, portfolio_id] = await Promise.all([this.userId(), this.portfolioId()]);
    const sb = getSupabase();

    // Reihenfolge zählt: erst leeren, dann schreiben.
    for (const table of ['positions', 'savings_plans', 'snapshots'] as const) {
      const { error } = await sb.from(table).delete().eq('portfolio_id', portfolio_id);
      if (error) throw error;
    }

    if (bundle.positions?.length) {
      const { error } = await sb
        .from('positions')
        .insert(bundle.positions.map(({ id: _id, ...p }) => ({ ...p, user_id, portfolio_id })));
      if (error) throw error;
    }
    if (bundle.plans?.length) {
      const { error } = await sb
        .from('savings_plans')
        .insert(bundle.plans.map(({ id: _id, ...p }) => ({ ...p, user_id, portfolio_id })));
      if (error) throw error;
    }
    if (bundle.snapshots?.length) {
      const { error } = await sb
        .from('snapshots')
        .insert(bundle.snapshots.map(({ id: _id, ...s }) => ({ ...s, user_id, portfolio_id })));
      if (error) throw error;
    }
  }

  async reset(): Promise<void> {
    const portfolio_id = await this.portfolioId();
    const sb = getSupabase();
    for (const table of ['positions', 'savings_plans', 'snapshots'] as const) {
      const { error } = await sb.from(table).delete().eq('portfolio_id', portfolio_id);
      if (error) throw error;
    }
  }
}
