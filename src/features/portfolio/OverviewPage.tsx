import { useMemo } from 'react';
import { byCluster, checkRules, concentration, flowByCluster } from '../../lib/metrics';
import { eur, num, pct } from '../../lib/format';
import type { PortfolioData } from '../../lib/queries';

export function OverviewPage({ data }: { data: PortfolioData }) {
  const { positions, plans, clusters, rules, total } = data;

  const breakdown = useMemo(
    () => byCluster(positions, total, clusters),
    [positions, total, clusters],
  );
  const conc = useMemo(() => concentration(positions, total), [positions, total]);
  const flow = useMemo(() => flowByCluster(plans), [plans]);
  const findings = useMemo(
    () => checkRules(positions, breakdown, total, rules),
    [positions, breakdown, total, rules],
  );

  if (!positions.length) {
    return (
      <div className="empty">
        <p>Noch keine Positionen erfasst.</p>
        <p className="small">
          Unter <strong>Positionen</strong> einzeln anlegen oder per Foto importieren, oder unter{' '}
          <strong>Daten</strong> die Beispieldaten laden.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <span className="label">Depotwert</span>
          <span className="value">{eur(total)}</span>
        </div>
        <div className="kpi">
          <span className="label">Positionen</span>
          <span className="value">{num(positions.length)}</span>
        </div>
        <div className="kpi">
          <span className="label">Sparrate / Monat</span>
          <span className="value">{eur(flow.total)}</span>
        </div>
        <div className="kpi">
          <span className="label">Effektive Positionen</span>
          <span className="value">{num(conc.effective, 1)}</span>
        </div>
        <div className="kpi">
          <span className="label">Top 5</span>
          <span className="value">{pct(conc.top5)}</span>
        </div>
      </div>

      <section className="card">
        <h2>Aufteilung nach Cluster</h2>
        <div
          className="band"
          role="img"
          aria-label={breakdown.buckets
            .filter((c) => c.pct > 0)
            .map((c) => `${c.label} ${c.pct.toFixed(1)} Prozent`)
            .join(', ')}
        >
          {breakdown.buckets
            .filter((c) => c.pct > 0)
            .map((c) => (
              <span
                key={c.key}
                className="seg"
                style={{ width: `${c.pct}%`, background: c.color }}
              />
            ))}
        </div>

        <div className="legend">
          {breakdown.buckets
            .filter((c) => c.count > 0)
            .map((c) => (
              <span className="item" key={c.key}>
                <span className="swatch" style={{ background: c.color }} />
                <span>{c.label}</span>
                <span className="num mute">{pct(c.pct)}</span>
                <span className="mute small">Ziel {pct(c.target, 0)}</span>
              </span>
            ))}
        </div>

        {breakdown.unassigned.count > 0 && (
          <p className="error small">
            {breakdown.unassigned.count} Positionen ({eur(breakdown.unassigned.value)}) haben kein
            gültiges Cluster und fehlen in der Aufteilung.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Regelprüfung</h2>
        {findings.length === 0 ? (
          <p className="mute">Keine Abweichungen vom hinterlegten Regelwerk.</p>
        ) : (
          <ul className="findings">
            {findings.map((f, i) => (
              <li key={`${f.rule}-${i}`}>
                <span className={`level ${f.level}`}>{f.level}</span>
                <span className="mute">{f.rule}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mute small" style={{ marginTop: 14 }}>
          Beschreibende Kennzahlen gegen dein eigenes Regelwerk. Keine Kauf- oder
          Verkaufsempfehlung.
        </p>
      </section>
    </>
  );
}
