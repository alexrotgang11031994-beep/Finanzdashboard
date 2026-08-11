import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      await signInWithEmail(email.trim());
      setState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.');
      setState('idle');
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Finanzdashboard</h1>
        <p className="mute">Bestand, Sparpläne, Signale.</p>

        {state === 'sent' ? (
          <div className="notice" role="status">
            <p>
              Wir haben eine E-Mail an <strong>{email}</strong> geschickt. Der Link darin meldet
              dich an — er gilt eine Stunde.
            </p>
            <button type="button" className="link" onClick={() => setState('idle')}>
              Andere Adresse verwenden
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="email">E-Mail-Adresse</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@example.com"
            />
            <button type="submit" disabled={state === 'sending' || !email.trim()}>
              {state === 'sending' ? 'Wird gesendet …' : 'Anmeldelink anfordern'}
            </button>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <p className="mute small">
              Kein Passwort nötig. Du bekommst bei jeder Anmeldung einen Einmal-Link per E-Mail.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
