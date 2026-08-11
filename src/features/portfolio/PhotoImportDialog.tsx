import { useCallback, useEffect, useRef, useState } from 'react';
import { getExtractor } from '../../lib/extract';
import type { ExtractedRow } from '../../lib/extract';
import { isValidIsin } from '../../lib/isin';
import { eur } from '../../lib/format';
import { getStore } from '../../lib/store';
import type { ClusterDef, Position } from '../../lib/types';

interface DraftRow extends ExtractedRow {
  /** Clientseitige ID für React-Keys und zum gezielten Bearbeiten einer Zeile. */
  key: string;
  include: boolean;
  cluster: string;
  /** Welches Foto in der Auswahl diese Zeile geliefert hat — bei mehreren Fotos zur Einordnung. */
  photoIndex: number;
  /** Vom Prüfdialog gesetzt, keine Erkennungseigenschaft: Name+Wert kommt schon einmal vor. */
  duplicateHint: string | null;
}

type Phase = 'pick' | 'working' | 'review' | 'error';

/** Vergleichsschlüssel für Positionen: normierter Name plus Wert auf den Cent gerundet. */
function positionKey(name: string, value: number | null): string | null {
  if (!name.trim() || value == null) return null;
  return `${name.trim().toLowerCase()}|${Math.round(value * 100)}`;
}

function toDrafts(rows: ExtractedRow[], photoIndex: number): DraftRow[] {
  return rows.map((r, i) => ({
    ...r,
    key: `${photoIndex}-${i}-${r.raw}`,
    include: r.confidence >= 0.5 && r.value != null,
    cluster: '',
    photoIndex,
    duplicateHint: null,
  }));
}

/**
 * Markiert Zeilen, deren Name+Wert bereits einmal in der Liste vorkommt —
 * Überlappungen entstehen leicht, wenn mehrere Screenshots einer gescrollten
 * Liste sich am Rand überschneiden. Die erste Instanz bleibt unangetastet,
 * jede weitere wird zur Kontrolle abgewählt und markiert.
 */
function flagDuplicates(rows: DraftRow[]): DraftRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const key = positionKey(row.name, row.value);
    if (!key) return { ...row, duplicateHint: null };
    if (seen.has(key)) {
      return { ...row, include: false, duplicateHint: 'kommt mehrfach in der Auswahl vor' };
    }
    seen.add(key);
    return { ...row, duplicateHint: null };
  });
}

