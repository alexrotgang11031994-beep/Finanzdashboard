import { useMemo, useState } from 'react';
import { byCluster, flowByCluster } from '../../lib/metrics';
import { eur, num, signed } from '../../lib/format';
import { getStore } from '../../lib/store';
import type { PortfolioData } from '../../lib/queries';
import type { SavingsPlan } from '../../lib/types';
import { INTERVAL_LABELS, PlanForm } from './PlanForm';

export function SavingsPage({
  data,
  reload,
}: {
  data: PortfolioData;
  reload: () => Promise<void>;
}) {
  const { positions, plans, clusters, total } = data;
  const [editing, setEditing] = useState<SavingsPlan | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const breakdown = useMemo(
    () => byCluster(positions, total, clusters),
    [positions, total, clusters],
  );
  const { flow, total: flowTotal } = useMemo(() => flowByCluster(plans), [plans]);

  const sorted = useMemo(() => [...plans].sort((a, b) => b.monthly - a.monthly), [plans]);
  const maxPlan = sorted[0]?.monthly || 1;

  async function remove(p: SavingsPlan) {
    if (!window.confirm(`Sparplan „${p.name}" wirklich löschen?`)) return;
    setError(null);
    try {
      await getStore().deletePlan(p.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  if (editing) {
    return (
      <PlanForm
        clusters={clusters}
        initial={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSubmit={async (input) => {
          if (editing === 'new') await getStore().addPlan(input);
          else await getStore().updatePlan(editing.id, input);
          setEditing(null);
          await reload();
        }}
      />
    );
  }

  return (
    <>
      <section className="card">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}
        >
          <h2>Sparpläne</h2>
          <button type="button" onClick={() => setEditing('new')}>
            Sparplan hinzufügen
          </button>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {plans.length === 0 ? (
          <div className="empty">
            <p>Noch keine Sparpläne erfasst.</p>
            <p className="small">
              Sobald welche eingetragen sind, zeigt diese Seite, ob der Zufluss die bestehende
              Gewichtung verstärkt oder ausgleicht.
            </p>
          </div>
        ) : (
          <p className="mute">
            {plans.length} {plans.length === 1 ? 'aktiver Plan' : 'aktive Pläne'}, zusammen{' '}
            {eur(flowTotal)} im Monat und {eur(flowTotal * 12)} im Jahr.
          </p>
        )}
      </section>

      {plans.length > 0 && (
        <>
          <section className="card">
            <h2>Verstärkt oder gleicht der Zufluss aus?</h2>
            <p className="mute small">
              Δ zeigt, ob ein Cluster mehr oder weniger frisches Geld bekommt, als es ohnehin
              Gewicht hat. Werte nahe null heißen: Der Sparplan schreibt den Ist-Zustand fort.
            </p>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>Cluster</th>
                    <th className="right">Bestand</th>
                    <th className="right">Zufluss</th>
                    <th className="right">Δ</th>
                    <th className="right">Ziel</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.buckets.map((c) => {
                    const flowPct = flowTotal ? ((flow[c.key] ?? 0) / flowTotal) * 100 : 0;
                    const delta = flowPct - c.pct;
                    const flat = Math.abs(delta) < 1;
                    return (
                      <tr key={c.key}>
                        <td>
                          <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                            <span className="swatch" style={{ background: c.color }} />
                            {c.label}
                          </span>
                        </td>
                        <td className="right num">{num(c.pct, 1)} %</td>
                        <td className="right num">{num(flowPct, 1)} %</td>
                        <td
                          className="right num"
                          style={{
                            color: flat ? 'var(--mute)' : delta > 0 ? 'var(--ok)' : 'var(--caution)',
                          }}
                        >
                          {signed(delta, 1)}
                        </td>
                        <td className="right num mute">{num(c.target, 0)} %</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Einzelne Pläne</h2>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Cluster</th>
                    <th>Rhythmus</th>
                    <th className="right">Rate</th>
                    <th className="right">je Monat</th>
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const def = p.cluster
                      ? breakdown.buckets.find((c) => c.key === p.cluster)
                      : undefined;
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td>
                          {def ? (
                            <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
                              <span className="swatch" style={{ background: def.color }} />
                              {def.label}
                            </span>
                          ) : (
                            <span className="mute">–</span>
                          )}
                        </td>
                        <td className="mute small">{INTERVAL_LABELS[p.interval]}</td>
                        <td className="right num">{eur(p.amount, 2)}</td>
                        <td className="right num">{eur(p.monthly)}</td>
                        <td style={{ width: '18%' }}>
                          <span
                            className="dbar"
                            style={{
                              width: `${(p.monthly / maxPlan) * 100}%`,
                              background: def?.color ?? 'var(--mute)',
                            }}
                          />
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button type="button" className="link" onClick={() => setEditing(p)}>
                              Bearbeiten
                            </button>
                            <button type="button" className="link" onClick={() => void remove(p)}>
                              Löschen
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
