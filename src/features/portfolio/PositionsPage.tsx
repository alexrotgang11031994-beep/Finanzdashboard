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
import { eur, money, pct } from '../../lib/format';
import { getStore } from '../../lib/store';
import type { PortfolioData } from '../../lib/queries';
import type { Position } from '../../lib/types';
import { getQuotes, hasApiKey, MarketDataError, type Quote } from '../../lib/market/fmp';
import { PositionForm } from './PositionForm';
import { PhotoImportDialog } from './PhotoImportDialog';

const timeFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

const columnHelper = createColumnHelper<Position>();

export function PositionsPage({
  data,
  reload,
}: {
  data: PortfolioData;
  reload: () => Promise<void>;
}) {
  const { positions, clusters, total } = data;

  // Der Filter lebt als Komponenten-State. In legacy/views/positions.js war er
  // eine modulweite Variable, die über Tab-Wechsel hinweg kleben blieb.
  const [search, setSearch] = useState('');
  const [cluster, setCluster] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'value', desc: true }]);
  const [editing, setEditing] = useState<Position | 'new' | null>(null);
  const [photoImport, setPhotoImport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [quotesBusy, setQuotesBusy] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [quotesAsOf, setQuotesAsOf] = useState<Date | null>(null);

  const clusterLabels = useMemo(() => new Map(clusters.map((c) => [c.key, c])), [clusters]);

  async function refreshQuotes() {
    setQuotesError(null);
    if (!hasApiKey()) {
      setQuotesError('Kein API-Schlüssel hinterlegt — unter „Daten“ eintragen.');
      return;
    }
    const tickers = Array.from(
      new Set(positions.map((p) => p.ticker?.trim()).filter((t): t is string => Boolean(t))),
    );
    if (tickers.length === 0) {
      setQuotesError('Keine Position hat einen Ticker hinterlegt.');
      return;
    }
    setQuotesBusy(true);
    try {
      const { quotes: result, failed } = await getQuotes(tickers);
      setQuotes(result);
      setQuotesAsOf(new Date());
      if (failed.length > 0) {
        setQuotesError(
          `${failed.length} von ${tickers.length} Kursen nicht verfügbar (${failed.join(', ')}) — ` +
            'oft Notierungen außerhalb der USA, die der kostenlose Plan sperrt.',
        );
      }
    } catch (err) {
      setQuotesError(err instanceof MarketDataError ? err.message : 'Kursabruf fehlgeschlagen.');
    } finally {
      setQuotesBusy(false);
    }
  }

  async function remove(p: Position) {
    if (!window.confirm(`„${p.name}" wirklich löschen?`)) return;
    setError(null);
    try {
      await getStore().deletePosition(p.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Position',
        cell: (info) => (
          <>
            <div>{info.getValue()}</div>
            {(info.row.original.ticker || info.row.original.isin) && (
              <div className="mute small num">
                {[info.row.original.ticker, info.row.original.isin].filter(Boolean).join(' · ')}
              </div>
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
            <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center' }}>
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
        id: 'quote',
        header: 'Kurs',
        cell: (info) => {
          const ticker = info.row.original.ticker;
          const quote = ticker ? quotes.get(ticker) : undefined;
          if (!quote) return <span className="mute num">–</span>;
          return <span className="num">{money(quote.price, info.row.original.currency, 2)}</span>;
        },
      }),
      columnHelper.display({
        id: 'share',
        header: 'Anteil',
        cell: (info) => {
          const share = total ? (info.row.original.value / total) * 100 : 0;
          return (
            <>
              <span className="num">{pct(share)}</span>
              <span className="dbar" style={{ width: `${Math.max(share * 3, 2)}px`, marginTop: 4 }} />
            </>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <span style={{ display: 'inline-flex', gap: 6 }}>
            <button
              type="button"
              className="link"
              onClick={() => setEditing(info.row.original)}
              aria-label={`${info.row.original.name} bearbeiten`}
            >
              Bearbeiten
            </button>
            <button
              type="button"
              className="link"
              onClick={() => void remove(info.row.original)}
              aria-label={`${info.row.original.name} löschen`}
            >
              Löschen
            </button>
          </span>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clusterLabels, total, quotes],
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

  if (editing) {
    return (
      <PositionForm
        clusters={clusters}
        initial={editing === 'new' ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSubmit={async (input) => {
          if (editing === 'new') await getStore().addPosition(input);
          else await getStore().updatePosition(editing.id, input);
          setEditing(null);
          await reload();
        }}
      />
    );
  }

  if (photoImport) {
    return (
      <PhotoImportDialog
        clusters={clusters}
        existingPositions={positions}
        onClose={() => setPhotoImport(false)}
        onImported={reload}
      />
    );
  }

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2>Positionen</h2>
        <div className="btnrow" style={{ marginTop: 0 }}>
          <button type="button" className="ghost" onClick={() => void refreshQuotes()} disabled={quotesBusy}>
            {quotesBusy ? 'Aktualisiert …' : 'Kurse aktualisieren'}
          </button>
          <button type="button" className="ghost" onClick={() => setPhotoImport(true)}>
            Per Foto importieren
          </button>
          <button type="button" onClick={() => setEditing('new')}>
            Position hinzufügen
          </button>
        </div>
      </div>

      {quotesAsOf && !quotesError && (
        <p className="mute small" role="status">
          Kurse Stand {timeFormat.format(quotesAsOf)} — verzögert, keine Realtime-Daten.
        </p>
      )}
      {quotesError && (
        <p className="error small" role="alert">
          {quotesError}
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {positions.length === 0 ? (
        <div className="empty">
          <p>Noch keine Positionen erfasst.</p>
          <p className="small">
            Über „Position hinzufügen" einzeln anlegen, per Foto importieren — oder unter „Daten"
            die Demo-Daten laden, um das Dashboard erst einmal gefüllt zu sehen.
          </p>
        </div>
      ) : (
        <>
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
                            <button type="button" onClick={header.column.getToggleSortingHandler()}>
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
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shown.length === 0 && <p className="empty">Keine Position passt zu diesem Filter.</p>}
        </>
      )}
    </section>
  );
}
