import { useState, type FormEvent } from 'react';
import { monthlyAmount } from '../../lib/metrics';
import { eur } from '../../lib/format';
import type { ClusterDef, PlanInterval, SavingsPlan } from '../../lib/types';
import type { PlanInput } from '../../lib/store';

export const INTERVAL_LABELS: Record<PlanInterval, string> = {
  weekly: 'wöchentlich',
  biweekly: 'alle zwei Wochen',
  semimonthly: 'zweimal im Monat',
  monthly: 'monatlich',
};

interface Props {
  clusters: ClusterDef[];
  initial?: SavingsPlan;
  onSubmit: (input: PlanInput) => Promise<void>;
  onCancel: () => void;
}

export function PlanForm({ clusters, initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [interval, setInterval] = useState<PlanInterval>(initial?.interval ?? 'monthly');
  const [cluster, setCluster] = useState(initial?.cluster ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount.replace(',', '.'));
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name fehlt.');
    if (!amountValid) return setError('Die Rate muss eine Zahl größer null sein.');

    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        amount: numericAmount,
        interval,
        cluster: cluster || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>{initial ? 'Sparplan bearbeiten' : 'Sparplan hinzufügen'}</h3>

      <label htmlFor="sf-name">Name</label>
      <input
        id="sf-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />

      <div className="grid2">
        <div>
          <label htmlFor="sf-amount">Rate je Ausführung</label>
          <input
            id="sf-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={amount.trim().length > 0 && !amountValid}
            required
          />
        </div>
        <div>
          <label htmlFor="sf-interval">Rhythmus</label>
          <select
            id="sf-interval"
            value={interval}
            onChange={(e) => setInterval(e.target.value as PlanInterval)}
          >
            {(Object.keys(INTERVAL_LABELS) as PlanInterval[]).map((k) => (
              <option key={k} value={k}>
                {INTERVAL_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor="sf-cluster">Cluster</label>
      <select id="sf-cluster" value={cluster} onChange={(e) => setCluster(e.target.value)}>
        <option value="">– keines –</option>
        {clusters.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      {amountValid && (
        <p className="mute small" style={{ marginTop: 12 }} aria-live="polite">
          Ergibt {eur(monthlyAmount(numericAmount, interval), 2)} im Monat,{' '}
          {eur(monthlyAmount(numericAmount, interval) * 12)} im Jahr.
          {interval === 'weekly' && ' Wochenpläne sind mit 52/12 Ausführungen gerechnet.'}
        </p>
      )}

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
