import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { ThemeToggle } from './features/theme/ThemeProvider';
import { OverviewPage } from './features/portfolio/OverviewPage';
import { PositionsPage } from './features/portfolio/PositionsPage';
import { SavingsPage } from './features/portfolio/SavingsPage';
import { PerformancePage } from './features/portfolio/PerformancePage';
import { DataPage } from './features/settings/DataPage';
import { usePortfolioData } from './lib/queries';
import { storeKind } from './lib/store';
import { eur } from './lib/format';

const TABS = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/positionen', label: 'Positionen', end: false },
  { to: '/sparplaene', label: 'Sparpläne', end: false },
  { to: '/entwicklung', label: 'Entwicklung', end: false },
  { to: '/daten', label: 'Daten', end: false },
];

export function App() {
  const { session, loading, user, signOut, required } = useAuth();

  // Im lokalen Modus gibt es keine Anmeldung — direkt ins Dashboard.
  if (!required) return <Dashboard label="Lokaler Modus" onSignOut={null} />;

  if (loading) {
    return (
      <main className="auth">
        <p className="mute">Sitzung wird geprüft …</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  return <Dashboard label={user?.email ?? ''} onSignOut={signOut} />;
}

function Dashboard({
  label,
  onSignOut,
}: {
  label: string;
  onSignOut: (() => Promise<void>) | null;
}) {
  const { data, loading, error, reload } = usePortfolioData();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="grow">
          <h1>Finanzdashboard</h1>
          <p className="mute small">{label}</p>
        </div>
        {data && (
          <div className="right">
            <span className="total">{eur(data.total)}</span>
            <div className="mute small">
              <span className="dot stale" />
              Snapshot-Werte, keine Live-Kurse
            </div>
          </div>
        )}
        <div className="btnrow" style={{ marginTop: 0 }}>
          <ThemeToggle />
          {onSignOut && (
            <button type="button" className="ghost small" onClick={() => void onSignOut()}>
              Abmelden
            </button>
          )}
        </div>
      </header>

      {storeKind === 'local' && (
        <p className="notice small" style={{ marginTop: 16 }}>
          Die Daten liegen ausschließlich in diesem Browser und verlassen das Gerät nicht. Kein
          Konto, kein Server. Unter <strong>Daten</strong> gibt es den Export — das ist hier die
          einzige Sicherung.
        </p>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? 'on' : '')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {loading && <p className="mute">Daten werden geladen …</p>}

      {error && (
        <div className="card">
          <p className="error" role="alert">
            {error}
          </p>
        </div>
      )}

      {data && (
        <Routes>
          <Route path="/" element={<OverviewPage data={data} />} />
          <Route path="/positionen" element={<PositionsPage data={data} reload={reload} />} />
          <Route path="/sparplaene" element={<SavingsPage data={data} reload={reload} />} />
          <Route path="/entwicklung" element={<PerformancePage data={data} reload={reload} />} />
          <Route path="/daten" element={<DataPage data={data} reload={reload} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}

      <footer className="legal">
        Darstellungswerkzeug, keine Anlageberatung. Es werden keine Kauf- oder
        Verkaufsempfehlungen gegeben und keine persönlichen Verhältnisse berücksichtigt.
      </footer>
    </div>
  );
}
