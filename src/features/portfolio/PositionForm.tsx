import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { isValidIsin } from '../../lib/isin';
import type { ClusterDef, Position } from '../../lib/types';
import type { PositionInput } from '../../lib/store';
import {
  getProfile,
  hasApiKey,
  MarketDataError,
  searchSymbols,
  suggestCluster,
  type SymbolResult,
} from '../../lib/market/fmp';
import { money } from '../../lib/format';

const TYPES = ['Aktie', 'ETF', 'ETC', 'Anleihe', 'Fonds', 'Krypto', 'Sonstiges'];
const CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP', 'DKK', 'CAD', 'SEK', 'NOK'];
const SEARCH_DEBOUNCE_MS = 400;

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

  // Automatische Suche am Namensfeld: FMP-Symbolsuche, gedrosselt gegen das
  // Tageslimit, unterdrückt direkt nach einer Auswahl (sonst löst das
  // Übernehmen des Namens sofort die nächste Suche aus).
  const [suggestions, setSuggestions] = useState<SymbolResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [priceHint, setPriceHint] = useState<{ price: number; currency: string; symbol: string } | null>(
    null,
  );
  const lastPicked = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (!hasApiKey()) return undefined;
    if (name.trim().length < 2 || name === lastPicked.current) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const id = ++requestId.current;
      searchSymbols(name)
        .then((results) => {
          if (id !== requestId.current) return;
          setSuggestions(results);
          setOpen(results.length > 0);
          setActiveIndex(-1);
          setSearchErr(null);
        })
        .catch((err) => {
          if (id !== requestId.current) return;
          setSuggestions([]);
          setOpen(false);
          setSearchErr(err instanceof MarketDataError ? err.message : 'Suche fehlgeschlagen.');
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  async function pick(result: SymbolResult) {
    lastPicked.current = result.name;
    setName(result.name);
    setTicker(result.symbol);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    if (result.currency && CURRENCIES.includes(result.currency)) setCurrency(result.currency);

    setLookupBusy(true);
    setSearchErr(null);
    setPriceHint(null);
    try {
      const profile = await getProfile(result.symbol);
      if (profile?.isin) setIsin(profile.isin);
      if (!cluster) {
        const suggested = suggestCluster(profile?.industry ?? null, profile?.sector ?? null);
        if (suggested && clusters.some((c) => c.key === suggested)) setCluster(suggested);
      }
      if (profile?.price != null) {
        setPriceHint({ price: profile.price, currency: profile.currency ?? result.currency, symbol: result.symbol });
      }
    } catch (err) {
      setSearchErr(err instanceof MarketDataError ? err.message : 'Abfrage fehlgeschlagen.');
    } finally {
      setLookupBusy(false);
    }
  }

  function onNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      const chosen = suggestions[activeIndex];
      if (chosen) {
        e.preventDefault();
        void pick(chosen);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

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
      <div className="combobox">
        <input
          id="pf-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onNameKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          role="combobox"
          aria-expanded={open}
          aria-controls="pf-name-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `pf-name-opt-${activeIndex}` : undefined}
          autoComplete="off"
          required
          autoFocus
        />
        {open && (
          <ul id="pf-name-listbox" role="listbox" className="combobox-list">
            {suggestions.map((s, i) => (
              <li
                key={`${s.symbol}-${s.exchange}`}
                id={`pf-name-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={i === activeIndex ? 'active' : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void pick(s);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span>{s.name}</span>
                <span className="mute small num">
                  {s.symbol}
                  {s.exchange ? ` · ${s.exchange}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mute small">
        {hasApiKey()
          ? 'Tippen für Vorschläge aus dem Netz — füllt Ticker, ISIN und Branche.'
          : 'Automatische Vorschläge: kostenlosen API-Schlüssel unter „Daten“ hinterlegen.'}
      </p>
      {lookupBusy && <p className="mute small">Lädt Details …</p>}
      {searchErr && !lookupBusy && (
        <p className="mute small" role="status">
          {searchErr}
        </p>
      )}
      {priceHint && (
        <p className="mute small" role="status">
          Letzter Kurs ({priceHint.symbol}): {money(priceHint.price, priceHint.currency || 'EUR', 2)} — wird
          nicht automatisch in den Wert übernommen.
        </p>
      )}

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
