# Directive: Create Dashboard Widget

## Goal
Ein neues Widget für das Finanzdashboard bauen (z. B. Performance-Karte, Allokations-Donut,
Kennzahlen-Kachel) — konsistent mit dem bestehenden Design-System statt einer Insel für sich.

## Inputs
- Widget-Typ und die Daten, die es zeigen soll (kommen aus `src/lib/queries.ts` /
  `PortfolioData`, nicht neu erfinden)
- Ziel-Ansicht (`src/features/portfolio/`, `src/features/signals/` …)
- Ob das Widget interaktiv ist (Sortierung, Klick, Hover) oder rein darstellend

## Skills (aus `CLAUDE.md`)
1. Skill 1 (Design Direction) — nur wenn das Widget optisch neuartig ist, nicht für
  Varianten von etwas, das es schon gibt (Tabelle, Karte, KPI-Kachel existieren bereits)
2. Skill 2 (Layout & Design System) — Raster, Breakpoints, Zustände
3. Skill 3 (Animationen) — nur wenn es dem Verständnis hilft (z. B. Zahl zählt hoch),
  nie als Selbstzweck
4. Skill 4 (`/polish`) — Abstand/Typografie/Kontrast am Ende glattziehen
5. Skill 7 (Code-Audit) — Barrierefreiheit und Responsive-Check vor dem Commit

## Bestehende Konventionen, die gelten (nicht neu erfinden)
- Design-Tokens: `src/styles/tokens.css` (Light/Dark-Paare), Utility-Klassen in
  `src/styles/app.css` (`.card`, `.kpi`, `.btnrow`, `.mute`, `.small`, `.num` …)
- Zahlenformatierung: `src/lib/format.ts` (`eur`, `money`, `pct`, `num`, `date`) —
  nie `Intl.NumberFormat` direkt im Component anlegen, das war schon mal ein Bug
  (neues Format-Objekt bei jedem Render)
- Datenquelle: `getStore()` aus `src/lib/store` — nie direkt auf IndexedDB/Supabase zugreifen
- Sprache: alle sichtbaren Texte auf Deutsch, Kommentare im Code auf Deutsch (Projektkonvention)
- `PERSONALIZED_ADVICE` bleibt `false` — kein Widget darf Signale mit dem Depot verknüpfen
  (siehe `docs/RECHTLICHES.md`)

## Ausführung
Kein Skript dafür — das ist reine Implementierung in `src/features/` bzw. `src/components/`.
Bei wiederkehrenden, mechanischen Teilschritten (z. B. Screenshot-Vergleich) auf
`execution/` zurückgreifen, falls dort ein passendes Skript existiert.

## Outputs
- Component in `src/features/<bereich>/` oder `src/components/`
- Falls visuell geprüft: Screenshot in `.tmp/screenshots/`
- Kein Build-Fehler (`npm run build` muss grün sein)

## Edge Cases
- Braucht das Widget einen Kurs/externe Marktdaten? → `src/lib/market/fmp.ts` nutzen,
  nicht neu bauen. Kostenloser Plan deckt keine Auslandsbörsen (Xetra etc.) ab —
  das ist bekannt, kein neuer Fehler.
- Widget zu breit für mobile? → in `.tblwrap`/`overflow-x: auto` wickeln, nicht die
  ganze Seite scrollen lassen (siehe `@media (max-width: 760px)` in `app.css`).
- Animation ruckelt? → nur `transform`/`opacity` animieren, `prefers-reduced-motion`
  respektieren (globale Regel existiert schon in `app.css`).
