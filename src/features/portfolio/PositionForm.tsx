import { useState, type FormEvent } from 'react';
import { isValidIsin } from '../../lib/isin';
import type { ClusterDef, Position } from '../../lib/types';
import type { PositionInput } from '../../lib/store';

const TYPES = ['Aktie', 'ETF', 'ETC', 'Anleihe', 'Fonds', 'Krypto', 'Sonstiges'];
const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP', 'DKK', 'CAD', 'SEK', 'NOK'];

interface Props {
  clusters: ClusterDef[];
  initial?: Position;
  onSubmit: (input: PositionInput) => Promise<void>;
  onCancel: () => void;
}

export function PositionForm({ clusters, initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ticker, setTicker] = useState(initial?.ticker ?? '');
  const [isin, setIsin] = useState(initial?.isin ?? '');
  const [value, setValue] = useState(initial ? String(initial.value) : '');
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR');
  const [cluster, setCluster] = useState(initial?.cluster ?? '');
  const [type, setType] = useState(initial?.type ?? 'Aktie');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isinTouched = isin.trim().length > 0;
  const isinBad = isinTouched && !isValidIsin(isin);
  const numericValue = Number(value.replace(',', '.'));
  const valueBad = value.trim().length > 0 && (!Number.isFinite(numericValue) || numericValue < 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Name fehlt.');
    if (!Number.isFinite(numericValue) || numericValue < 0) return setError('Wert ist keine gültige Zahl.');
    if (isinBad) return setError('Die ISIN ist ungültig — die Prüfziffer passt nicht.');

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        ticker: ticker.trim() || null,
        isin: isin.trim().toUpperCase() || null,
        quantity: quantity.trim() ? Number(quantity.replace(',', '.')) : null,
        value: numericValue,
        currency,
        cluster: cluster || null,
        type: type || null,
        source: initial?.source ?? 'manual',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>{initial ? 'Position bearbeiten' : 'Position hinzufügen'}</h3>

      <label htmlFor="pf-name">Name</label>
      <input
        id="pf-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />

      <div className="grid2">
        <div>
          <label htmlFor="pf-value">Wert</label>
          <input
            id="pf-value"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={valueBad}
            required
          />
        </div>
        <div>
          <label htmlFor="pf-currency">Währung</label>
          <select id="pf-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div>
          <label htmlFor="pf-cluster">Cluster</label>
          <select id="pf-cluster" value={cluster} onChange={(e) => setCluster(e.target.value)}>
            <option value="">– keines –</option>
            {clusters.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pf-type">Art</label>
          <select id="pf-type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid2">
        <div>
          <label htmlFor="pf-ticker">Ticker (optional)</label>
          <input
            id="pf-ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="pf-isin">ISIN (optional)</label>
          <input
            id="pf-isin"
            type="text"
            value={isin}
            onChange={(e) => setIsin(e.target.value)}
            aria-invalid={isinBad}
            aria-describedby={isinBad ? 'pf-isin-err' : undefined}
            placeholder="z. B. IE00B4L5Y983"
          />
          {isinBad && (
            <p className="error small" id="pf-isin-err">
              Prüfziffer passt nicht.
            </p>
          )}
        </div>
      </div>

      <label htmlFor="pf-qty">Stückzahl (optional)</label>
      <input
        id="pf-qty"
        type="text"
        inputMode="decimal"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="btnrow">
        <button type="submit" disabled={busy}>
          {busy ? 'Speichert …' : 'Speichern'}
        </button>
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
