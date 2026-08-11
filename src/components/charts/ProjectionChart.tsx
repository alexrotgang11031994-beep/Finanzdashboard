import { num } from '../../lib/format';
import type { ClusterBucket, ProjectionRow } from '../../lib/types';

const W = 680;
const H = 250;
const L = 40;
const R = 118;
const T = 14;
const B = 28;

/** Hält die Endbeschriftung im Bild — sie steht im Rand rechts der Zeichenfläche. */
function shortLabel(label: string): string {
  const first = label.split(' ')[0] ?? label;
  return first.length > 11 ? `${first.slice(0, 10)}…` : first;
}

/**
 * Wohin die Clusteranteile allein durch die laufenden Sparpläne laufen.
 *
 * Portiert aus projectionChart() in legacy/views/performance.js. Zwei
 * Unterschiede: die gezeigten Cluster werden nach Endanteil ausgewählt statt
 * fest verdrahtet ('SEMI', 'KERN', 'PHYS', 'INFRA'), und die Y-Achse skaliert
 * mit den Daten statt auf konstanten 45 Prozent zu stehen — bei einem Depot
 * mit einem 60-Prozent-Cluster lief die Linie vorher aus dem Bild.
 */
export function ProjectionChart({
  series,
  buckets,
  months,
  maxLines = 5,
}: {
  series: ProjectionRow[];
  buckets: ClusterBucket[];
  months: number;
  maxLines?: number;
}) {
  const lastRow = series[series.length - 1];
  if (!lastRow || series.length < 2) return null;

  const shown = [...buckets]
    .filter((c) => (lastRow.shares[c.key] ?? 0) > 0.5)
    .sort((a, b) => (lastRow.shares[b.key] ?? 0) - (lastRow.shares[a.key] ?? 0))
    .slice(0, maxLines);

  if (!shown.length) return null;

  const peak = Math.max(
    ...series.flatMap((r) => shown.map((c) => r.shares[c.key] ?? 0)),
  );
  const maxY = Math.ceil(peak / 15) * 15 || 15;

  const x = (m: number) => L + (m / months) * (W - L - R);
  const y = (v: number) => T + (1 - v / maxY) * (H - T - B);

  const gridValues = [0, maxY / 3, (maxY / 3) * 2, maxY];
  const xTicks = [0, Math.round(months / 3), Math.round((months / 3) * 2), months];

  return (
    <div className="chartwrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Projektion der Clusteranteile über ${months} Monate: ${shown
          .map((c) => `${c.label} ${num(lastRow.shares[c.key] ?? 0, 0)} Prozent`)
          .join(', ')}`}
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text x={0} y={y(v) + 4} fontFamily="var(--mono)" fontSize={10} fill="var(--mute)">
              {num(v, 0)} %
            </text>
          </g>
        ))}

        {xTicks.map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - 6}
            fontFamily="var(--mono)"
            fontSize={10}
            fill="var(--mute)"
            textAnchor={m === 0 ? 'start' : m === months ? 'end' : 'middle'}
          >
            {m ? `+${m} M` : 'heute'}
          </text>
        ))}

        {shown.map((c) => {
          const d = series
            .map(
              (r, i) =>
                `${i ? 'L' : 'M'}${x(r.month).toFixed(1)} ${y(Math.min(r.shares[c.key] ?? 0, maxY)).toFixed(1)}`,
            )
            .join(' ');
          const end = lastRow.shares[c.key] ?? 0;
          return (
            <g key={c.key}>
              <path d={d} fill="none" stroke={c.color} strokeWidth={2.2} />
              <text
                x={W - R + 6}
                y={y(Math.min(end, maxY)) + 4}
                fontFamily="var(--mono)"
                fontSize={10}
                fill={c.color}
                fontWeight={600}
              >
                {num(end, 0)} % {shortLabel(c.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
