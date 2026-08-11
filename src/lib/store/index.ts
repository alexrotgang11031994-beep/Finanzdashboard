import { isSupabaseConfigured } from '../supabase';
import { LocalStore } from './local';
import { SupabaseStore } from './supabaseStore';
import type { Store } from './types';

export type { ExportBundle, PlanInput, PortfolioData, PositionInput, Store } from './types';

let instance: Store | null = null;

/**
 * Wählt die Speicherart anhand der Konfiguration.
 *
 * Ohne gültige Supabase-Werte in .env läuft alles lokal in IndexedDB — kein
 * Konto, keine Anmeldung, Daten bleiben auf dem Gerät. Sobald die Werte
 * gesetzt sind, übernimmt Supabase mit Anmeldung und Mandantentrennung.
 */
export function getStore(): Store {
  instance ??= isSupabaseConfigured ? new SupabaseStore() : new LocalStore();
  return instance;
}

export const storeKind = isSupabaseConfigured ? 'supabase' : 'local';
