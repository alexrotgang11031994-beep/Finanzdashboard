import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

interface AuthValue {
  session: Session | null;
  user: User | null;
  /** true, solange die bestehende Sitzung noch geprüft wird. */
  loading: boolean;
  /** false im lokalen Modus — dort gibt es keine Anmeldung. */
  required: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Im lokalen Modus gibt es nichts zu prüfen, also nie ein Ladezustand.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    const auth = getSupabase().auth;

    void auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    loading,
    required: isSupabaseConfigured,
    async signInWithEmail(email) {
      const { error } = await getSupabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
      });
      if (error) throw error;
    },
    async signOut() {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> stehen.');
  return ctx;
}
