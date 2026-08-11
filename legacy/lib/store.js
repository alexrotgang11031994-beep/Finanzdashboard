/**
 * Snapshot-Historie im Browser.
 *
 * Es gibt keine Kurshistorie aus der Vergangenheit - die Screenshots zeigen
 * genau einen Zeitpunkt. Statt eine Kurve zu erfinden, zeichnet das Dashboard
 * ab jetzt selbst auf: jeder gespeicherte Snapshot ist ein echter Datenpunkt.
 */
const KEY = 'investmentstratege:snapshots';

function available() {
  try {
    const t = '__t';
    window.localStorage.setItem(t, t);
    window.localStorage.removeItem(t);
    return true;
  } catch { return false; }
}

export const storageAvailable = available();

export function loadSnapshots(seed = []) {
  if (!storageAvailable) return [...seed];
  try {
    const raw = window.localStorage.getItem(KEY);
    const own = raw ? JSON.parse(raw) : [];
    const merged = [...seed, ...own];
    const seen = new Map();
    for (const s of merged) seen.set(s.date, s);
    return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch { return [...seed]; }
}

export function saveSnapshot(entry) {
  if (!storageAvailable) return false;
  try {
    const raw = window.localStorage.getItem(KEY);
    const own = raw ? JSON.parse(raw) : [];
    const rest = own.filter((s) => s.date !== entry.date);
    rest.push(entry);
    window.localStorage.setItem(KEY, JSON.stringify(rest));
    return true;
  } catch { return false; }
}

export function clearSnapshots() {
  if (!storageAvailable) return;
  window.localStorage.removeItem(KEY);
}

export function exportSnapshots(seed) {
  return JSON.stringify(loadSnapshots(seed), null, 1);
}