export function PhotoImportDialog({
  clusters,
  existingPositions,
  onClose,
  onImported,
}: {
  clusters: ClusterDef[];
  existingPositions: Position[];
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [fileProgress, setFileProgress] = useState({ index: 0, total: 0, withinFile: 0 });
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const addMoreInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      // Beendet den Worker, wenn der Dialog geschlossen wird — hält kein
      // WASM-Modul im Speicher, nachdem die Seite wieder verlassen wurde.
      void getExtractor().dispose();
    },
    [],
  );

  const existingKeys = new Set(
    existingPositions.map((p) => positionKey(p.name, p.value)).filter((v): v is string => v != null),
  );
  const existingIsins = new Set(
    existingPositions.map((p) => p.isin?.toUpperCase()).filter((v): v is string => Boolean(v)),
  );

  const processFiles = useCallback(async (files: File[], mode: 'replace' | 'append') => {
    setPhase('working');
    setError(null);
    const collected: DraftRow[] = [];
    const collectedWarnings: string[] = [];
    const startIndex = mode === 'append' ? Date.now() : 0;

    try {
      for (let i = 0; i < files.length; i++) {
        setFileProgress({ index: i, total: files.length, withinFile: 0 });
        const file = files[i];
        if (!file) continue;
        const result = await getExtractor().extract(file, (fraction) =>
          setFileProgress({ index: i, total: files.length, withinFile: fraction }),
        );
        collected.push(...toDrafts(result.rows, startIndex + i));
        if (files.length > 1 && result.rows.length === 0) {
          collectedWarnings.push(`Foto ${i + 1} von ${files.length}: keine Positionen erkannt.`);
        } else {
          collectedWarnings.push(...result.warnings);
        }
      }

      setRows((prev) => flagDuplicates(mode === 'append' ? [...prev, ...collected] : collected));
      setWarnings(collectedWarnings);
      setPhase('review');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Die Texterkennung ist fehlgeschlagen. Bitte mit einem anderen Foto erneut versuchen.',
      );
      setPhase('error');
    }
  }, []);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addBlankRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `manual-${Date.now()}`,
        name: '',
        value: null,
        currency: 'EUR',
        isin: null,
        ticker: null,
        quantity: null,
        confidence: 1,
        raw: '',
        include: true,
        cluster: '',
        photoIndex: -1,
        duplicateHint: null,
      },
    ]);
  }

  const included = rows.filter((r) => r.include);
  const readyCount = included.filter((r) => r.name.trim() && r.value != null && r.value >= 0).length;
  const sum = included.reduce((s, r) => s + (r.value ?? 0), 0);
  const photoCount = new Set(rows.map((r) => r.photoIndex).filter((i) => i >= 0)).size;

  async function commit() {
    setSaving(true);
    setError(null);
    try {
      const store = getStore();
      for (const row of included) {
        if (!row.name.trim() || row.value == null || row.value < 0) continue;
        await store.addPosition({
          name: row.name.trim(),
          ticker: row.ticker,
          isin: row.isin,
          quantity: row.quantity,
          value: row.value,
          currency: row.currency ?? 'EUR',
          cluster: row.cluster || null,
          type: 'Aktie',
          source: 'photo',
        });
      }
      await onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  const progressFraction =
    fileProgress.total > 0 ? (fileProgress.index + fileProgress.withinFile) / fileProgress.total : 0;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>Positionen per Foto</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Schließen
        </button>
      </div>

      {phase === 'pick' && (
        <>
          <p className="mute small">
            Die Texterkennung läuft vollständig in diesem Browser. Die Fotos verlassen dein Gerät
            nicht, es gibt keinen Server und kein Konto. Am besten funktionieren scharfe,
            geradeausgerichtete Screenshots einer Depotübersicht mit gutem Kontrast — auch im
            Dunkelmodus der Broker-App. Für eine lange Liste mehrere Screenshots auf einmal
            auswählen; überschneidende Positionen werden automatisch erkannt.
          </p>
          <div className="btnrow">
            <button type="button" onClick={() => fileInput.current?.click()}>
              Fotos auswählen
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                if (files.length) void processFiles(files, 'replace');
              }}
            />
          </div>
        </>
      )}

      {phase === 'working' && (
        <div className="empty">
          <p>
            <strong>
              {fileProgress.total > 1
                ? `Foto ${fileProgress.index + 1} von ${fileProgress.total} wird gelesen …`
                : 'Text wird erkannt …'}
            </strong>
          </p>
          <p className="small">
            Beim ersten Mal lädt das Sprachmodell einmalig herunter (~5 MB), danach ist es im
            Browser zwischengespeichert.
          </p>
          <div style={{ maxWidth: 320, margin: '14px auto 0' }}>
            <div style={{ height: 6, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.round(progressFraction * 100)}%`,
                  background: 'var(--accent)',
                  transition: 'width 0.2s',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <>
          <p className="error" role="alert">
            {error}
          </p>
          <button type="button" className="ghost" onClick={() => setPhase('pick')}>
            Erneut versuchen
          </button>
        </>
      )}

      {phase === 'review' && (
        <>
          <p className="notice small">
            Texterkennung liest Zeichen, kein Layout — Zahlen und ISINs bitte gegen das Foto
            prüfen, bevor du übernimmst. Nichts wird ohne deine Bestätigung gespeichert.
            {photoCount > 1 && ` Zeilen aus ${photoCount} Fotos zusammengeführt.`}
          </p>

          {warnings.map((w, i) => (
            <p className="error small" key={`${w}-${i}`}>
              {w}
            </p>
          ))}

          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Name</th>
                  <th className="right">Wert</th>
                  <th>Währung</th>
                  <th>ISIN</th>
                  <th>Cluster</th>
                  <th>Vertrauen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isinBad = row.isin != null && !isValidIsin(row.isin);
                  const isinDuplicate = row.isin != null && existingIsins.has(row.isin.toUpperCase());
                  const key = positionKey(row.name, row.value);
                  const depotDuplicate = !isinDuplicate && key != null && existingKeys.has(key);
                  return (
                    <tr key={row.key} style={{ opacity: row.include ? 1 : 0.5 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.include}
                          onChange={(e) => updateRow(row.key, { include: e.target.checked })}
                          aria-label={`${row.name || 'Zeile'} übernehmen`}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => updateRow(row.key, { name: e.target.value })}
                          style={{ minWidth: 160 }}
                        />
                        {row.raw && <div className="mute small">erkannt: „{row.raw}"</div>}
                        {row.duplicateHint && (
                          <div className="error small">{row.duplicateHint}</div>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.value ?? ''}
                          onChange={(e) =>
                            updateRow(row.key, {
                              value: e.target.value.trim() ? Number(e.target.value.replace(',', '.')) : null,
                            })
                          }
                          style={{ width: 100, textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.currency ?? ''}
                          onChange={(e) => updateRow(row.key, { currency: e.target.value.toUpperCase() })}
                          style={{ width: 60 }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.isin ?? ''}
                          onChange={(e) => updateRow(row.key, { isin: e.target.value.toUpperCase() || null })}
                          aria-invalid={isinBad}
                          style={{ width: 130 }}
                        />
                        {isinBad && <div className="error small">Prüfziffer passt nicht</div>}
                        {(isinDuplicate || depotDuplicate) && !isinBad && (
                          <div className="error small">liegt schon im Depot</div>
                        )}
                      </td>
                      <td>
                        <select
                          value={row.cluster}
                          onChange={(e) => updateRow(row.key, { cluster: e.target.value })}
                        >
                          <option value="">–</option>
                          {clusters.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          className="num small"
                          style={{
                            color:
                              row.confidence >= 0.75
                                ? 'var(--ok)'
                                : row.confidence >= 0.5
                                  ? 'var(--caution)'
                                  : 'var(--warn)',
                          }}
                        >
                          {Math.round(row.confidence * 100)} %
                        </span>
                      </td>
                      <td>
                        <button type="button" className="link" onClick={() => removeRow(row.key)}>
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="btnrow">
            <button type="button" className="ghost" onClick={addBlankRow}>
              Zeile hinzufügen
            </button>
            <button type="button" className="ghost" onClick={() => addMoreInput.current?.click()}>
              Weiteres Foto hinzufügen
            </button>
            <input
              ref={addMoreInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                if (files.length) void processFiles(files, 'append');
              }}
            />
          </div>

          <p className="mute small" style={{ marginTop: 14 }} aria-live="polite">
            {readyCount} von {rows.length} Zeilen zur Übernahme markiert · zusammen {eur(sum)}
          </p>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="btnrow">
            <button type="button" onClick={() => void commit()} disabled={saving || readyCount === 0}>
              {saving ? 'Speichert …' : `${readyCount} ${readyCount === 1 ? 'Position' : 'Positionen'} übernehmen`}
            </button>
            <button type="button" className="ghost" onClick={() => setPhase('pick')} disabled={saving}>
              Von vorn beginnen
            </button>
          </div>
        </>
      )}
    </div>
  );
}
