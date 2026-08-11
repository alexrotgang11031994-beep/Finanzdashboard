import { eur } from '../../lib/format';
import type { Snapshot } from '../../lib/types';

const W = 680;
const H = 240;
const L = 66;
const R = 16;
const T = 16;
const B = 30;

/**
 * Verlauf des Depotwerts über die gespeicherten Stände.
 *
 * Portiert aus chart() in legacy/views/performance.js. Unterschied: Gitter-
 * und Textfarben kommen aus CSS-Variablen statt als Literale im Code, damit
 * der Dunkelmodus greift.
 */
export function ValueChart({ snapshots }: { snapshots: Snapshot[] }) {
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  if (!first || !last || snapshots.length < 2) return null;

  const values = snapshots.map((s) => s.value);
  const lo = Math.min(...values) * 0.97;
  const hi = Math.max(...values) * 1.03;
  const range = hi - lo || 1;

  const t0 = new Date(first.date).getTime();
  const span = Math.max(new Date(last.date).getTime() - t0, 1);

  const x = (d: string) => L + ((new Date(d).getTime() - t0) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / range) * (H - T - B);

  const path = snapshots
    .map((s, i) => `${i ? 'L' : 'M'}${x(s.date).toFixed(1)} ${y(s.value).toFixed(1)}`)
    .join(' ');

  const gridValues = [0, 1, 2, 3].map((i) => lo + (range * i) / 3);

  return (
    <div className="chartwrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Verlauf des Depotwerts über ${snapshots.length} gespeicherte Stände, von ${eur(first.value)} auf ${eur(last.value)}`}
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
            <text
              x={0}
              y={y(v) + 4}
              fontFamily="var(--mono)"
              fontSize={10}
              fill="var(--mute)"
            >
              {eur(v)}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.4} />
        {snapshots.map((s) => (
          <circle key={s.id} cx={x(s.date)} cy={y(s.value)} r={3.2} fill="var(--accent)" />
        ))}
      </svg>
    </div>
  );
}
