import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { eur, pct } from '../../lib/format';
import type { PortfolioData } from '../../lib/queries';
import type { Position } from '../../lib/types';

const columnHelper = createColumnHelper<Position>();

export function PositionsPage({ data }: { data: PortfolioData }) {
  const { positions, clusters, total } = data;

  // Der Filter lebt jetzt als Komponenten-State. In legacy/views/positions.js
  // war er eine modulweite Variable, die über Tab-Wechsel hinweg kleben blieb.
  const [search, setSearch] = useState('');
  const [cluster, setCluster] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'value', desc: true }]);

  const clusterLabels = useMemo(
    () => new Map(clusters.map((c) => [c.key, c])),
    [clusters],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Position',
        cell: (info) => (
          <>
            <div>{info.getValue()}</div>
            {info.row.original.ticker && (
              <div className="mute small num">{info.row.original.ticker}</div>
            )}
          </>
        ),
      }),
      columnHelper.accessor('cluster', {
        header: 'Cluster',
        cell: (info) => {
          const key = info.getValue();
          const def = key ? clusterLabels.get(key) : undefined;
          if (!def) return <span className="mute">–</span>;
          return (
            <span className="item" style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
              <span className="swatch" style={{ background: def.color }} />
              {def.label}
            </span>
          );
        },
      }),
      columnHelper.accessor('type', {
        header: 'Art',
        cell: (info) => info.getValue() ?? <span className="mute">–</span>,
      }),
      columnHelper.accessor('value', {
        header: 'Wert',
        cell: (info) => <span className="num">{eur(info.getValue())}</span>,
      }),
      columnHelper.display({
        id: 'share',
        header: 'Anteil',
        cell: (info) => {
          const share = total ? (info.row.original.value / total) * 100 : 0;
          return (
            <>
              <span className="num">{pct(share)}</span>
              <span
                className="dbar"
                style={{ width: `${Math.max(share * 3, 2)}px`, marginTop: 4 }}
              />
            </>
          );
        },
      }),
    ],
    [clusterLabels, total],
  );

  const filtered = useMemo(
    () => (cluster ? positions.filter((p) => p.cluster === cluster) : positions),
    [positions, cluster],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const shown = table.getRowModel().rows;
  const shownValue = shown.reduce((s, r) => s + r.original.value, 0);

  return (
    <section className="card">
      <h2>Positionen</h2>

      <label htmlFor="pos-search">Suche</label>
      <input
        id="pos-search"
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Name, Ticker, ISIN …"
      />

      <div className="btnrow" role="group" aria-label="Nach Cluster filtern">
        <button
          type="button"
          className={cluster === null ? '' : 'ghost'}
          onClick={() => setCluster(null)}
          aria-pressed={cluster === null}
        >
          Alle
        </button>
        {clusters
          .filter((c) => positions.some((p) => p.cluster === c.key))
          .map((c) => (
            <button
              key={c.key}
              type="button"
              className={cluster === c.key ? '' : 'ghost'}
              onClick={() => setCluster(cluster === c.key ? null : c.key)}
              aria-pressed={cluster === c.key}
            >
              {c.label}
            </button>
          ))}
      </div>

      <p className="mute small" style={{ marginTop: 14 }} aria-live="polite">
        {shown.length} von {positions.length} Positionen · {eur(shownValue)}
      </p>

      <div className="tblwrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id}>
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Nach ${header.column.columnDef.header} sortieren`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && <p className="empty">Keine Position passt zu diesem Filter.</p>}
    </section>
  );
}
