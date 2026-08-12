import { useEffect, useState } from 'react';
import { date as fmtDate } from '../../lib/format';
import { PERSONALIZED_ADVICE, SOURCES, TIER_LABELS } from '../../lib/sources';

interface SignalItem {
  source?: string;
  title: string;
  url?: string;
  date?: string;
  ticker?: string;
  summary?: string;
}

interface TermStage {
  stage: string;
  count: number;
  newest?: string | null;
}

interface TermAnalysis {
  term: string;
  stageCount: number;
  totalStages: number;
  stages: TermStage[];
}

interface SignalsPayload {
  generatedAt: string;
  disclaimer?: string;
  errors?: string[];
  analysis?: TermAnalysis[];
  items: SignalItem[];
}

/**
 * Signalansicht.
 *
 * Lädt bewusst selbst und bekommt keine Depotdaten übergeben. Die Trennung
 * ist der eigentliche Zweck dieser Komponente — siehe docs/RECHTLICHES.md.
 * Sobald hier ein Bezug zum Depot entstünde ("weil du X hältst …"), wäre das
 * ein anderer Rechtsvorgang.
 */
export function SignalsPage() {
  const [payload, setPayload] = useState<SignalsPayload | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let active = true;
    const url = `${import.meta.env.BASE_URL}data/signals.json`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<SignalsPayload>;
      })
      .then((data) => {
        if (!active) return;
        setPayload(data);
        setState('ready');
      })
      .catch(() => {
        if (active) setState('missing');
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="card">
        <h2>Signale</h2>

        <div className="notice">
          <strong>Fremde Daten, nicht meine Meinung.</strong> Was hier steht, stammt von den unten
          genannten Dritten und wird unverändert mit Quelle und Datum angezeigt. Es findet keine
          Verknüpfung mit deinem Depot statt und es wird nichts daraus abgeleitet.{' '}
          {PERSONALIZED_ADVICE ? (
            <strong className="error">
              Achtung: PERSONALIZED_ADVICE steht auf true. Siehe docs/RECHTLICHES.md.
            </strong>
          ) : (
            <>Warum diese Trennung wichtig ist, steht in docs/RECHTLICHES.md.</>
          )}
        </div>

        {state === 'loading' && <p className="mute">Signale werden geladen …</p>}

        {state === 'missing' && (
          <div className="empty">
            <p>
              <strong>Noch keine Signale abgerufen.</strong>
            </p>
            <p className="small">
              Der Workflow <code>.github/workflows/signals.yml</code> füllt{' '}
              <code>public/data/signals.json</code> werktäglich. Bis dahin bleibt diese Ansicht
              leer — es werden keine Beispieldaten vorgetäuscht, weil das in einem Finanzprodukt
              der gefährlichste Platzhalter wäre.
            </p>
          </div>
        )}

        {state === 'ready' && payload && (
          <>
            <p className="mute small">
              Zuletzt abgerufen: {fmtDate(payload.generatedAt)}. Aktualisierung läuft werktäglich
              über GitHub Actions.
            </p>

            {payload.errors && payload.errors.length > 0 && (
              <p className="error small">
                {payload.errors.length === 1
                  ? 'Eine Quelle konnte'
                  : `${payload.errors.length} Quellen konnten`}{' '}
                beim letzten Lauf nicht abgerufen werden: {payload.errors.join(' · ')}
              </p>
            )}

            {payload.analysis && payload.analysis.length > 0 && (
              <div className="notice" style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 4 }}>Belegdichte je Begriff</h3>
                <p className="mute small">
                  In wie vielen der vier Vorlaufstufen ein Begriff auftaucht, geordnet nach
                  Vorlauf: Forschung → Entwickler → Staatsauftrag → Pflichtmitteilung. Das ist
                  eine <strong>Auszählung, keine Prognose</strong>. Ein Begriff in vier Stufen ist
                  breiter belegt als einer in zwei — mehr sagt die Zahl nicht. Zu Kurswirkungen
                  ist die Fachliteratur ernüchternd: Ereignisstudien zu Staatsaufträgen messen
                  Überrenditen von 0,4 bis 0,7 Prozent, teils ohne statistische Signifikanz.
                </p>
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Begriff</th>
                        <th>Stufen</th>
                        <th>Verteilung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.analysis.map((a) => (
                        <tr key={a.term}>
                          <td>{a.term}</td>
                          <td className="num">
                            {a.stageCount} / {a.totalStages}
                          </td>
                          <td className="mute small">
                            {a.stages.length === 0
                              ? '–'
                              : a.stages.map((s) => `${s.stage} (${s.count})`).join(' → ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {payload.items.length === 0 ? (
              <div className="empty">Der letzte Lauf hat keine Einträge geliefert.</div>
            ) : (
              <ul className="feed">
                {payload.items.map((it, i) => (
                  <li className="sig" key={`${it.url ?? it.title}-${i}`}>
                    <div className="sig-meta">
                      <span className="sig-src">{it.source ?? 'unbekannt'}</span>
                      {it.date && <span>{fmtDate(it.date)}</span>}
                      {it.ticker && <span className="num">{it.ticker}</span>}
                    </div>
                    <div className="sig-title">
                      {it.url ? (
                        <a href={it.url} target="_blank" rel="noopener noreferrer">
                          {it.title}
                        </a>
                      ) : (
                        it.title
                      )}
                    </div>
                    {it.summary && <p className="mute small">{it.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>Quellen</h2>
        <p className="mute small">
          Jede Quelle mit ihrem rechtlichen Status. Ausführlich in docs/QUELLEN.md.
        </p>
        <ul className="srclist">
          {SOURCES.map((s) => (
            <li key={s.id}>
              <div className="src-h">
                <strong>{s.label}</strong>
                <span className={`tier ${s.tier}`}>{TIER_LABELS[s.tier]}</span>
                <span className="mute small">{s.enabled ? 'aktiv' : 'aus'}</span>
              </div>
              <p className="mute small">{s.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
