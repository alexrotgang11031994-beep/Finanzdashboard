import { useCallback, useEffect, useState } from 'react';
import { getStore } from './store';
import type { PortfolioData } from './store/types';

export type { PortfolioData } from './store/types';

/** Lädt den kompletten Depotstand aus der aktiven Speicherart. */
export function usePortfolioData() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStore().load());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, reload: load };
}
