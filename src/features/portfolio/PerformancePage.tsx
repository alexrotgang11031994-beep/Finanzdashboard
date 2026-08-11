import { useMemo, useState } from 'react';
import { ProjectionChart } from '../../components/charts/ProjectionChart';
import { ValueChart } from '../../components/charts/ValueChart';
import { byCluster, flowByCluster, projectFlows } from '../../lib/metrics';
import { date as fmtDate, eur, signed } from '../../lib/format';
import { getStore } from '../../lib/store';
import type { PortfolioData } from '../../lib/queries';

const MONTHS = 36;

export function PerformancePage({
  data,
  reload,
}: {
  data: PortfolioData;
  reload: () => Promise<void>;
}) {
  const { positions, plans, snapshots, clusters, total } = data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breakdown = useMemo(
    () => byCluster(positions, total, clusters),
    [positions, total, clusters],
  );
  const { flow } = useMemo(() => flowByCluster(plans), [plans]);
  const series = useMemo(
    () => projectFlows(breakdown.buckets, flow, MONTHS),
    [breakdown.buckets, flow],
  );

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const change = first && last && first.value ? (last.value / first.value - 1) * 100 : null;

  async function saveToday() {
    setError(null);
    setBusy(true);
    try {
      await getStore().addSnapshot({
        date: new Date().toISOString().slice(0, 10),
        value: Math.round(total * 100) / 100,
        note: 'manuell gespeichert',
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card">
        <h2>Entwicklung</h2>

        {snapshots.length < 2 ? (
          <div className="empty">
            <p>
              <strong>Noch keine Wertentwicklung vorhanden.</strong>
            </p>
            <p className="small">
              {first
                ? `Bisher ist genau ein Zeitpunkt gespeichert: ${fmtDate(first.date)}. Daraus eine Kurve zu zeichnen, hieße sie zu erfinden.`
                : 'Es ist noch kein Stand gespeichert.'}{' '}
              Ab dem zweiten Stand entsteht hier eine echte Reihe aus echten Werten.
            </p>
          </div>
        ) : (
          <>
            <ValueChart snapshots={snapshots} />
            <p className="mute small">
              {first && last && (
                <>
                  {fmtDate(first.date)} bis {fmtDate(last.date)} · {signed(change ?? 0, 1)} %.{' '}
                </>
              )}
              Enthält Einzahlungen — das ist Kontostandsentwicklung, nicht Rendite. Für eine echte
              Renditekennzahl fehlen die Zahlungszeitpunkte.
            </p>

            <div className="tblwrap">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th className="right">Depotwert</th>
                    <th className="right">Δ zum Vorstand</th>
                    <th>Notiz</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshots].reverse().map((s, i, arr) => {
                    const prev = arr[i + 1];
                    const delta = prev ? s.value - prev.value : null;
                    return (
                      <tr key={s.id}>
                        <td>{fmtDate(s.date)}</td>
                        <td className="right num">{eur(s.value)}</td>
                        <td
                          className="right num"
                          style={{
                            color:
                              delta == null
                                ? undefined
                                : delta >= 0
                                  ? 'var(--ok)'
                                  : 'var(--warn)',
                          }}
                        >
                          {delta == null ? '–' : `${delta > 0 ? '+' : ''}${eur(delta)}`}
                        </td>
                        <td className="mute small">{s.note ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="btnrow">
          <button type="button" onClick={() => void saveToday()} disabled={busy || total === 0}>
            {busy ? 'Speichert …' : 'Aktuellen Stand speichern'}
          </button>
        </div>
        <p className="mute small" style={{ marginTop: 10 }}>
          Speichert den heutigen Depotwert als Punkt der Reihe. Ein zweiter Eintrag am selben Tag
          ersetzt den ersten.
        </p>
      </section>

      <section className="card">
        <h2>Projektion der Sparraten</h2>
        <p className="mute small">
          Wohin die Clusteranteile allein durch die laufenden Sparpläne laufen, bei unveränderten
          Kursen. Das isoliert den Effekt der Zuflüsse und ist ausdrücklich keine Kursprognose.
        </p>
        {plans.length === 0 ? (
          <div className="empty">
            Ohne Sparpläne gibt es nichts zu projizieren. Unter <strong>Sparpläne</strong> anlegen.
          </div>
        ) : (
          <ProjectionChart series={series} buckets={breakdown.buckets} months={MONTHS} />
        )}
      </section>
    </>
  );
}
