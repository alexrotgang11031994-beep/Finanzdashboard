import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const KEY = 'finanzdashboard:theme';

interface ThemeValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

function read(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    const root = document.documentElement;
    // Bei 'system' wird das Attribut entfernt, damit die
    // prefers-color-scheme-Regel in tokens.css wieder greift.
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  function setTheme(next: Theme) {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    setThemeState(next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme muss innerhalb von <ThemeProvider> stehen.');
  return ctx;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const order: Theme[] = ['system', 'light', 'dark'];
  const labels: Record<Theme, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' };

  return (
    <button
      type="button"
      className="ghost small"
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length] as Theme)}
      aria-label={`Farbschema: ${labels[theme]}. Klicken zum Wechseln.`}
    >
      {labels[theme]}
    </button>
  );
}
