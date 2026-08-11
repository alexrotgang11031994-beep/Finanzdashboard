import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage } from './features/auth/LoginPage';
import { ThemeToggle } from './features/theme/ThemeProvider';
import { OverviewPage } from './features/portfolio/OverviewPage';
import { PositionsPage } from './features/portfolio/PositionsPage';
import { usePortfolioData } from './lib/queries';
import { eur } from './lib/format';

const TABS = [
  { to: '/', label: 'Übersicht', end: true },
  { to: '/positionen', label: 'Positionen', end: false },
];

export function App() {
  const { session, loading, user, signOut } = useAuth();

  if (loading) {
    return (
      <main className="auth">
        <p className="mute">Sitzung wird geprüft …</p>
      </main>
    );
  }

  if (!session) return <LoginPage />;

  return <Dashboard email={user?.email ?? ''} onSignOut={signOut} />;
}

function Dashboard({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
  const { data, loading, error } = usePortfolioData();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="grow">
          <h1>Finanzdashboard</h1>
          <p className="mute small">{email}</p>
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
          <button type="button" className="ghost small" onClick={() => void onSignOut()}>
            Abmelden
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'on' : '')}>
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
          <p className="mute small">
            Häufigste Ursache: Die Migration in supabase/migrations/ ist noch nicht eingespielt.
          </p>
        </div>
      )}

      {data && (
        <Routes>
          <Route path="/" element={<OverviewPage data={data} />} />
          <Route path="/positionen" element={<PositionsPage data={data} />} />
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
