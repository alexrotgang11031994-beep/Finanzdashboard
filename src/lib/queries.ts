import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type {
  ClusterDef,
  Portfolio,
  Position,
  Rules,
  SavingsPlan,
  Snapshot,
} from './types';

export interface PortfolioData {
  portfolio: Portfolio | null;
  positions: Position[];
  plans: SavingsPlan[];
  snapshots: Snapshot[];
  clusters: ClusterDef[];
  rules: Rules;
  total: number;
}

const DEFAULT_RULES: Rules = {
  maxSinglePosition: 8,
  maxCluster: 25,
  minCore: 20,
  maxPositions: 25,
  minPositionSize: 0.3,
};

/** Spaltennamen der Datenbank sind snake_case, die Regeln im Code camelCase. */
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

export function usePortfolioData() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Das erste Depot des Nutzers. Mehrere Depots kommen in Phase 3 dazu.
      const { data: portfolios, error: pErr } = await supabase
        .from('portfolios')
        .select('id, name, broker, as_of')
        .order('created_at', { ascending: true })
        .limit(1);
      if (pErr) throw pErr;

      const portfolio = (portfolios?.[0] as Portfolio | undefined) ?? null;

      const [clustersRes, rulesRes] = await Promise.all([
        supabase
          .from('clusters')
          .select('key, label, color, target, is_core, sort_order')
          .order('sort_order'),
        supabase
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
          supabase.from('positions').select('*').eq('portfolio_id', portfolio.id),
          supabase.from('savings_plans').select('*').eq('portfolio_id', portfolio.id),
          supabase
            .from('snapshots')
            .select('*')
            .eq('portfolio_id', portfolio.id)
            .order('date', { ascending: true }),
        ]);
        if (posRes.error) throw posRes.error;
        if (planRes.error) throw planRes.error;
        if (snapRes.error) throw snapRes.error;

        positions = (posRes.data ?? []).map((p) => ({ ...p, value: Number(p.value) }));
        plans = (planRes.data ?? []).map((p) => ({
          ...p,
          amount: Number(p.amount),
          monthly: Number(p.monthly),
        }));
        snapshots = (snapRes.data ?? []).map((s) => ({ ...s, value: Number(s.value) }));
      }

      setData({
        portfolio,
        positions,
        plans,
        snapshots,
        clusters: (clustersRes.data ?? []).map((c) => ({ ...c, target: Number(c.target) })),
        rules: toRules(rulesRes.data as RulesRow | null),
        total: positions.reduce((s, p) => s + p.value, 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
