import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

/**
 * Erkennt sowohl fehlende als auch noch nicht ersetzte Platzhalterwerte.
 * Ohne diese Prüfung schlägt die Anmeldung erst beim Absenden mit einem
 * nichtssagenden "Failed to fetch" fehl.
 */
function looksConfigured(): boolean {
  if (!url || !anonKey) return false;
  if (url.includes('placeholder') || url.includes('dein-projekt')) return false;
  if (anonKey.startsWith('platzhalter') || anonKey.startsWith('dein-')) return false;
  try {
    new URL(url);
  } catch {
    return false;
  }
  return true;
}

export const isSupabaseConfigured = looksConfigured();

let client: SupabaseClient | null = null;

/**
 * Der anon key steht bewusst im Client-Bundle. Er ist öffentlich und darf es
 * sein — abgesichert wird über Row Level Security in der Datenbank. Der
 * service_role key umgeht RLS und gehört ausschließlich serverseitig.
 *
 * Der Client wird erst bei Bedarf erzeugt, damit die Anwendung ohne
 * Supabase-Konfiguration im lokalen Modus startet, statt beim Import zu werfen.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase ist nicht konfiguriert. VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in .env eintragen.',
    );
  }
  client ??= createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
