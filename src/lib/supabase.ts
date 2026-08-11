import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY fehlen. ' +
      '.env.example nach .env kopieren und die Werte aus Supabase → Project Settings → API eintragen.',
  );
}

/**
 * Der anon key steht bewusst im Client-Bundle. Er ist öffentlich und darf es
 * sein — abgesichert wird über Row Level Security in der Datenbank. Der
 * service_role key umgeht RLS und gehört ausschließlich serverseitig.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
