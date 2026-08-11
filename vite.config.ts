import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base muss dem Repo-Namen entsprechen, weil GitHub Pages die Seite unter
// https://<user>.github.io/Finanzdashboard/ ausliefert. Lokal stört der Präfix nicht.
export default defineConfig({
  base: '/Finanzdashboard/',
  plugins: [react()],
  server: { port: 5173 },
  // legacy/ ist eine Referenzkopie des alten Standes, kein Einstiegspunkt.
  // Ohne diese Eingrenzung zieht der Abhängigkeitsscanner legacy/index.html
  // mit hinein und meldet nicht auflösbare Importe.
  optimizeDeps: { entries: ['index.html', 'src/**/*.{ts,tsx}'] },
});
