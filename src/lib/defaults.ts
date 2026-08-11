import type { ClusterDef, Rules } from './types';

/**
 * Auslieferungszustand für neue Depots.
 *
 * Dieselben Werte stehen im Trigger handle_new_user() in
 * supabase/migrations/0001_init.sql. Wer hier etwas ändert, ändert es dort mit —
 * sonst laufen lokaler Modus und Supabase-Modus auseinander.
 */
export const DEFAULT_CLUSTERS: ClusterDef[] = [
  { key: 'SEMI', label: 'Halbleiter & KI-Chips', color: '#A8391F', target: 24, is_core: false, sort_order: 1 },
  { key: 'PHYS', label: 'Physical AI & Robotik', color: '#C9752B', target: 12, is_core: false, sort_order: 2 },
  { key: 'INFRA', label: 'KI-Infrastruktur', color: '#6E8C2F', target: 12, is_core: false, sort_order: 3 },
  { key: 'SOFT', label: 'Software & Plattformen', color: '#2C4A6E', target: 12, is_core: false, sort_order: 4 },
  { key: 'KERN', label: 'Breiter Markt', color: '#0E7A6E', target: 20, is_core: true, sort_order: 5 },
  { key: 'ROHS', label: 'Edelmetalle & Rohstoffe', color: '#8C7628', target: 9, is_core: false, sort_order: 6 },
  { key: 'INDU', label: 'Industrie & Rüstung', color: '#3D5A4C', target: 7, is_core: false, sort_order: 7 },
  { key: 'DEFE', label: 'Defensiv', color: '#6E6A62', target: 3, is_core: false, sort_order: 8 },
  { key: 'SPEK', label: 'Spekulativ', color: '#7A4E77', target: 1, is_core: false, sort_order: 9 },
];

export const DEFAULT_RULES: Rules = {
  maxSinglePosition: 8,
  maxCluster: 25,
  minCore: 20,
  maxPositions: 25,
  minPositionSize: 0.3,
};
