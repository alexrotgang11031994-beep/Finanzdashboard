import { useRef, useState } from 'react';
import { getStore, storeKind } from '../../lib/store';
import type { ExportBundle } from '../../lib/store';
import { buildDemoBundle } from '../../lib/demoData';
import { date as fmtDate, eur } from '../../lib/format';
import type { PortfolioData } from '../../lib/queries';
import { getApiKey, setApiKey } from '../../lib/market/fmp';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DataPage({ data, reload }: { data: PortfolioData; reload: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setNote(null);
    setBusy(label);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vorgang fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  }

  async function exportJson() {
    const bundle = await getStore().exportAll();
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finanzdashboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote('Sicherung heruntergeladen.');
  }

  async function importJson(file: File) {
    const text = await file.text();
    let bundle: ExportBundle;
    try {
      bundle = JSON.parse(text) as ExportBundle;
    } catch {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    if (bundle.version !== 1 || !Array.isArray(bundle.positions)) {
      throw new Error('Das ist keine Sicherung des Finanzdashboards.');
    }
    if (
      !window.confirm(
        `Import ersetzt den aktuellen Bestand vollständig.\n\n` +
          `Neu: ${bundle.positions.length} Positionen, ${bundle.plans?.length ?? 0} Sparpläne.\n` +
          `Jetzt: ${data.positions.length} Positionen, ${data.plans.length} Sparpläne.\n\nFortfahren?`,
      )
    ) {
      return;
    }
    await getStore().importAll(bundle);
    setNote('Sicherung eingespielt.');
  }

  return (
    <>
      <section className="card">
        <h2>Sicherung</h2>
        {storeKind === 'local' && (
          <p className="notice small">
            <strong>Im lokalen Modus ist der Export deine einzige Sicherung.</strong> Die Daten
            liegen in der IndexedDB dieses Browsers. Wer den Browserverlauf samt Websitedaten
            löscht, das Profil wechselt oder privat surft, verliert sie ersatzlos. Es gibt kein
            Backup auf einem Server, weil kein Server beteiligt ist.
          </p>
        )}
        <p className="mute small">
          Bestand: {plural(data.positions.length, 'Position', 'Positionen')} ({eur(data.total)}),{' '}
          {plural(data.plans.length, 'Sparplan', 'Sparpläne')},{' '}
          {plural(data.snapshots.length, 'gespeicherter Stand', 'gespeicherte Stände')}
          {data.snapshots[0] && <> seit {fmtDate(data.snapshots[0].date)}</>}.
        </p>

        <div className="btnrow">
          <button type="button" onClick={() => void run('export', exportJson)} disabled={busy !== null}>
            {busy === 'export' ? 'Exportiert …' : 'Als JSON exportieren'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
          >
            Sicherung einspielen
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void run('import', () => importJson(file));
            }}
          />
        </div>
      </section>

      <section className="card">
        <h2>Beispieldaten</h2>
        <p className="mute small">
          Ein erfundenes Depot mit 17 Positionen und 8 Sparplänen, um das Dashboard gefüllt zu
          sehen. Ersetzt den aktuellen Bestand.
        </p>
        <div className="btnrow">
          <button
            type="button"
            className="ghost"
            disabled={busy !== null}
            onClick={() =>
              void run('demo', async () => {
                if (
                  data.positions.length > 0 &&
                  !window.confirm('Das ersetzt deinen aktuellen Bestand. Fortfahren?')
                ) {
                  return;
                }
                await getStore().importAll(buildDemoBundle());
                setNote('Beispieldaten geladen.');
              })
            }
          >
            {busy === 'demo' ? 'Lädt …' : 'Beispieldaten laden'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Zurücksetzen</h2>
        <p className="mute small">
          Löscht Positionen, Sparpläne und gespeicherte Stände. Cluster und Regelwerk bleiben.
        </p>
        <div className="btnrow">
          <button
            type="button"
            className="ghost"
            disabled={busy !== null}
            onClick={() =>
              void run('reset', async () => {
                if (!window.confirm('Wirklich alle Positionen und Sparpläne löschen?')) return;
                await getStore().reset();
                setNote('Zurückgesetzt.');
              })
            }
          >
            {busy === 'reset' ? 'Setzt zurück …' : 'Alles zurücksetzen'}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Kursdaten</h2>
        <p className="mute small">
          Für die automatische Suche im Positionsformular (Name, ISIN, Branche) und die
          Kurs-Spalte in der Positionsliste wird{' '}
          <a href="https://site.financialmodelingprep.com/developer/docs" target="_blank" rel="noreferrer">
            Financial Modeling Prep
          </a>{' '}
          angefragt — direkt aus diesem Browser, es gibt keinen Server dazwischen. Ein kostenloser
          Schlüssel erlaubt 250 Abfragen pro Tag, Kurse mit Verzögerung, ein Aufruf pro Position
          bei „Kurse aktualisieren" (Sammelabruf ist kostenpflichtig). Der kostenlose Plan sperrt
          gezielte Symbole — welche genau, ist nicht dokumentiert. Fast immer betroffen sind
          Auslandsnotierungen wie Xetra (also die meisten deutschen Aktien direkt); bei US-ADRs
          (z. B. SAP → Ticker „SAP" an der NYSE statt „SAP.DE") klappt es meist. Vereinzelt fehlen
          aber auch reine US-Werte. Der Schlüssel liegt ausschließlich in diesem Browser und geht
          nur an financialmodelingprep.com — nirgendwo sonst hin.
        </p>
        <label htmlFor="fmp-key">API-Schlüssel</label>
        <input
          id="fmp-key"
          type="text"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="z. B. abcdEFGH12345…"
          autoComplete="off"
        />
        <div className="btnrow">
          <button
            type="button"
            onClick={() => {
              setApiKey(apiKeyInput);
              setError(null);
              setNote(apiKeyInput.trim() ? 'Schlüssel gespeichert.' : 'Schlüssel entfernt.');
            }}
          >
            Speichern
          </button>
          {getApiKey() && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setApiKey('');
                setApiKeyInput('');
                setNote('Schlüssel entfernt.');
              }}
            >
              Entfernen
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {note && (
        <p className="mute" role="status">
          {note}
        </p>
      )}
    </>
  );
}
