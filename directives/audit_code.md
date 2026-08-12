# Directive: Audit Code

## Goal
Vor einem Commit prüfen, ob neuer/geänderter UI-Code Barrierefreiheit, Kontrast,
Responsive-Verhalten und die Projekt-Konventionen einhält — als letzter Schritt, nicht
als Ersatz für Tests oder den Build.

## Wann
Nach jeder sichtbaren UI-Änderung, vor `git commit`. Nicht nötig für reine Logik-/
Datenänderungen ohne UI-Bezug.

## Skills
- Skill 7 (Code-Audit) — Checkliste aus `CLAUDE.md`

## Ausführung
Kein Skript — manuelle Prüfung anhand der Checkliste in Skill 7, plus die projekteigenen
harten Anforderungen unten. Für Screenshots/visuelle Kontrolle den Dev-Server nutzen
(`npm run dev`, Browser-Pane).

## Projekteigene Pflichtprüfungen (zusätzlich zu Skill 7)
- `npm run build` grün (tsc --noEmit + vite build) — **immer**, bevor gepusht wird
- Farben ausschließlich über CSS-Variablen aus `src/styles/tokens.css`, keine
  hartkodierten Hex-Werte im Component (war ein dokumentierter Altlast-Bug)
- Neue `Intl.NumberFormat`/`Intl.DateTimeFormat`-Instanzen nur über `src/lib/format.ts`,
  nie direkt im Component (Performance-Falle bei Tabellen mit vielen Zeilen)
- Tabellen/breite Inhalte in `.tblwrap` (`overflow-x: auto`) — die Seite selbst darf nie
  horizontal scrollen
- Responsive-Check: Browser-Pane auf `mobile` (375px), `tablet`, `desktop`
- Bei Formularen: Label `htmlFor`/`id`-Paar vorhanden, Fehler mit `role="alert"` oder
  `aria-describedby`, wie in `PositionForm.tsx` vorgemacht

## Outputs
- Kurzer Befund: Critical / Warning / Info, mit Datei:Zeile wo möglich
- Bei Critical: vor dem Commit fixen, nicht nur notieren

## Edge Cases
- Audit findet ein Kontrastproblem nur im Dark Mode → beide Modi einzeln prüfen,
  `tokens.css` hat für Light und Dark getrennte Werte, ein Fix im einen kann den
  anderen brechen
