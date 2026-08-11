import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base muss dem Repo-Namen entsprechen, weil GitHub Pages die Seite unter
// https://<user>.github.io/Finanzdashboard/ ausliefert. Lokal stört der Präfix nicht.
export default defineConfig({
  base: '/Finanzdashboard/',
  plugins: [react()],
  server: { port: 5173 },
});
